# Minha Anamnese — Guia para desenvolvimento

App de organização de anamneses médicas com IA. Leia o `README.md` para visão completa; este arquivo resume o que importa para mexer no código com segurança.

## Arquitetura

- **Frontend**: React 18 + Vite em `frontend/` → deploy na **Vercel** (estático, sempre ativo).
- **Backend canônico**: Node/Express em `backend/server.js` → deploy no **Render** (free tier: hiberna após ~15 min ocioso; o frontend faz warm-up via `frontend/src/lib/backendWarmup.js`).
- **`api/` na raiz**: os mesmos handlers expostos como functions da Vercel — fallback opcional só para rotas GET de leitura (ativado por `VITE_API_FALLBACK_URL`). Rotas de IA rodam só no Render (timeout de serverless).
- **Handlers** em `backend/apiHandlers/` são agnósticos de framework: recebem `(req, res)` puros e são roteados por `backend/apiHandlers/index.js`.
- **Supabase**: banco + auth, acessado por `fetch` REST direto (sem SDK no backend). SQL em `supabase/*.sql`, **idempotente**, aplicado manualmente pelo dono no SQL Editor — nunca automatizar.
- **Notion**: CMS editorial (templates, prompts, prescrições, bulário, ferramentas clínicas, manobras, exames, frases prontas, modelos de carta), sincronizado ao Supabase por rotas `/api/admin/*/sync` protegidas por bearer secret, ou automaticamente por webhook (`/api/webhook/notion/*`) quando a página muda.
- **Automação editorial por IA**: 5 orquestradores que se espelham deliberadamente — `backend/services/{clinicalDrug,exam,maneuver,protocol,clinicalTool}AutomationRunner.js`. Fazem polling de páginas do Notion em status "a gerar"/"a corrigir", chamam IA e escrevem de volta, mas **nunca publicam sozinhos** (trava por contrato em `backend/contracts/*.js`; ferramentas clínicas têm ainda um gate de validação de schema que pode reprovar a geração). Mudar o comportamento de um provavelmente exige checar os outros quatro.
- **Ferramentas Clínicas** (`backend/services/clinicalTools.js` + `frontend/src/lib/clinicalChecklist.js`): além de score por soma/fórmula, suporta checklist condicional por eixo (`engineConfig.axisFieldId` + `applicableFrom`/`applicableUntil`/`alertFrom` por item) — usado por vacinação, marcos do desenvolvimento e pré-natal para não cobrar item fora da faixa etária como falha.
- **Mercado Pago**: checkout + webhook assinado (HMAC) em `backend/apiHandlers/webhook/mercadopago.js`.

## Fluxo de deploy

Commit + push para `main` publica frontend (Vercel) e backend (Render) automaticamente. Mudanças de banco: criar SQL idempotente em `supabase/` e avisar — a aplicação é manual.

## Comandos

```bash
cd backend && npm test        # testes (node:test) — rodar antes de commitar backend
cd frontend && npm run build  # validar build antes de publicar mudanças de UI
```

## Convenções

- Respostas da API sempre `{ success, data?, error? }`; mensagens de erro em pt-BR.
- Padrão dos handlers: validação → auth (`resolveSupabaseUser`) → rate limit (`consumeRateLimit`, **async**) → access state/paywall → regra de negócio.
- Sem TypeScript, sem frameworks extras: manter dependências mínimas (free tier).
- Rate limit: Supabase RPC `consume_rate_limit` com fallback em memória (`backend/utils/rateLimit.js`).
- Não alterar preços em `backend/config/billingPlans.js` / `frontend/src/billingPlans.js` sem pedido explícito; o plano legado de R$9,90 precisa continuar reconhecido.
- Desconto de afiliado: checkout e webhook devem calcular o valor pelo mesmo helper (`getDiscountedPlanAmount` em `billingPlans.js`) — arredondamento divergente rejeita pagamentos legítimos. Desconto sempre resolvido server-side a partir do registro do afiliado.
- Páginas fora da home são `React.lazy` no `App.jsx` — novas páginas devem seguir o mesmo padrão.
- Conteúdo clínico é editorial (Notion) — não hardcodar textos clínicos novos no código sem alinhamento.
- Cartas/documentos: o que depende de consentimento não pode ficar a cargo do prompt. No atestado, o CID preenchido decide se entra o termo de ciência do paciente, e o servidor mantém/remove o bloco `{{#com_cid}}...{{/com_cid}}` do formato antes de montar o prompt (`applyConditionalFormatBlocks`). As regras condicionais do tipo (`buildConditionalRules`) sobrevivem até ao override do Notion.
- No **laudo** o CID é obrigatório e **não** entra termo de ciência: o documento é emitido a pedido do paciente para instruir o próprio requerimento (BPC, INSS). A regra do tipo proíbe opinar sobre direito ao benefício ou classificar incapacidade — o laudo descreve repercussão funcional; quem decide é o órgão.
- Um tipo de documento novo exige **código nos dois lados** (`backend/config/letterTypes.js` + o espelho `frontend/src/letterTypes.js`) — o Notion só fornece o esqueleto de formato de um tipo que já exista. O `widget: 'cid'` no frontend é o que liga o autocomplete do CID-10.
- Tipo desconhecido é **recusado** na escrita (sync do Notion e modelos do usuário), nunca coagido para encaminhamento — coagir publicava o modelo sob o tipo errado sem nenhum aviso. Na leitura o fallback continua, para não sumir com linha antiga.
- Templates próprios: a qualidade (score + organização) vem de 3 camadas em `backend/services/userTemplates.js` — enriquecimento por IA salvo (`enrichment` jsonb, gerado no save) > herança da seção oficial mais próxima (`utils/templateSectionMatching.js`) > heurística do rótulo. Não voltar ao antigo `buildCustomEvaluation` de pesos iguais/evidence do próprio título.
- **Acesso Pro**: única fonte de verdade é `profiles.current_plan`/`billing_status` (gravados pelo backend via service role). Nunca ler `user_metadata` do Supabase Auth para decidir acesso — é gravável pelo próprio usuário via `supabase.auth.updateUser`, e já foi vetor de auto-promoção a Pro (removido em `backend/services/accessState.js`).
- O frontend nunca escreve direto numa tabela do Supabase (`supabase.from(...)`) — só usa `supabase.auth.*` para sessão/login. Toda escrita de dado passa pela API (service role, ignora RLS). Não criar policy de INSERT/UPDATE em `profiles` para `anon`/`authenticated` (ver `supabase/profiles_restrict_direct_writes.sql`).

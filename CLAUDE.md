# Minha Anamnese — Guia para desenvolvimento

App de organização de anamneses médicas com IA. Leia o `README.md` para visão completa; este arquivo resume o que importa para mexer no código com segurança.

## Arquitetura

- **Frontend**: React 18 + Vite em `frontend/` → deploy na **Vercel** (estático, sempre ativo).
- **Backend canônico**: Node/Express em `backend/server.js` → deploy no **Render** (free tier: hiberna após ~15 min ocioso; o frontend faz warm-up via `frontend/src/lib/backendWarmup.js`).
- **`api/` na raiz**: os mesmos handlers expostos como functions da Vercel — fallback opcional só para rotas GET de leitura (ativado por `VITE_API_FALLBACK_URL`). Rotas de IA rodam só no Render (timeout de serverless).
- **Handlers** em `backend/apiHandlers/` são agnósticos de framework: recebem `(req, res)` puros e são roteados por `backend/apiHandlers/index.js`.
- **Supabase**: banco + auth, acessado por `fetch` REST direto (sem SDK no backend). SQL em `supabase/*.sql`, **idempotente**, aplicado manualmente pelo dono no SQL Editor — nunca automatizar.
- **Desvio `/sb`**: há operadoras (ex.: Alares) que bloqueiam IPs da Cloudflare usados pelo Supabase. O frontend testa o acesso direto e, se falhar, fala com o Supabase pelo nosso domínio (`/sb/*`, rewrite nos dois `vercel.json`) — `frontend/src/lib/supabaseRoute.js` + `supabaseClient.js`. Os modelos de e-mail do Auth também apontam para `/sb/auth/v1/verify`. Não remover o rewrite sem trocar esses modelos.
- **Notion**: CMS editorial (templates, prompts, prescrições, bulário, ferramentas clínicas, manobras, exames, frases prontas, modelos de carta), sincronizado ao Supabase por rotas `/api/admin/*/sync` protegidas por bearer secret, ou automaticamente por webhook (`/api/webhook/notion/*`) quando a página muda.
- **Automação editorial por IA**: 5 orquestradores que se espelham deliberadamente — `backend/services/{clinicalDrug,exam,maneuver,protocol,clinicalTool}AutomationRunner.js`. Fazem polling de páginas do Notion em status "a gerar"/"a corrigir", chamam IA e escrevem de volta, mas **nunca publicam sozinhos** (trava por contrato em `backend/contracts/*.js`; ferramentas clínicas têm ainda um gate de validação de schema que pode reprovar a geração). Mudar o comportamento de um provavelmente exige checar os outros quatro.
- **Ferramentas Clínicas** (`backend/services/clinicalTools.js` + `frontend/src/lib/clinicalChecklist.js`): além de score por soma/fórmula, suporta checklist condicional por eixo (`engineConfig.axisFieldId` + `applicableFrom`/`applicableUntil`/`alertFrom` por item) — usado por vacinação, marcos do desenvolvimento e pré-natal para não cobrar item fora da faixa etária como falha.
- **Mercado Pago**: o pagamento acontece na nossa página, sem conta no MP; o redirecionamento antigo (Checkout Pro) fica de reserva quando as chaves estão desligadas.
  - **Mensal**: assinatura `/preapproval` criada com o cartão tokenizado no `CardCheckoutModal` (`card_token_id` + `status: 'authorized'`). Chaves `CARD_CHECKOUT_ENABLED` (Render) e `VITE_CARD_CHECKOUT` (Vercel).
  - **Semestral**: Orders API (`backend/services/mercadoPagoOrders.js`) numa **segunda aplicação** do MP, com cartão à vista ou Pix (`SemiannualCheckoutModal`). Chaves `SEMIANNUAL_PAGE_CHECKOUT_ENABLED` / `VITE_SEMIANNUAL_PAGE_CHECKOUT`; credenciais `MERCADO_PAGO_ORDERS_*` e `VITE_MERCADO_PAGO_ORDERS_PUBLIC_KEY`. A Orders API recusa parcelado (só `installments: 1`) e não aceita `metadata` nem `notification_url`: o webhook reconstrói o metadata a partir do pedido (`external_reference` = userId).
  - **Webhook** `backend/apiHandlers/webhook/mercadopago.js`: HMAC que aceita o segredo de qualquer das duas aplicações, trata eventos de pagamento, assinatura e pedido (inclusive estorno e chargeback, que retiram o Pro e cancelam a comissão). Reprocessamento manual: `POST /api/admin/billing/reconcile` com `{ paymentId }` ou `{ orderId }`.
  - `?checkout_cartao=1` liga os dois checkouts na página só naquele navegador, para testar antes de abrir para todos.
- **Teste e retenção**: teste Pro de 7 dias sem cartão (`PRO_TRIAL_DAYS`). O uso de cada recurso vai para `usage_logs` em toda conta (`backend/services/trialUsage.js`) e volta no perfil como `trial_usage`, que alimenta o quadro de planos e a tela de teste encerrado. E-mails automáticos (lembrete de fim de teste, reengajamento, avisos de plano) rodam por rotas `/api/admin/*/run` com orçamento diário (`backend/services/emailBudget.js`).
- **Oferta do Pro** (`frontend/src/components/PlanComparisonModal.jsx` + `frontend/src/lib/proOffer.js`): mostra o que a pessoa usou no teste e o tamanho real do catálogo publicado, vindo de `GET /api/catalog-summary` (contagem com cache de 6 h em `backend/services/catalogSummary.js`). Os números arredondam para baixo ("560+"): a oferta nunca promete mais do que o catálogo tem.
- **Painel do dono**: `/api/admin/metrics` (`backend/services/ownerMetrics.js`) — funil, checkout e uso, só agregados.

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
- Templates próprios: a qualidade (score + organização) vem de 3 camadas em `backend/services/userTemplates.js` — enriquecimento por IA salvo (`enrichment` jsonb, gerado no save) > herança da seção oficial mais próxima (`utils/templateSectionMatching.js`) > heurística do rótulo. O `buildCustomEvaluation` atual já aplica essas camadas, com peso por prioridade clínica; não voltar à versão antiga de pesos iguais e evidência tirada só do próprio título.
- Fronteira comercial fica no código, não no Notion: o que é liberado sem assinatura (ex.: `backend/config/freeClinicalTools.js`) muda por diff e PR, nunca por um campo editável no CMS.
- **Eventos de analytics**: evento novo disparado pelo frontend (`trackEvent`) precisa entrar na allowlist de `backend/apiHandlers/analytics.js`, com o nome e cada chave de metadata. O que não estiver lá é descartado em silêncio; um teste confere se os nomes acompanham o frontend. Metadata nunca leva texto clínico.
- **Acesso Pro**: única fonte de verdade é `profiles.current_plan`/`billing_status` (gravados pelo backend via service role). Nunca ler `user_metadata` do Supabase Auth para decidir acesso — é gravável pelo próprio usuário via `supabase.auth.updateUser`, e já foi vetor de auto-promoção a Pro (removido em `backend/services/accessState.js`).
- O frontend nunca escreve direto numa tabela do Supabase (`supabase.from(...)`) — só usa `supabase.auth.*` para sessão/login. Toda escrita de dado passa pela API (service role, ignora RLS). Não criar policy de INSERT/UPDATE em `profiles` para `anon`/`authenticated` (ver `supabase/profiles_restrict_direct_writes.sql`).

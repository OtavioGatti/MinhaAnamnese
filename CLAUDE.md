# Minha Anamnese — Guia para desenvolvimento

App de organização de anamneses médicas com IA. Leia o `README.md` para visão completa; este arquivo resume o que importa para mexer no código com segurança.

## Arquitetura

- **Frontend**: React 18 + Vite em `frontend/` → deploy na **Vercel** (estático, sempre ativo).
- **Backend canônico**: Node/Express em `backend/server.js` → deploy no **Render** (free tier: hiberna após ~15 min ocioso; o frontend faz warm-up via `frontend/src/lib/backendWarmup.js`).
- **`api/` na raiz**: os mesmos handlers expostos como functions da Vercel — fallback opcional só para rotas GET de leitura (ativado por `VITE_API_FALLBACK_URL`). Rotas de IA rodam só no Render (timeout de serverless).
- **Handlers** em `backend/apiHandlers/` são agnósticos de framework: recebem `(req, res)` puros e são roteados por `backend/apiHandlers/index.js`.
- **Supabase**: banco + auth, acessado por `fetch` REST direto (sem SDK no backend). SQL em `supabase/*.sql`, **idempotente**, aplicado manualmente pelo dono no SQL Editor — nunca automatizar.
- **Notion**: CMS editorial (templates, prompts, prescrições, bulário), sincronizado ao Supabase por rotas `/api/admin/*/sync` protegidas por bearer secret.
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

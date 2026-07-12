# Minha Anamnese

Aplicativo web para organizar anamneses médicas com apoio de IA, templates clínicos, análise estrutural, guias de prescrição e bulário clínico. O foco do produto é acelerar a escrita clínica sem substituir julgamento médico, prontuário oficial ou revisão profissional.

## Visão Geral

O Minha Anamnese é composto por:

- Frontend React/Vite com workspace clínico, templates, evolução, prescrições, bulário e perfil.
- Backend Node.js/Express com rotas de IA, autenticação via Supabase, sincronização com Notion, checkout e métricas.
- Supabase para autenticação, perfis, planos, templates, prompts oficiais, guias de prescrição, bulário e logs de uso.
- Notion como CMS editorial para templates, prompts, protocolos de prescrição e bulário clínico.
- OpenAI para organização de anamnese, insights estruturais e cartas de encaminhamento.
- Mercado Pago para checkout e liberação de plano profissional.

## Funcionalidades

- Organização de anamneses com IA a partir de templates clínicos oficiais ou personalizados.
- Prompts por categoria clínica, permitindo vincular templates e prompts por `category_key`.
- Score estrutural da anamnese com seções ausentes, evidências, lacunas e acompanhamento de evolução.
- Cartas de encaminhamento geradas com IA.
- Sugestão de hipóteses diagnósticas para usuários profissionais, com evidências, dados ausentes, diferenciais e sinais de alerta.
- Guias de prescrição por patologia, com CID-10 principal e CID-10 por opção quando preenchidos.
- Bulário clínico com busca por princípio ativo, nome comercial, classe/categoria e tags.
- Autocomplete textual de medicamentos na anamnese com chips de consulta rápida.
- Templates próprios para usuários.
- Onboarding de boas-vindas, trial profissional e paywall.
- Perfil com dados de plano, preferências e controle de acesso.
- Sincronização administrativa com Notion para templates, prompts, prescrições e bulário.

## Stack

- Frontend: React 18 + Vite
- Backend: Node.js + Express
- Banco e autenticação: Supabase
- CMS editorial: Notion
- IA: OpenAI
- Pagamentos: Mercado Pago
- Frontend em produção: Vercel
- Backend em produção: Render

## Arquitetura de Deploy

- O frontend estático fica na Vercel (CDN, sempre ativo, sem cold start).
- O backend canônico fica no Render (`backend/server.js`). Todas as rotas de IA (`/organizar`, `/insights`, `/diagnostic-hypotheses`, `/referral-letter`) rodam exclusivamente nele, pois podem exceder o timeout de functions serverless.
- O diretório `api/` na raiz expõe os mesmos handlers como functions da Vercel. Ele é um fallback opcional apenas para rotas GET de leitura (templates, bulário, prescrições), ativado no frontend via `VITE_API_FALLBACK_URL`. Sem essa variável, o fallback fica desativado.

### Cold start do Render (plano free)

O Render hiberna o backend após ~15 minutos ocioso. Duas mitigações:

1. O frontend dispara um `GET /api/health` em background assim que o app carrega (`frontend/src/lib/backendWarmup.js`), acordando o backend enquanto o usuário digita.
2. Um ping externo em `GET /api/health` a cada 10 minutos mantém o backend quente 24/7. O workflow do n8n está versionado em `tools/n8n/keep-warm-render.json` (importar e ativar — instruções em `tools/n8n/README.md`).

Atenção ao teto de 750h/mês do plano free do Render: o ping 24/7 mantém o serviço acordado ~730h, cabendo nas 750h com margem estreita. Se precisar de folga (ex.: um segundo serviço free), restrinja o Schedule Trigger ao horário de uso.

## Estrutura

```text
backend/
  apiHandlers/        Rotas HTTP organizadas por domínio
  services/           Regras de negócio, Supabase, Notion e OpenAI
  prompts/            Prompts locais de fallback
  utils/              Score, sanitização, autenticação e limites
  server.js           App Express

frontend/src/
  components/         Telas e componentes do workspace
  hooks/              Hooks de UI e domínio
  lib/                Cliente Supabase
  data/               Dados locais de fallback
  apiClient.js        Cliente HTTP do backend

supabase/
  *.sql               Tabelas, migrações manuais, RLS e backfills

tests/anamnese-evals/
  README.md           Avaliações manuais/semiautomatizadas da análise de anamnese
```

## Requisitos

- Node.js 18 ou superior
- Projeto Supabase configurado
- Chave da OpenAI
- Integração Notion com acesso às bases editoriais
- Credenciais Mercado Pago
- SMTP configurado no Supabase para e-mails de autenticação

## Variáveis de Ambiente

### Frontend

```env
VITE_API_URL=http://localhost:3001/api
VITE_API_FALLBACK_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`VITE_API_FALLBACK_URL` (opcional) habilita retry de rotas GET de leitura contra um segundo backend (ex.: `/api` da Vercel) quando o primário estiver inacessível. Vazio = desativado.

Há um `.env.example` em `frontend/` e outro em `backend/` para copiar como ponto de partida.

### Backend

```env
PORT=3001
FRONTEND_URL=http://localhost:3000
PUBLIC_APP_URL=http://localhost:3000
PUBLIC_API_URL=http://localhost:3001

OPENAI_API_KEY=
ANALYSIS_ENGINE=unified_ai
DIAGNOSTIC_HYPOTHESES_ENABLED=true
DIAGNOSTIC_MODEL=gpt-4o

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
MERCADO_PAGO_WEBHOOK_URL=

NOTION_API_KEY=
NOTION_TEMPLATES_DATA_SOURCE_ID=
NOTION_PROMPTS_DATA_SOURCE_ID=
NOTION_PRESCRIPTION_GUIDES_DATA_SOURCE_ID=
NOTION_CLINICAL_DRUGS_DATA_SOURCE_ID=

TEMPLATE_SYNC_SECRET=
PROMPT_SYNC_SECRET=
PRESCRIPTION_GUIDES_SYNC_SECRET=
CLINICAL_DRUGS_SYNC_SECRET=
ADMIN_SYNC_SECRET=
NOTION_WEBHOOK_VERIFICATION_TOKEN=

PRO_TRIAL_DAYS=7

RATE_LIMIT_STORE=

AFFILIATE_PAYOUT_MIN_AMOUNT=50
AFFILIATE_PAYOUT_WEBHOOK_URL=
```

`ANALYSIS_ENGINE` controla o motor da avaliação estrutural: use `unified_ai` para a análise única por IA ou `legacy` para voltar ao score determinístico anterior com interpretação por IA.

`RATE_LIMIT_STORE` controla onde os contadores de rate limit vivem: por padrão usa o Supabase (tabela `rate_limit_buckets`, compartilhada entre instâncias — requer `supabase/rate_limits.sql` aplicado) com fallback automático para memória; use `memory` para forçar apenas o fallback por processo.

## Como Rodar Localmente

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend local: `http://localhost:3001`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend local: `http://localhost:3000`

## Build

```bash
cd frontend
npm run build
```

O backend não possui build separado; ele roda diretamente com Node.js.

## Testes

```bash
cd backend
npm test
```

Cobrem hipóteses diagnósticas, planos de cobrança, rate limit, roteamento da API e score estrutural. Rodar antes de qualquer commit que toque o backend.

## Rotas e Fluxos Principais

- `POST /api/organizar`: organiza a anamnese com IA.
- `POST /api/insights`: gera análise estrutural e score.
- `POST /api/referral-letter`: gera carta de encaminhamento.
- `POST /api/diagnostic-hypotheses`: sugere hipóteses diagnósticas a partir da anamnese organizada para usuários profissionais.
- `GET /api/templates`: lista templates oficiais e do usuário.
- `GET /api/prescription-guides`: lista guias de prescrição publicados.
- `GET /api/clinical-drugs`: lista medicamentos do bulário clínico.
- `GET /api/account/export`: exporta os dados do usuário em JSON (portabilidade LGPD).
- `POST /api/account/delete`: exclui a conta (cancela assinatura, apaga perfil e anamneses; auditoria financeira é anonimizada por `SET NULL`). Exige reenvio do e-mail da conta em `confirmEmail`.
- `POST /api/create-checkout`: cria checkout no Mercado Pago (aplica desconto de afiliado quando houver).
- `POST /api/reconcile-subscription`: confirma ativamente uma assinatura ao voltar do checkout, sem depender do webhook (ver aviso abaixo).
- `POST /api/webhook/mercadopago`: recebe confirmação de pagamento.
- `GET /api/affiliate`: dados do afiliado, saldos e histórico de saques.
- `GET /api/affiliate/lookup?code=...`: consulta pública de código de indicação (desconto para exibição).
- `POST /api/affiliate/payouts`: afiliado solicita saque das comissões disponíveis.
- `POST /api/admin/affiliates/update`: ajusta comissão/desconto/status de um afiliado (bearer `ADMIN_SYNC_SECRET`).
- `POST /api/admin/affiliate-payouts/settle`: dá baixa em um saque após a transferência (bearer `ADMIN_SYNC_SECRET`).

### ⚠️ Webhook de assinaturas (Preapproval) do Mercado Pago

O Mercado Pago **não usa o `notification_url` enviado na criação da assinatura** para os tópicos `subscription_preapproval` e `subscription_authorized_payment` — diferente do checkout de pagamento único. Esses eventos só chegam se o webhook estiver configurado **a nível de Aplicação** no [painel de desenvolvedor do Mercado Pago](https://www.mercadopago.com.br/developers/panel) (Sua aplicação → Webhooks → apontar para `https://minhaanamnese.onrender.com/api/webhook/mercadopago` e assinar os tópicos de assinatura/pagamentos).

Enquanto isso não estiver configurado (ou como rede de segurança mesmo depois), o retorno do checkout de sucesso chama `POST /api/reconcile-subscription`, que busca ativamente o pagamento da assinatura direto na API do Mercado Pago e roda a mesma lógica de negócio do webhook (upgrade do usuário, comissão do afiliado). Isso cobre o caso do usuário completar o pagamento e voltar ao app; **cobranças recorrentes futuras** (a partir do 2º ciclo, sem o usuário estar no app) continuam dependendo do webhook estar configurado corretamente.

## Sincronização com Notion

As bases editoriais vivem no Notion e são sincronizadas para o Supabase por rotas administrativas protegidas por bearer token.

Exemplos em PowerShell:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "https://minhaanamnese.onrender.com/api/admin/templates/sync" `
  -Headers @{ Authorization = "Bearer SEU_SECRET" }

Invoke-RestMethod `
  -Method Post `
  -Uri "https://minhaanamnese.onrender.com/api/admin/prompts/sync" `
  -Headers @{ Authorization = "Bearer SEU_SECRET" }

Invoke-RestMethod `
  -Method Post `
  -Uri "https://minhaanamnese.onrender.com/api/admin/prescription-guides/sync" `
  -Headers @{ Authorization = "Bearer SEU_SECRET" }

Invoke-RestMethod `
  -Method Post `
  -Uri "https://minhaanamnese.onrender.com/api/admin/clinical-drugs/sync" `
  -Headers @{ Authorization = "Bearer SEU_SECRET" }
```

## Supabase

Os arquivos SQL ficam em `supabase/` e devem ser aplicados manualmente no SQL Editor quando necessário. Principais tabelas:

- `profiles`: perfil, plano, trial, onboarding e preferências.
- `anamneses`: histórico e métricas de análises.
- `usage_logs`: auditoria e telemetria de uso do trial.
- `official_templates`: templates oficiais sincronizados do Notion.
- `user_templates`: templates criados pelo usuário.
- `official_prompts`: prompts oficiais sincronizados do Notion.
- `prescription_guides`: protocolos de prescrição.
- `clinical_drugs`: bulário clínico.
- `billing_payments`: pagamentos e auditoria de checkout.
- `events`: eventos de funil e produto.
- `rate_limit_buckets`: contadores de rate limit compartilhados entre instâncias (`supabase/rate_limits.sql`).
- `affiliates` / `affiliate_commissions` / `affiliate_attributions`: programa de afiliados, com comissão e desconto por afiliado (`supabase/affiliate_program.sql`, `supabase/affiliate_discounts.sql`).
- `affiliate_payouts`: saques de comissão com baixa manual (`supabase/affiliate_payouts.sql`).
- `user_templates.enrichment`: metadados por seção gerados por IA para elevar a qualidade dos templates próprios (`supabase/user_templates_enrichment.sql`).

## Programa de Afiliados (Operação)

Comissão padrão de 30%, com comissão e desconto configuráveis **por afiliado**. O desconto é aplicado no checkout e validado de forma independente no webhook (nunca confia no valor vindo do cliente). Mudanças de comissão valem só para vendas futuras — cada comissão grava a taxa do momento da venda.

Ajustar comissão/desconto (SQL Editor do Supabase):

```sql
-- 10% de desconto para compradores indicados + comissão de 20%
update public.affiliates
set discount_rate = 0.10, discount_label = 'Atlética XYZ', commission_rate = 0.20
where code = 'atletica-xyz';
```

Ou via endpoint admin:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "https://minhaanamnese.onrender.com/api/admin/affiliates/update" `
  -Headers @{ Authorization = "Bearer SEU_ADMIN_SYNC_SECRET" } `
  -ContentType "application/json" `
  -Body '{"code":"atletica-xyz","discountRate":0.10,"discountLabel":"Atlética XYZ","commissionRate":0.20}'
```

### Saques

1. O afiliado clica em **Solicitar saque** (mínimo `AFFILIATE_PAYOUT_MIN_AMOUNT`, padrão R$50) informando a chave PIX; as comissões disponíveis ficam presas no saque.
2. O dono é notificado via `AFFILIATE_PAYOUT_WEBHOOK_URL` (ex.: n8n → WhatsApp/e-mail); a row em `affiliate_payouts` é a fonte da verdade. A notificação inclui **links assinados de baixa** (pago/rejeitado) que abrem uma página de confirmação (`GET /api/affiliate-payout-action`, assinada por `PAYOUT_ACTION_SECRET`/`ADMIN_SYNC_SECRET`; só executa após o clique humano em Confirmar — imune a preview de link).
3. Após fazer o PIX manualmente, dar baixa pelo link do WhatsApp, pelo painel n8n, pela função SQL ou pelo endpoint admin (o saldo disponível zera e o histórico fica visível para os dois lados):

```sql
select public.settle_affiliate_payout('<payout_id>', 'paid', 'PIX enviado');
-- ou 'rejected' para devolver o valor ao saldo disponível
```

Ou via endpoint admin (ou pelo formulário n8n em `tools/n8n/affiliate-payout-settle-form.json`, que é um painel pronto para isso):

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "https://minhaanamnese.onrender.com/api/admin/affiliate-payouts/settle" `
  -Headers @{ Authorization = "Bearer SEU_ADMIN_SYNC_SECRET" } `
  -ContentType "application/json" `
  -Body '{"payoutId":"<payout_id>","action":"paid","note":"PIX enviado"}'
```

### Reembolsos e cancelamento

- **Cancelamento pelo cliente**: o assinante mensal cancela pelo próprio app (Perfil → cancelar assinatura, `POST /api/cancel-subscription`). Cancela só a próxima cobrança; o acesso já pago continua até `plan_expires_at`.
- **Reembolso/chargeback**: ao reembolsar um pagamento no painel do Mercado Pago, o webhook trata o estorno automaticamente: cancela a assinatura vinculada no provedor, revoga o acesso concedido por aquele pagamento (só se ele for o `last_payment_id` do perfil) e cancela a comissão de afiliado ainda não paga (comissão presa em saque aberto fica para revisão manual). Reembolsos **parciais** não revogam nada — tratar manualmente.

> ⚠️ **Sempre dê baixa pela função `settle_affiliate_payout` ou pelo endpoint admin — nunca editando a coluna `status` direto no Table Editor.** A baixa correta faz o cascade nas comissões (marca como `paid` ou devolve o saldo); a edição direta deixa a comissão órfã. Como blindagem, o saldo é derivado do status real do saque (`getAffiliateStats` / RPC de saque), então uma comissão presa a um saque rejeitado volta sozinha a ficar disponível; mas um saque marcado `paid` por edição manual não faz a baixa da comissão.

Requer `supabase/affiliate_discounts.sql` e `supabase/affiliate_payouts.sql` aplicados. Antes disso, o código segue funcionando com desconto 0 e saques indisponíveis (mensagem amigável).

## Onde Ficam as Regras Importantes

- Score e evidências da anamnese: `backend/utils/anamnesisQualityScore.js`
- Geração de insights: `backend/services/generateInsights.js`
- Hipóteses diagnósticas: `backend/services/generateDiagnosticHypotheses.js`
- Organização da anamnese: `backend/services/processAnamnesis.js`
- Templates oficiais: `backend/services/officialTemplates.js`
- Prompts oficiais por categoria: `backend/services/officialPrompts.js`
- Guias de prescrição: `backend/services/prescriptionGuides.js`
- Bulário clínico: `backend/services/clinicalDrugs.js`
- Controle de acesso/trial: `backend/services/accessState.js`; telemetria do trial: `backend/services/trialUsage.js`

## Boas Práticas do Projeto

- Não usar este produto como prontuário oficial.
- Não inserir dados identificáveis do paciente, como nome completo, CPF, endereço ou telefone.
- Conferir dose, alergias, contraindicações, idade, peso, gestação, função renal/hepática e protocolo local antes de prescrever.
- Tratar hipóteses geradas como apoio ao raciocínio, nunca como diagnóstico confirmado ou substituto da avaliação profissional.
- Manter dados editoriais publicados no Notion apenas após revisão adequada.
- Rodar `npm run build` no frontend antes de publicar alterações de UI.
- Para mudanças de banco, criar SQL idempotente em `supabase/` e aplicar manualmente.

## Roadmap

- [x] Autenticação e recuperação de senha
- [x] Onboarding de boas-vindas
- [x] Plano profissional, trial e paywall
- [x] Templates oficiais e personalizados
- [x] Prompts por categoria clínica
- [x] Score estrutural e evolução
- [x] Cartas de encaminhamento
- [x] Guias de prescrição com CID-10
- [x] Bulário clínico
- [x] Testes automatizados de regressão (billing, rate limit, rotas e score)
- [ ] Interações medicamentosas no bulário
- [ ] Alertas por contraindicação/comorbidade
- [ ] Exportação PDF
- [x] Gestão de conta no perfil (exportar dados, excluir conta, editar preferências, cancelar assinatura)
- [ ] Controles avançados de privacidade (consentimentos granulares, histórico de pagamentos/recibos)

## Aviso Clínico

O Minha Anamnese é uma ferramenta de apoio à escrita e revisão clínica. Todo conteúdo gerado deve ser revisado por profissional habilitado antes de uso assistencial. O sistema não substitui julgamento clínico, diretrizes locais, bula oficial, prescrição médica individualizada ou prontuário institucional.

## Licença

MIT

# Minha Anamnese

Aplicativo web para organizar anamneses médicas com apoio de IA, templates clínicos, análise estrutural, guias de prescrição, bulário clínico, ferramentas de avaliação (scores, manobras, exames) e programa de afiliados. O foco do produto é acelerar a escrita clínica sem substituir julgamento médico, prontuário oficial ou revisão profissional.

## Visão Geral

O Minha Anamnese é composto por:

- Frontend React/Vite com workspace clínico, templates, evolução, prescrições, bulário, ferramentas de avaliação e perfil.
- Backend Node.js/Express com rotas de IA, autenticação via Supabase, sincronização com Notion, checkout, afiliados e métricas.
- Supabase para autenticação, perfis, planos, templates, prompts oficiais, guias de prescrição, bulário, ferramentas clínicas, afiliados e logs de uso.
- Notion como CMS editorial para templates, prompts, protocolos de prescrição, bulário, ferramentas clínicas, manobras de exame físico, exames complementares, frases prontas e modelos de carta.
- Um pipeline de automação por IA que gera e corrige boa parte desse conteúdo editorial diretamente no Notion, sob revisão humana antes de publicar.
- OpenAI para organização de anamnese, insights estruturais, hipóteses diagnósticas, cartas de encaminhamento e geração/correção de conteúdo editorial.
- Mercado Pago para checkout e liberação de plano profissional.

## Funcionalidades

**Anamnese e escrita clínica**
- Organização de anamneses com IA a partir de templates clínicos oficiais ou personalizados.
- Prompts por categoria clínica, permitindo vincular templates e prompts por `category_key`.
- Score estrutural da anamnese com seções ausentes, evidências, lacunas e acompanhamento de evolução.
- Cartas de encaminhamento e outros documentos geradas com IA, com modelos de carta oficiais e próprios.
- Sugestão de hipóteses diagnósticas para usuários profissionais, com evidências, dados ausentes, diferenciais, sinais de alerta e busca de CID-10 associada.
- Frases prontas (oficiais e próprias) para agilizar trechos recorrentes da anamnese.
- Autocomplete textual de medicamentos na anamnese com chips de consulta rápida.
- Templates próprios para usuários, com qualidade avaliada por IA.

**Avaliação clínica**
- Scores, calculadoras e questionários clínicos por especialidade (ex.: HEART, Wells, CHA2DS2-VASc, CKD-EPI, M-CHAT-R/F, calendário vacinal, marcos do desenvolvimento infantil, roteiro de pré-natal).
- Motor de checklist condicional por eixo (idade, idade gestacional etc.): itens só aparecem quando fazem sentido para o valor do eixo, e a ausência só vira alerta quando já deveria estar presente — evita falso positivo por perguntar algo fora de hora.
- Manobras de exame físico e exames complementares como cartões de referência rápida durante o atendimento.
- Busca de CID-10 pelo termo que o médico usa no dia a dia (sinônimos curados + parecença por trigrama + expansão por IA como último recurso), com código sempre oriundo da tabela oficial do DATASUS.

**Prescrição e farmácia**
- Guias de prescrição por patologia, com CID-10 principal e CID-10 por opção quando preenchidos.
- Bulário clínico com busca por princípio ativo, nome comercial, classe/categoria e tags.

**Conta e produto**
- Onboarding de boas-vindas, trial profissional e paywall.
- Perfil com dados de plano, preferências, exportação/exclusão de conta e cancelamento de assinatura.
- Programa de afiliados: código de indicação com desconto, comissão configurável por afiliado, saldo e solicitação de saque.

**Operação**
- Sincronização administrativa com Notion para templates, prompts, prescrições, bulário, ferramentas clínicas, manobras, exames, frases prontas e modelos de carta.
- Pipeline de automação por IA que gera/corrige esse conteúdo editorial no Notion (bulário, exames, manobras, protocolos de prescrição, ferramentas clínicas), sempre atrás de um portão de revisão/validação antes de publicar.

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
- O backend canônico fica no Render (`backend/server.js`). Todas as rotas de IA (`/organizar`, `/insights`, `/diagnostic-hypotheses`, `/referral-letter`, geração/correção de conteúdo editorial) rodam exclusivamente nele, pois podem exceder o timeout de functions serverless.
- O diretório `api/` na raiz expõe os mesmos handlers como functions da Vercel. Ele é um fallback opcional apenas para rotas GET de leitura (templates, bulário, prescrições, ferramentas clínicas), ativado no frontend via `VITE_API_FALLBACK_URL`. Sem essa variável, o fallback fica desativado.

### Cold start do Render (plano free)

O Render hiberna o backend após ~15 minutos ocioso. Duas mitigações:

1. O frontend dispara um `GET /api/health` em background assim que o app carrega (`frontend/src/lib/backendWarmup.js`), acordando o backend enquanto o usuário digita.
2. Um ping externo em `GET /api/health` a cada 10 minutos mantém o backend quente 24/7. O workflow do n8n está versionado em `tools/n8n/keep-warm-render.json` (importar e ativar — instruções em `tools/n8n/README.md`).

Atenção ao teto de 750h/mês do plano free do Render: o ping 24/7 mantém o serviço acordado ~730h, cabendo nas 750h com margem estreita. Se precisar de folga (ex.: um segundo serviço free), restrinja o Schedule Trigger ao horário de uso.

## Estrutura

```text
backend/
  apiHandlers/        Rotas HTTP organizadas por domínio (ver backend/apiHandlers/index.js para a lista completa)
  services/           Regras de negócio, Supabase, Notion, OpenAI e os orquestradores de automação editorial
  contracts/          Contratos/gates de status de cada automação editorial (o que pode e não pode ser escrito sozinho)
  prompts/            Prompts locais de fallback
  templates/          Templates de e-mail/documento
  data/               Dados locais de apoio (dicionário de sinônimos de CID-10, planilha de medicamentos, auditoria)
  utils/              Score, sanitização, autenticação e limites
  scripts/            Scripts de avaliação manual (evals de anamnese e hipóteses diagnósticas)
  server.js           App Express

frontend/src/
  components/         Telas e componentes do workspace
  hooks/              Hooks de UI e domínio (CID-10, hipóteses diagnósticas, menções de medicamento)
  lib/                Cliente Supabase, motor de checklist das ferramentas clínicas, warmup do backend
  data/               Dados locais de fallback
  apiClient.js        Cliente HTTP do backend

supabase/
  *.sql               Tabelas, migrações manuais, RLS e backfills

tools/n8n/
  *.json              Workflows de operação (keep-warm, saques de afiliado, painel de manobras/exames)

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

Há um `.env.example` em `frontend/` e outro em `backend/` para copiar como ponto de partida. O do backend cobre a maior parte das variáveis (mais de 40, incluindo um secret de sync por base editorial), mas fica desatualizado com a mesma facilidade que este README — hoje faltam nele, por exemplo, as data sources e os secrets de ferramentas clínicas, manobras e exames. Na dúvida, o nome exato da variável está em `process.env.NOME_AQUI` no arquivo do serviço correspondente.

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
NOTION_CLINICAL_TOOLS_DATA_SOURCE_ID=
NOTION_MANEUVERS_DATA_SOURCE_ID=
NOTION_EXAMS_DATA_SOURCE_ID=
NOTION_SNIPPETS_DATA_SOURCE_ID=
NOTION_LETTER_MODELS_DATA_SOURCE_ID=

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
PAYOUT_ACTION_SECRET=
```

`ANALYSIS_ENGINE` controla o motor da avaliação estrutural: use `unified_ai` para a análise única por IA ou `legacy` para voltar ao score determinístico anterior com interpretação por IA.

`RATE_LIMIT_STORE` controla onde os contadores de rate limit vivem: por padrão usa o Supabase (tabela `rate_limit_buckets`, compartilhada entre instâncias — requer `supabase/rate_limits.sql` aplicado) com fallback automático para memória; use `memory` para forçar apenas o fallback por processo.

`ADMIN_SYNC_SECRET` também serve como fallback para os secrets específicos de cada sync/automação (ex.: `CLINICAL_TOOLS_SYNC_SECRET`/`FERRAMENTAS_SYNC_SECRET`, `SNIPPET_SYNC_SECRET`, `LETTER_MODELS_SYNC_SECRET`, `PROTOCOL_AUTOMATION_SECRET`, `CLINICAL_DRUG_AUTOMATION_SECRET`) e para `PAYOUT_ACTION_SECRET` quando este não estiver setado — cada handler em `backend/apiHandlers/admin/` lista os nomes exatos que aceita no topo do arquivo.

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

Cobrem hipóteses diagnósticas, planos de cobrança, rate limit, roteamento da API, score estrutural, controle de acesso/plano, ferramentas clínicas (checklist condicional) e programa de afiliados. Rodar antes de qualquer commit que toque o backend.

## Rotas e Fluxos Principais

A lista completa de rotas (mais de 60, incluindo automação editorial por domínio) vive em `backend/apiHandlers/index.js` — esta seção cobre só os fluxos centrais e os que têm um comportamento não óbvio.

**Anamnese e IA**
- `POST /api/organizar`: organiza a anamnese com IA.
- `POST /api/insights`: gera análise estrutural e score.
- `POST /api/referral-letter`: gera carta de encaminhamento.
- `POST /api/diagnostic-hypotheses`: sugere hipóteses diagnósticas a partir da anamnese organizada para usuários profissionais.
- `GET /api/templates`: lista templates oficiais e do usuário.

**Conteúdo de apoio (Pro)**
- `GET /api/prescription-guides`: lista guias de prescrição publicados.
- `GET /api/clinical-drugs`: lista medicamentos do bulário clínico.
- `GET /api/clinical-tools`: lista/detalha ferramentas de avaliação (scores, calculadoras, checklists condicionais); aceita `?slugs=a,b,c` para resolver várias de uma vez (usado pelos vínculos ferramenta↔modelo).
- `GET /api/physical-exam-maneuvers`, `GET /api/diagnostic-exams`: manobras de exame físico e exames complementares.
- `GET /api/cid10`: busca de CID-10 com sinônimos, parecença e expansão por IA.
- `GET /api/snippets`, `GET /api/letter-models`: frases prontas e modelos de carta (oficiais + próprios).

**Conta e cobrança**
- `GET /api/account/export`: exporta os dados do usuário em JSON (portabilidade LGPD).
- `POST /api/account/delete`: exclui a conta (cancela assinatura, apaga perfil e anamneses; auditoria financeira é anonimizada por `SET NULL`). Exige reenvio do e-mail da conta em `confirmEmail`.
- `POST /api/create-checkout`: cria checkout no Mercado Pago (aplica desconto de afiliado quando houver).
- `POST /api/reconcile-subscription`: confirma ativamente uma assinatura ao voltar do checkout, sem depender do webhook (ver aviso abaixo).
- `POST /api/cancel-subscription`: cancela a próxima cobrança da assinatura (acesso já pago continua até o fim do período).
- `POST /api/webhook/mercadopago`: recebe confirmação de pagamento (assinado por HMAC).

**Afiliados**
- `GET /api/affiliate`: dados do afiliado, saldos e histórico de saques.
- `GET /api/affiliate/lookup?code=...`: consulta pública de código de indicação (desconto para exibição).
- `POST /api/affiliate/payouts`: afiliado solicita saque das comissões disponíveis.
- `GET /api/affiliate-payout-action`: confirma baixa de saque via link assinado (usado pela notificação de WhatsApp).
- `POST /api/admin/affiliates/update`: ajusta comissão/desconto/status de um afiliado (bearer `ADMIN_SYNC_SECRET`).
- `POST /api/admin/affiliate-payouts/settle`: dá baixa em um saque após a transferência (bearer `ADMIN_SYNC_SECRET`).

**Administração / sync / automação**
- `POST /api/admin/{templates,prompts,prescription-guides,clinical-drugs,clinical-tools,snippets,letter-models,physical-exam-maneuvers,diagnostic-exams}/sync`: puxa a base do Notion e grava no Supabase (bearer secret por domínio, com fallback em `ADMIN_SYNC_SECRET`).
- `POST /api/webhook/notion/{templates,prescription-guides,snippets,letter-models,clinical-drugs}`: sync automático disparado pelo próprio Notion quando uma página muda (verificado por `NOTION_WEBHOOK_VERIFICATION_TOKEN`), sem precisar chamar o `/sync` manual.
- `POST /api/admin/{clinical-drugs,exams,maneuvers,protocols,clinical-tools}/{automation-run,generate-preview}`: pipeline de automação editorial por IA (ver seção própria abaixo). Bulário, exames e manobras têm ainda `/queue-incomplete`; protocolos têm `/availability-report` e `/recompute-availability` em vez disso.

### ⚠️ Webhook de assinaturas (Preapproval) do Mercado Pago

O Mercado Pago **não usa o `notification_url` enviado na criação da assinatura** para os tópicos `subscription_preapproval` e `subscription_authorized_payment` — diferente do checkout de pagamento único. Esses eventos só chegam se o webhook estiver configurado **a nível de Aplicação** no [painel de desenvolvedor do Mercado Pago](https://www.mercadopago.com.br/developers/panel) (Sua aplicação → Webhooks → apontar para `https://minhaanamnese.onrender.com/api/webhook/mercadopago` e assinar os tópicos de assinatura/pagamentos).

Enquanto isso não estiver configurado (ou como rede de segurança mesmo depois), o retorno do checkout de sucesso chama `POST /api/reconcile-subscription`, que busca ativamente o pagamento da assinatura direto na API do Mercado Pago e roda a mesma lógica de negócio do webhook (upgrade do usuário, comissão do afiliado). Isso cobre o caso do usuário completar o pagamento e voltar ao app; **cobranças recorrentes futuras** (a partir do 2º ciclo, sem o usuário estar no app) continuam dependendo do webhook estar configurado corretamente.

## Pipeline de Automação Editorial (IA)

Boa parte do conteúdo editorial (bulário, exames complementares, manobras de exame físico, protocolos de prescrição, ferramentas clínicas) pode ser gerado e corrigido por IA diretamente no Notion, em vez de escrito manualmente do zero. O padrão se repete em cinco domínios, cada um com seu orquestrador em `backend/services/*AutomationRunner.js` (eles se espelham deliberadamente — uma mudança de comportamento em um provavelmente vale para os outros quatro):

1. A página no Notion tem uma propriedade de status de automação (`a gerar`, `a corrigir`, `erro na automação`, etc.).
2. `POST /api/admin/{domínio}/automation-run` faz o polling: busca páginas nesses status, chama a geração/correção por IA (`generate*`/`correct*`), escreve o resultado de volta no Notion e registra auditoria (`backend/services/automationAuditLog.js`, tabela `protocol_automation_audit`).
3. **O runner nunca publica sozinho.** Cada domínio tem um contrato em `backend/contracts/*.js` que trava esse limite — para a maioria, a automação só deixa o conteúdo pronto para revisão humana; para ferramentas clínicas, existe ainda um portão de validação de schema (`clinicalTools.js`/`validateClinicalToolSchema`) que pode **reprovar** a geração, escrevendo os erros numa propriedade "Erros de validação" em vez do conteúdo — publicar uma calculadora que não valida nunca é um desfecho possível.
4. Em erro, a página é marcada como "erro na automação" para não reprocessar em loop.

Acionamento: rota admin (bearer secret) chamada manualmente, por cron externo, ou pelo painel n8n em `tools/n8n/catalogs-panel-form.json` (hoje cobre manobras e exames, rodável do celular).

## Sincronização com Notion

As bases editoriais vivem no Notion. Existem dois caminhos para o conteúdo chegar ao Supabase:

- **Sync manual**, disparado por você: `POST /api/admin/{domínio}/sync`, protegido por bearer token.
- **Sync automático**, disparado pelo próprio Notion via webhook quando uma página muda: `POST /api/webhook/notion/{domínio}` (hoje disponível para templates, guias de prescrição, frases prontas, modelos de carta e bulário), verificado por `NOTION_WEBHOOK_VERIFICATION_TOKEN`.

Exemplos de sync manual em PowerShell:

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

Invoke-RestMethod `
  -Method Post `
  -Uri "https://minhaanamnese.onrender.com/api/admin/clinical-tools/sync" `
  -Headers @{ Authorization = "Bearer SEU_SECRET" }

Invoke-RestMethod `
  -Method Post `
  -Uri "https://minhaanamnese.onrender.com/api/admin/physical-exam-maneuvers/sync" `
  -Headers @{ Authorization = "Bearer SEU_SECRET" }

Invoke-RestMethod `
  -Method Post `
  -Uri "https://minhaanamnese.onrender.com/api/admin/diagnostic-exams/sync" `
  -Headers @{ Authorization = "Bearer SEU_SECRET" }

Invoke-RestMethod `
  -Method Post `
  -Uri "https://minhaanamnese.onrender.com/api/admin/snippets/sync" `
  -Headers @{ Authorization = "Bearer SEU_SECRET" }

Invoke-RestMethod `
  -Method Post `
  -Uri "https://minhaanamnese.onrender.com/api/admin/letter-models/sync" `
  -Headers @{ Authorization = "Bearer SEU_SECRET" }
```

Depois de sincronizar uma ferramenta clínica nova, se ela estiver vinculada a algum modelo (`metadata.linkedTools` em `official_templates`), rode também o sync de templates — os chips de "ferramentas relacionadas" resolvem os slugs contra a tabela `clinical_tools`, então a ordem importa: ferramentas antes de templates.

## Supabase

Os arquivos SQL ficam em `supabase/` e devem ser aplicados manualmente no SQL Editor quando necessário — **nunca automatizados**. Principais tabelas, por domínio:

**Conta e produto**
- `profiles`: perfil, plano, trial, onboarding e preferências. Único caminho de escrita é o backend via service role — não deve existir policy de INSERT/UPDATE direto para `anon`/`authenticated` (ver `security_rls.sql` e `profiles_restrict_direct_writes.sql`).
- `anamneses`: histórico e métricas de análises.
- `usage_logs` / `events`: auditoria, telemetria de uso do trial e eventos de funil.
- `rate_limit_buckets`: contadores de rate limit compartilhados entre instâncias.

**Conteúdo editorial (Notion → Supabase)**
- `official_templates` / `user_templates`: templates oficiais e próprios (`user_templates.enrichment` guarda metadados por seção gerados por IA para elevar a qualidade dos templates próprios).
- `official_prompts`: prompts oficiais por categoria clínica.
- `prescription_guides` / `prescription_guide_items`: protocolos de prescrição.
- `clinical_drugs`: bulário clínico.
- `clinical_tools`: scores, calculadoras e checklists condicionais (motor descrito na seção de Ferramentas Clínicas).
- `physical_exam_maneuvers` / `diagnostic_exams`: manobras de exame físico e exames complementares.
- `official_snippets` / `user_snippets`: frases prontas oficiais e próprias.
- `official_letter_models` / `user_letter_models`: modelos de carta oficiais e próprios.
- `cid10_codes`: tabela oficial do DATASUS usada na busca de CID-10.
- `unmatched_diagnostic_hypotheses` / `unmatched_diagnostic_exams` / `unmatched_physical_exam_maneuvers`: backlog editorial do que a IA sugeriu e não tinha correspondência publicada.
- `protocol_automation_audit`: auditoria do pipeline de automação editorial (todos os domínios).

**Cobrança e afiliados**
- `billing_payments` / `billing_subscriptions`: pagamentos e assinaturas do Mercado Pago.
- `affiliates` / `affiliate_commissions` / `affiliate_attributions` / `affiliate_commission_limits`: programa de afiliados, com comissão e desconto por afiliado.
- `affiliate_payouts`: saques de comissão com baixa manual.
- `affiliate_commission_clawbacks`: estorno de comissão em caso de reembolso/chargeback.

## Ferramentas Clínicas (Avaliação)

A página "Avaliação" reúne três tipos de conteúdo, todos editoriais (Notion → `clinical_tools`, `physical_exam_maneuvers`, `diagnostic_exams`) e filtráveis por especialidade/tipo:

- **Scores, calculadoras e questionários** (`tool_type`: soma de pontos, fórmula matemática ou lógica condicional).
- **Manobras de exame físico** e **exames complementares**, como cartões de referência rápida.

O motor de lógica condicional (`frontend/src/lib/clinicalChecklist.js` + normalização em `backend/services/clinicalTools.js`) suporta um **checklist condicional por eixo**: a ferramenta declara um campo-eixo (`engineConfig.axisFieldId`, ex.: idade em meses, idade gestacional em semanas) e cada item pode ter `applicableFrom`/`applicableUntil` (janela em que aparece) e `alertFrom` (a partir de quando a ausência vira alerta de verdade, e não só "ainda não era esperado"). Isso é o que evita, por exemplo, cobrar de uma criança de 4 meses um marco de desenvolvimento esperado só aos 9. Campos opcionais adicionais: `domain` (agrupa a exibição do resultado por categoria, sem afetar o cálculo) e `showAnswer` (registra a resposta junto do rótulo no texto copiado, para itens onde "ausente" não é auto-explicativo, como sinais de alerta obstétricos). Ferramentas sem esses campos continuam funcionando exatamente como um score de soma simples.

Modelos oficiais podem sugerir ferramentas relacionadas via `metadata.linkedTools` (array de slugs) em `official_templates`, editado no Notion (propriedade "Linked tools") e exibido como chips na Home e na galeria de Modelos.

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
- Templates oficiais: `backend/services/officialTemplates.js`; templates próprios e sua avaliação de qualidade: `backend/services/userTemplates.js`
- Prompts oficiais por categoria: `backend/services/officialPrompts.js`
- Guias de prescrição: `backend/services/prescriptionGuides.js`
- Bulário clínico: `backend/services/clinicalDrugs.js`
- Ferramentas clínicas e motor de checklist condicional: `backend/services/clinicalTools.js` + `frontend/src/lib/clinicalChecklist.js`
- Busca de CID-10 (sinônimos, trigrama, expansão por IA): `backend/services/cid10.js`, `cid10SynonymDictionary.js`, `cid10QueryExpansionAi.js`
- Pipeline de automação editorial por IA: `backend/services/*AutomationRunner.js` (um por domínio) + contratos em `backend/contracts/`
- Controle de acesso/plano: `backend/services/accessState.js` — **única fonte de verdade para acesso Pro é `profiles.current_plan`/`billing_status` gravados pelo backend; nunca confiar em `user_metadata` do Supabase Auth, que o próprio usuário pode alterar**; telemetria do trial: `backend/services/trialUsage.js`
- Programa de afiliados: `backend/services/affiliates.js`, `affiliatePayouts.js`

## Boas Práticas do Projeto

- Não usar este produto como prontuário oficial.
- Não inserir dados identificáveis do paciente, como nome completo, CPF, endereço ou telefone.
- Conferir dose, alergias, contraindicações, idade, peso, gestação, função renal/hepática e protocolo local antes de prescrever.
- Tratar hipóteses geradas como apoio ao raciocínio, nunca como diagnóstico confirmado ou substituto da avaliação profissional.
- Manter dados editoriais publicados no Notion apenas após revisão adequada.
- Rodar `npm run build` no frontend antes de publicar alterações de UI.
- Para mudanças de banco, criar SQL idempotente em `supabase/` e aplicar manualmente.
- O frontend nunca deve escrever direto numa tabela do Supabase (`supabase.from(...)`) — toda escrita passa pela API, que usa a service role. Isso é o que faz o RLS do banco valer como segunda camada de defesa em vez de depender só do código do handler.

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
- [x] Ferramentas clínicas (scores, calculadoras, checklists condicionais, manobras, exames)
- [x] Programa de afiliados
- [x] Pipeline de automação editorial por IA com portão de revisão
- [x] Testes automatizados de regressão (billing, rate limit, rotas, score, acesso/plano, ferramentas clínicas)
- [ ] Interações medicamentosas no bulário
- [ ] Alertas por contraindicação/comorbidade
- [ ] Exportação PDF
- [x] Gestão de conta no perfil (exportar dados, excluir conta, editar preferências, cancelar assinatura)
- [ ] Controles avançados de privacidade (consentimentos granulares, histórico de pagamentos/recibos)

## Aviso Clínico

O Minha Anamnese é uma ferramenta de apoio à escrita e revisão clínica. Todo conteúdo gerado deve ser revisado por profissional habilitado antes de uso assistencial. O sistema não substitui julgamento clínico, diretrizes locais, bula oficial, prescrição médica individualizada ou prontuário institucional.

## Licença

MIT

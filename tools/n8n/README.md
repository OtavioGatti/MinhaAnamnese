# Workflows de n8n do Minha Anamnese

Este diretório reúne os workflows de n8n usados pela operação do produto:

- `keep-warm-render.json` — mantém o backend do Render acordado (ver seção abaixo).
- `affiliate-payout-whatsapp.json` — avisa o dono no WhatsApp quando um afiliado solicita saque.
- `affiliate-payout-settle-form.json` — "painel" (formulário hospedado) para dar baixa nos saques.

---

# Keep-warm do backend (Render) via n8n

O backend no Render (plano free) hiberna após ~15 minutos ocioso e leva ~50s para
religar. Este workflow mantém o serviço quente pingando `GET /api/health` a cada
10 minutos, 24/7.

## Arquivo

- `keep-warm-render.json` — workflow importável: **Schedule Trigger (10 min)** → **HTTP Request GET `/api/health`**.

## Como importar

1. No n8n: **Workflows → Add workflow → ⋯ (menu) → Import from File** e selecione `keep-warm-render.json`
   (ou **Import from URL** apontando para o arquivo no GitHub).
2. Abra o nó **Ping /api/health** e confirme a URL do seu backend no Render
   (padrão: `https://minhaanamnese.onrender.com/api/health`).
3. **Ative** o workflow (toggle no topo direito). Só workflows ativos rodam no agendador.

## Ajustes

- **Intervalo**: 10 min dá margem contra pings atrasados/falhos (o limite de sono é 15 min).
  Para reduzir execuções, aumente para 13–14 min no nó *A cada 10 minutos*.
- **Cota de execuções do n8n**: 10 min ≈ 4.320 execuções/mês. Se o seu plano do n8n
  limitar execuções mensais, use 13–14 min (~3.100/mês) ou restrinja o horário.
- **Cota do Render**: 24/7 consome ~730h das 750h/mês do plano free (margem estreita).
  Se precisar de folga, limite o Schedule Trigger ao horário de uso.

## Verificação

Após ativar, rode uma vez manualmente (**Execute Workflow**) e confira no nó HTTP a
resposta `{ "success": true, "data": { "status": "ok" } }` com status 200.

---

# Notificação de saque de afiliado (WhatsApp via CallMeBot)

Quando um afiliado solicita saque (`POST /api/affiliate/payouts`), o backend chama
`AFFILIATE_PAYOUT_WEBHOOK_URL` (best-effort — se falhar, o pedido continua salvo no
Supabase). Este workflow recebe esse aviso e manda uma mensagem para o seu WhatsApp
via [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/), que é
gratuito e não exige servidor extra.

## Arquivo

- `affiliate-payout-whatsapp.json` — **Webhook (POST)** → **Code (monta a mensagem)** → **HTTP Request GET (CallMeBot)**.

## Passo 1 — Ativar o CallMeBot no seu WhatsApp (2 min)

1. No celular, adicione o número do CallMeBot aos contatos: **+34 644 51 95 23**.
2. Pelo WhatsApp, mande para esse contato exatamente esta mensagem:
   `I allow callmebot to send me messages`
3. Em alguns minutos você recebe uma resposta do bot com sua **API Key** (um número).
   Guarde essa chave e o seu número de telefone completo com DDI (ex.: `5511999999999`,
   sem `+`, sem espaços).

Se não receber resposta em ~10 min, reenvie a mensagem — o serviço processa em lote.

## Passo 2 — Importar e configurar o workflow no n8n

1. No n8n: **Workflows → Add workflow → ⋯ (menu) → Import from File** e selecione
   `affiliate-payout-whatsapp.json` (ou **Import from URL** apontando para o arquivo no GitHub).
2. Abra o nó **Enviar WhatsApp (CallMeBot)** e, nos **Query Parameters**, preencha:
   - `phone` → seu número com DDI (ex.: `5511999999999`)
   - `apikey` → a API Key que o CallMeBot te enviou
   - `text` → deixe como está (`={{ $json.message }}`, já vem pronto)
3. **Ative** o workflow (toggle no topo direito).
4. Abra o nó **Webhook - Saque solicitado** e copie a **Production URL** (com o workflow
   ativo, o n8n mostra essa URL — algo como `https://SEU_N8N/webhook/affiliate-payout-notify`).

## Passo 3 — Configurar a URL no Render

1. Acesse o [painel do Render](https://dashboard.render.com) → seu serviço de backend
   (`minha-anamnese-backend`) → aba **Environment**.
2. Clique em **Add Environment Variable**:
   - **Key**: `AFFILIATE_PAYOUT_WEBHOOK_URL`
   - **Value**: a Production URL copiada no passo anterior.
3. Salve. O Render faz redeploy automático ao salvar uma env var.

## Passo 4 — Testar de ponta a ponta

**Teste rápido do workflow (sem mexer no app):** no n8n, com o workflow aberto, clique
em **Execute workflow** e envie manualmente um POST ao webhook (via `curl`/Postman) com
este corpo de exemplo:

```bash
curl -X POST "https://SEU_N8N/webhook/affiliate-payout-notify" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "affiliate_payout_requested",
    "payout_id": "00000000-0000-0000-0000-000000000000",
    "affiliate_code": "teste",
    "amount": 89.91,
    "currency_id": "BRL",
    "pix_key": "teste@example.com",
    "requested_at": "2026-07-05T12:00:00.000Z"
  }'
```

Se a mensagem chegar no seu WhatsApp, está tudo certo.

**Teste real:** peça para um afiliado de teste (ou você mesmo, com uma segunda conta)
clicar em **Solicitar saque** na tela de Afiliados. Se `AFFILIATE_PAYOUT_WEBHOOK_URL`
estiver configurada no Render, a notificação chega automaticamente.

## Limitações do CallMeBot

- Gratuito, mas com limite informal de uso (não é para disparo em massa) — aqui o volume
  é baixíssimo (1 notificação por pedido de saque), então não há risco.
- Só envia para o número que autorizou o bot (o seu). Não serve para notificar terceiros.
- Se quiser algo mais robusto no futuro (Twilio, Evolution API/WAHA), basta trocar o nó
  **Enviar WhatsApp (CallMeBot)** por outro — o resto do workflow (webhook + mensagem) continua igual.

---

# Painel de baixa de saques (n8n Form)

Um formulário hospedado pelo próprio n8n que funciona como um mini-painel: você
abre o link (dá pra salvar no celular), cola o ID do saque que chegou no WhatsApp,
escolhe **paid** (pago) ou **rejected** (rejeitado) e envia. Por baixo, ele chama
`POST /api/admin/affiliate-payouts/settle`, que faz a baixa correta (cascade nas
comissões) — nunca edite o status direto no Supabase.

## Arquivo

- `affiliate-payout-settle-form.json` — **Form Trigger** → **HTTP Request POST (API admin)**.

## Pré-requisito

O endpoint admin exige o segredo `ADMIN_SYNC_SECRET` configurado no Render (aba
Environment). Se ainda não existir, crie um valor forte e adicione lá.

## Configurar

1. Importe `affiliate-payout-settle-form.json` no n8n (**Import from File**).
2. Abra o nó **Baixar saque (API admin)** → em **Header Parameters**, no campo
   `Authorization`, troque `SEU_ADMIN_SYNC_SECRET` pelo valor real (mantenha o
   prefixo `Bearer `). Confirme a URL do backend.
3. **Ative/Publique** o workflow e copie a **Production URL** do formulário
   (aba do nó Form Trigger). Salve esse link — é o seu painel.

## Usar (fluxo completo)

1. Afiliado solicita saque → você recebe no WhatsApp o valor, a chave PIX e o
   **ID do saque**.
2. Faça o PIX manualmente para a chave informada.
3. Abra o link do formulário, cole o **payout_id**, escolha **paid** e envie.
   O saldo do afiliado zera e o histórico marca "Pago".
   - Para recusar um pedido, escolha **rejected** — o saldo volta para o afiliado.

O formulário mostra a resposta da API (sucesso ou erro) na própria tela após enviar.

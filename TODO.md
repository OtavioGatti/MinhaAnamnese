# Pendências

## Conversão do Google Ads para pix/boleto (server-side)

**Status: bloqueado por credencial. Não implementar antes de resolver o pré-requisito abaixo.**

### O que já existe (Fase 1, implementada)

Conversão de **cadastro confirmado**, client-side, em `frontend/src/lib/googleAdsConversion.js`.
Dispara quando o usuário volta do link de confirmação de e-mail, uma vez por
usuário (`transaction_id` = id do Supabase). A tag roda sitewide para gravar o
cookie `_gcl_aw` no clique do anúncio.

### O que falta e por quê

Conversão de **compra** por pix/boleto não pode usar `gtag` no navegador. Esses
pagamentos confirmam de forma assíncrona, via webhook assinado do Mercado Pago
(`backend/apiHandlers/webhook/mercadopago.js`), muitas vezes com o usuário já
fora do site — não há página aberta para disparar o evento.

O caminho correto é **Click Conversion Upload** pela Google Ads API, a partir do
servidor.

### Pré-requisito não atendido

- **Developer Token** da conta do Google Ads (solicitado no painel, passa por
  aprovação do Google).
- **Credencial OAuth** de API (client id/secret + refresh token).

Sem os dois, não há como chamar a API. Resolver isso antes de qualquer código.

### O que precisa ser feito quando a credencial existir

1. **Capturar e persistir o `gclid`.** O upload server-side exige o `gclid` do
   clique original — o servidor não tem acesso ao cookie `_gcl_aw` do navegador.
   Envolve:
   - Ler `gclid` da URL no frontend e guardar em chave própria de `localStorage`,
     seguindo o mesmo padrão de `AFFILIATE_REFERRAL_KEY` em `App.jsx`.
     **Atenção:** `ref=` (afiliado) e `gclid` são rastreios independentes e
     precisam conviver na mesma URL sem um sobrescrever o outro — cada um com
     sua própria chave e sua própria leitura.
   - Enviar o `gclid` no `metadata` do checkout (`create-checkout.js` já manda
     metadata para o Mercado Pago) e persistir em coluna nova de
     `billing_payments` (SQL idempotente em `supabase/`, aplicação manual).
   - **Isso é coleta de dado, não depende da credencial.** Enquanto não for
     feito, todo pagamento por pix/boleto perde o `gclid` de forma irrecuperável
     — não dá para reconstruir depois.

2. **Disparar o upload no webhook.** Em `handlePaymentWebhook`
   (`backend/apiHandlers/webhook/mercadopago.js`), depois da confirmação de
   pagamento aprovado (`isApprovedPlanPayment`) e antes do retorno.
   - Reaproveitar o guard de idempotência que já existe: `processed_at` em
     `billing_payments` só é carimbado no fim do fluxo bem-sucedido, então
     webhooks repetidos do Mercado Pago não reenviam a conversão.
   - Usar `payment_id` do Mercado Pago como identificador da conversão. Não usar
     `preapproval_id`: ele identifica a assinatura, repetiria entre as cobranças
     mensais e deduplicaria vendas distintas por engano.
   - Valor da conversão: `payment.transaction_amount` (valor real cobrado, já com
     desconto de afiliado aplicado), nunca o preço de tabela de `billingPlans.js`.
   - Falha no upload não pode derrubar o webhook: seguir o padrão best-effort com
     log que o resto do arquivo já usa.

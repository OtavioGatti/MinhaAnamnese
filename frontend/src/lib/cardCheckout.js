// Assinatura mensal com o cartão digitado na nossa página (Card Payment Brick
// do Mercado Pago), em vez de mandar a pessoa para a página do Mercado Pago —
// que exige login ou conta MP para autorizar a cobrança recorrente. O número do
// cartão fica no formulário do Mercado Pago e vira um token lá mesmo; só o
// token chega ao nosso servidor.
//
// A lógica pura fica aqui (testada pelo backend); o carregamento do script do
// Mercado Pago é a única parte que mexe no DOM.

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';

// Liga o checkout novo só neste navegador, para testar em produção antes de
// abrir para todo mundo: ?checkout_cartao=1 liga, ?checkout_cartao=0 desliga.
export const CARD_CHECKOUT_OVERRIDE_KEY = 'minha-anamnese:checkout-cartao';
const PARAMETRO_DE_TESTE = 'checkout_cartao';

/**
 * Se o checkout com cartão na página vale para este navegador.
 * Devolve também o valor a guardar do teste manual (null = apagar).
 */
export function resolveCardCheckoutEnabled({ flag, publicKey, search = '', stored = null }) {
  const parametro = new URLSearchParams(search).get(PARAMETRO_DE_TESTE);
  let guardado = stored === '1' ? '1' : null;

  if (parametro === '1') {
    guardado = '1';
  } else if (parametro === '0') {
    guardado = null;
  }

  // Sem chave pública o formulário do Mercado Pago nem abre.
  const enabled = Boolean(publicKey) && (flag === 'on' || guardado === '1');

  return { enabled, stored: guardado };
}

/**
 * O que fazer com a resposta do servidor ao enviar o cartão.
 * - autorizada: assinatura criada; falta a primeira cobrança sair.
 * - checkout_antigo: o servidor desligou o caminho novo; segue pelo Mercado Pago.
 * - ja_assina: já existe assinatura ativa; nada foi cobrado.
 * - recusada: problema no cartão; a pessoa corrige ou troca e tenta de novo.
 * - erro: falha nossa ou do provedor.
 */
export function describeCardCheckoutResult(response) {
  if (response?.success && response.data?.preapproval_id) {
    return { kind: 'autorizada', preapprovalId: response.data.preapproval_id };
  }

  if (response?.code === 'CARD_CHECKOUT_DISABLED') {
    return { kind: 'checkout_antigo' };
  }

  if (response?.code === 'SUBSCRIPTION_ALREADY_ACTIVE') {
    return { kind: 'ja_assina', message: response.error };
  }

  if (response?.status === 422 || String(response?.code || '').startsWith('CARD_')) {
    return {
      kind: 'recusada',
      code: response.code || null,
      // Resposta original do Mercado Pago, curta: só para o painel entender a
      // recusa. Nunca aparece para a pessoa.
      detail: typeof response.detalhe === 'string' ? response.detalhe.slice(0, 100) : null,
      message: response.error || 'Não foi possível confirmar este cartão. Confira os dados ou use outro cartão.',
    };
  }

  if (response?.status === 0) {
    return {
      kind: 'erro',
      message: 'Sem conexão com o servidor. Nenhuma cobrança foi feita; confira sua internet e tente de novo.',
    };
  }

  return {
    kind: 'erro',
    message: response?.error || 'Não foi possível concluir agora. Nenhuma cobrança foi feita; tente de novo em instantes.',
  };
}

// No sandbox (23/09/2026) a primeira mensalidade saiu no mesmo segundo em que
// a assinatura nasceu autorizada, mas a busca de faturas do Mercado Pago levou
// alguns segundos para mostrá-la (a documentação fala em até cerca de uma
// hora). Consulta algumas vezes para liberar o Pro sem a pessoa recarregar;
// depois disso o webhook e o e-mail de boas-vindas cuidam do resto.
// Espera entre consultas (ms); o /reconcile-subscription aceita 10 a cada 10 min.
export const CARD_CONFIRMATION_DELAYS_MS = [4000, 8000, 15000, 30000, 60000];

let carregamentoDoSdk = null;

// Carrega o MercadoPago.js uma vez, só quando alguém abre o pagamento: não
// pesa na página de quem não vai assinar.
export function loadMercadoPagoSdk() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('sem navegador'));
  }

  if (window.MercadoPago) {
    return Promise.resolve(window.MercadoPago);
  }

  if (!carregamentoDoSdk) {
    carregamentoDoSdk = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => (window.MercadoPago ? resolve(window.MercadoPago) : reject(new Error('sdk sem MercadoPago')));
      script.onerror = () => {
        carregamentoDoSdk = null;
        script.remove();
        reject(new Error('falha ao carregar o sdk do Mercado Pago'));
      };
      document.head.appendChild(script);
    });
  }

  return carregamentoDoSdk;
}

// Mesmo arredondamento do backend (getDiscountedPlanAmount): só para mostrar.
// Quem decide o valor cobrado é sempre o servidor.
export function estimateMonthlyCharge(price, discountRate) {
  const rate = Number(discountRate) || 0;

  if (!(rate > 0)) {
    return Number(price) || 0;
  }

  return Math.round(Number(price) * (1 - rate) * 100) / 100;
}

// O Pro pago está liberado? Vem do servidor (profiles.current_plan /
// billing_status); o frontend nunca decide acesso sozinho.
export function isPaidAccessConfirmed(profile) {
  return Boolean(profile?.access_state?.isPaidProAccess);
}

// Eventos do checkout: do link do Mercado Pago recebido até a volta de lá.
//
// Sem eles o painel só via o clique em "assinar" e o pagamento; o meio era
// invisível: servidor hibernando, erro ao criar o checkout, gente que chega ao
// Mercado Pago e volta sem pagar. Nada aqui carrega mensagem de erro ou dado da
// pessoa, só tipo, tempo e plano.

// Tempo máximo esperando o registro sair antes de ir para o Mercado Pago: a
// troca de página cancelaria a requisição no meio, e mais que isso atrasaria
// quem quer pagar.
export const CHECKOUT_TRACKING_MAX_WAIT_MS = 800;

const RETORNOS_DO_CHECKOUT = ['success', 'pending', 'failure'];

// Tipo do erro ao criar o checkout, pelo que o apiClient devolve (status 0
// quando nem chegou ao servidor).
export function classifyCheckoutFailure(response) {
  const status = Number(response?.status) || 0;

  if (response?.success && !response?.data?.init_point) {
    return 'sem_link';
  }

  if (status === 0) {
    return 'rede';
  }

  if (status === 400) {
    return 'dados_invalidos';
  }

  if (status === 401 || status === 403) {
    return 'sessao';
  }

  if (status === 429) {
    return 'limite';
  }

  if (status === 502 || status === 504) {
    return 'provedor';
  }

  if (status === 503) {
    return 'configuracao';
  }

  return status >= 500 ? 'servidor' : 'desconhecido';
}

// "success?preapproval_id=..." (bug conhecido do retorno de assinatura do
// Mercado Pago) conta como success. Qualquer outro valor não é retorno.
export function normalizeCheckoutReturnStatus(rawStatus) {
  const valor = String(rawStatus || '').trim().toLowerCase();
  const status = valor.startsWith('success') ? 'success' : valor;
  return RETORNOS_DO_CHECKOUT.includes(status) ? status : null;
}

export function waitAtMost(promise, ms = CHECKOUT_TRACKING_MAX_WAIT_MS) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))]);
}

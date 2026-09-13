// Motivo de recusa de pagamento: do código técnico do Mercado Pago
// (`status_detail`) para o que a pessoa entende e o que ela pode fazer.
//
// Existe porque o painel do Mercado Pago só diz "o banco emissor recusou o
// pagamento" (caso real de 13/09/2026), e sem o motivo não dá para saber se o
// problema é limite, antifraude ou dado digitado errado, nem orientar quem
// tentou pagar.
//
// `rotulo` é curto, para o painel do dono. `orientacao` é para quem pagou
// (e-mail e aviso no site): diz o que fazer e não expõe regra de antifraude.

const MOTIVO_NAO_REGISTRADO = 'nao_registrado';

const ANALISE_DE_SEGURANCA = {
  rotulo: 'Recusado na análise de segurança',
  orientacao: 'O pagamento não passou na análise de segurança. Tente com outro cartão.',
};

const MOTIVOS = {
  cc_rejected_insufficient_amount: {
    rotulo: 'Limite insuficiente',
    orientacao: 'O cartão não tinha limite disponível para este valor. Tente outro cartão ou confira o limite no app do banco.',
  },
  cc_rejected_bad_filled_security_code: {
    rotulo: 'Código de segurança incorreto',
    orientacao: 'O código de segurança (CVV) não conferiu. Tente de novo com os números do verso do cartão.',
  },
  cc_rejected_bad_filled_date: {
    rotulo: 'Validade incorreta',
    orientacao: 'A data de validade não conferiu. Tente de novo conferindo o mês e o ano impressos no cartão.',
  },
  cc_rejected_bad_filled_card_number: {
    rotulo: 'Número do cartão incorreto',
    orientacao: 'O número do cartão não conferiu. Tente de novo conferindo os dígitos.',
  },
  cc_rejected_bad_filled_other: {
    rotulo: 'Dados do cartão incorretos',
    orientacao: 'Algum dado do cartão não conferiu. Tente de novo conferindo nome, número, validade e código de segurança.',
  },
  cc_rejected_call_for_authorize: {
    rotulo: 'Banco pediu autorização',
    orientacao: 'O banco pediu que você autorize esta compra. Libere o pagamento no app do banco e tente de novo.',
  },
  cc_rejected_card_disabled: {
    rotulo: 'Cartão não habilitado',
    orientacao: 'O cartão está bloqueado ou não habilitado para compras online. Ative-o no app do banco ou use outro cartão.',
  },
  cc_rejected_high_risk: ANALISE_DE_SEGURANCA,
  cc_rejected_blacklist: ANALISE_DE_SEGURANCA,
  rejected_high_risk: ANALISE_DE_SEGURANCA,
  cc_rejected_max_attempts: {
    rotulo: 'Tentativas demais',
    orientacao: 'Foram muitas tentativas seguidas com este cartão. Aguarde algumas horas ou use outro cartão.',
  },
  cc_rejected_duplicated_payment: {
    rotulo: 'Pagamento duplicado',
    orientacao: 'Já existe um pagamento igual feito há pouco. Confira se ele foi aprovado antes de tentar de novo.',
  },
  cc_rejected_card_error: {
    rotulo: 'Erro ao processar o cartão',
    orientacao: 'Não foi possível processar o cartão agora. Tente de novo em alguns minutos ou use outro cartão.',
  },
  cc_rejected_invalid_installments: {
    rotulo: 'Forma de pagamento não aceita',
    orientacao: 'O cartão não aceita esta forma de pagamento. Tente outro cartão.',
  },
  cc_amount_rate_limit_exceeded: {
    rotulo: 'Limite do cartão para a operação',
    orientacao: 'O valor passou do limite permitido para este cartão. Tente outro cartão.',
  },
  rejected_by_bank: {
    rotulo: 'Recusado pelo banco',
    orientacao: 'O banco recusou o pagamento. Tente outro cartão ou fale com o seu banco.',
  },
  rejected_by_regulations: {
    rotulo: 'Recusado por regra do meio de pagamento',
    orientacao: 'O pagamento não é permitido para este cartão. Tente outro cartão.',
  },
  rejected_insufficient_data: {
    rotulo: 'Dados insuficientes',
    orientacao: 'Faltaram dados para concluir o pagamento. Tente de novo preenchendo todos os campos.',
  },
  cc_rejected_other_reason: {
    rotulo: 'Banco recusou sem informar o motivo',
    orientacao: 'O banco recusou o pagamento sem informar o motivo. Tente outro cartão ou fale com o seu banco.',
  },
};

const MOTIVO_DESCONHECIDO = {
  rotulo: 'Outro motivo',
  orientacao: 'O pagamento não foi aprovado. Tente outro cartão ou fale com o seu banco.',
};

function normalizeStatusDetail(value) {
  const codigo = String(value ?? '').trim().toLowerCase();
  return codigo || null;
}

function describeDeclineReason(statusDetail) {
  const codigo = normalizeStatusDetail(statusDetail);

  // Pagamento gravado antes de o motivo existir: é ausência de medição, e o
  // painel precisa dizer isso em vez de inventar um motivo.
  if (!codigo) {
    return {
      codigo: MOTIVO_NAO_REGISTRADO,
      rotulo: 'Motivo não registrado',
      orientacao: MOTIVO_DESCONHECIDO.orientacao,
    };
  }

  // hasOwnProperty: um código como "constructor" não pode achar o protótipo.
  const motivo = Object.prototype.hasOwnProperty.call(MOTIVOS, codigo)
    ? MOTIVOS[codigo]
    : MOTIVO_DESCONHECIDO;

  return { codigo, ...motivo };
}

module.exports = {
  MOTIVO_NAO_REGISTRADO,
  describeDeclineReason,
  normalizeStatusDetail,
};

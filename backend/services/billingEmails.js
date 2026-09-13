// E-mails de pagamento: boas-vindas, renovação aprovada, pagamento não
// aprovado, assinatura cancelada, acesso pausado e vencimento do semestral.
//
// Textos aprovados pelo dono em 13/09/2026. Decisões que não podem se perder:
// - nenhum e-mail menciona reembolso: isso já está nos termos de uso;
// - renovação recusada e acesso pausado NÃO têm botão de pagar. A assinatura
//   continua ativa no Mercado Pago, que tenta de novo sozinho (até 4 vezes em
//   10 dias), e assinar de novo por um botão geraria cobrança dupla;
// - semestral é pagamento único: sem linha de cancelamento.
//
// Tudo aqui é puro: monta assunto e HTML no molde oficial (emailTemplates.js).
// Quem decide QUANDO enviar é o webhook, o cancelamento e a rotina diária.
// Nenhum valor vem digitado por usuário: datas e valores são formatados aqui e
// os motivos de recusa vêm da tabela fixa de paymentDeclineReasons.js.

const { buildEmailHtml } = require('./emailTemplates');
const {
  MOTIVO_NAO_REGISTRADO,
  describeDeclineReason,
} = require('../utils/paymentDeclineReasons');

const FUSO = 'America/Sao_Paulo';
const DIA_MS = 24 * 60 * 60 * 1000;
const RECURSOS = 'avaliações completas de anamneses, cartas de encaminhamento com IA, guias de prescrição, bulário clínico e templates próprios';
const BOTAO_ABRIR = 'Abrir o Minha Anamnese';

function getAppUrl() {
  return process.env.PUBLIC_APP_URL || 'https://www.minhaanamnese.com.br';
}

// Dia de Brasília: o servidor roda em UTC, e sem o fuso uma cobrança às 22h
// sairia com a data do dia seguinte.
function formatDate(value) {
  if (!value) {
    return null;
  }

  const data = new Date(value);
  return Number.isNaN(data.getTime()) ? null : data.toLocaleDateString('pt-BR', { timeZone: FUSO });
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numero = Number(value);
  return Number.isFinite(numero) ? `R$ ${numero.toFixed(2).replace('.', ',')}` : null;
}

// Linhas "Rótulo: valor". Linha sem valor some, em vez de sair "Próxima
// cobrança: " vazia quando o Mercado Pago não informou a data.
function summaryLines(linhas) {
  return linhas
    .filter(([, valor]) => valor)
    .map(([rotulo, valor]) => `<strong>${rotulo}:</strong> ${valor}`)
    .join('<br>');
}

function withDiscountNote(valor, discounted) {
  return valor && discounted ? `${valor} (com desconto de indicação)` : valor;
}

function openAppButton() {
  return { label: BOTAO_ABRIR, url: getAppUrl() };
}

// 1 e 1b. Primeira cobrança aprovada.
function buildWelcomeEmail({ planKey, amount, discounted = false, nextPaymentDate = null, accessUntil = null }) {
  const semestral = planKey === 'semiannual';
  const valor = withDiscountNote(formatMoney(amount), discounted);
  const paragraphs = [
    'Seu pagamento foi aprovado e o <strong>Plano Profissional</strong> do Minha Anamnese já está ativo na sua conta.',
    `Agora você tem acesso a ${RECURSOS}.`,
  ];

  if (semestral) {
    paragraphs.push(summaryLines([
      ['Plano', 'Semestral'],
      ['Valor', valor],
      ['Pagamento', 'único, sem renovação automática'],
      ['Acesso até', formatDate(accessUntil)],
    ]));
    paragraphs.push('Perto do vencimento a gente te avisa por e-mail, para você decidir se quer renovar.');
  } else {
    paragraphs.push(summaryLines([
      ['Plano', 'Mensal'],
      ['Valor', valor],
      ['Renovação', 'automática, todo mês'],
      ['Próxima cobrança', formatDate(nextPaymentDate)],
    ]));
    paragraphs.push('Cancele quando quiser em <strong>Perfil → Cancelar assinatura</strong>. Seu acesso continua até o fim do período já pago.');
  }

  return {
    kind: semestral ? 'boas_vindas_semestral' : 'boas_vindas_mensal',
    subject: 'Seu Plano Profissional está ativo',
    html: buildEmailHtml({
      heading: 'Bem-vindo ao Plano Profissional 🎉',
      paragraphs,
      button: openAppButton(),
      footerNote: 'Este e-mail confirma a ativação do seu plano. O comprovante do pagamento é enviado pelo Mercado Pago.',
    }),
  };
}

// 2. Renovação mensal aprovada (da segunda cobrança em diante).
function buildRenewalApprovedEmail({ amount, discounted = false, accessUntil = null, nextPaymentDate = null }) {
  return {
    kind: 'renovacao_aprovada',
    subject: 'Pagamento da sua assinatura aprovado',
    html: buildEmailHtml({
      heading: 'Pagamento aprovado ✅',
      paragraphs: [
        'Recebemos o pagamento da renovação do seu <strong>Plano Profissional</strong>. Seu acesso continua ativo.',
        summaryLines([
          ['Valor', withDiscountNote(formatMoney(amount), discounted)],
          ['Acesso até', formatDate(accessUntil)],
          ['Próxima cobrança', formatDate(nextPaymentDate)],
        ]),
        'A assinatura renova automaticamente todo mês. Cancele quando quiser em <strong>Perfil → Cancelar assinatura</strong>; o acesso segue até o fim do período pago.',
      ],
      button: openAppButton(),
      footerNote: 'O comprovante do pagamento é enviado pelo Mercado Pago.',
    }),
  };
}

// 3a e 3b. Pagamento não aprovado.
function buildPaymentRejectedEmail({ amount, statusDetail = null, renewal = false, trialEndsAt = null }) {
  const motivo = describeDeclineReason(statusDetail);
  const valor = formatMoney(amount);
  const complementoValor = valor ? ` (${valor})` : '';
  const paragraphs = [
    renewal
      ? `Tentamos processar a renovação do seu <strong>Plano Profissional</strong>${complementoValor}, mas ela não foi aprovada.`
      : `Tentamos processar o pagamento do seu <strong>Plano Profissional</strong>${complementoValor}, mas ele não foi aprovado.`,
  ];

  // "Motivo não registrado" é rótulo do painel do dono, não texto para cliente.
  if (motivo.codigo === MOTIVO_NAO_REGISTRADO) {
    if (!renewal) {
      paragraphs.push(motivo.orientacao);
    }
  } else if (renewal) {
    // Na renovação a orientação genérica ("tente de novo") empurraria a pessoa
    // a assinar outra vez; o parágrafo seguinte já diz o que fazer.
    paragraphs.push(`<strong>Motivo informado:</strong> ${motivo.rotulo}`);
  } else {
    paragraphs.push(`<strong>Motivo informado:</strong> ${motivo.rotulo}<br>${motivo.orientacao}`);
  }

  const fimDoTeste = formatDate(trialEndsAt);

  if (renewal) {
    paragraphs.push('O Mercado Pago tenta a cobrança de novo automaticamente nos próximos dias. Confira o limite ou a liberação do cartão no app do banco para não interromper seu acesso.');
  } else if (fimDoTeste) {
    paragraphs.push(`Seu teste profissional continua ativo até ${fimDoTeste}, então nada muda por enquanto.`);
  } else {
    paragraphs.push('Você pode tentar de novo com outro cartão quando quiser.');
  }

  return {
    kind: renewal ? 'pagamento_recusado_renovacao' : 'pagamento_recusado',
    subject: 'Não conseguimos processar seu pagamento',
    html: buildEmailHtml({
      heading: 'Seu pagamento não foi aprovado',
      paragraphs,
      button: renewal ? null : { label: 'Tentar de novo', url: getAppUrl() },
      footerNote: renewal ? null : 'Se você já conseguiu pagar com outro cartão, pode ignorar este e-mail.',
    }),
  };
}

// 4. Cancelamento comum (sem estorno), feito pela própria pessoa em Perfil.
function buildSubscriptionCancelledEmail({ accessUntil = null }) {
  const data = formatDate(accessUntil);
  const ate = data ? `até <strong>${data}</strong>` : 'até o fim do período já pago';

  return {
    kind: 'assinatura_cancelada',
    subject: 'Sua assinatura foi cancelada',
    html: buildEmailHtml({
      heading: 'Assinatura cancelada',
      paragraphs: [
        'Confirmamos o cancelamento da renovação automática do seu <strong>Plano Profissional</strong>. Nenhuma nova cobrança será feita.',
        `Seu acesso profissional continua ${ate}. Depois disso, sua conta volta ao plano básico: a organização de anamneses continua gratuita e nada do que você criou é perdido.`,
      ],
      button: openAppButton(),
      footerNote: 'Mudou de ideia? Você pode assinar de novo quando quiser, em Perfil.',
    }),
  };
}

// 7. Acesso mensal venceu sem a renovação ter sido cobrada.
function buildAccessPausedEmail({ accessEndedAt = null }) {
  const data = formatDate(accessEndedAt);

  return {
    kind: 'acesso_pausado',
    subject: 'Não conseguimos renovar sua assinatura',
    html: buildEmailHtml({
      heading: 'Seu acesso profissional foi pausado',
      paragraphs: [
        `Não conseguimos cobrar a renovação do seu <strong>Plano Profissional</strong>, mesmo após novas tentativas, e seu acesso profissional terminou${data ? ` em ${data}` : ''}.`,
        'A organização de anamneses continua gratuita e nada do que você criou foi perdido.',
        'Sua assinatura continua registrada no Mercado Pago, que tenta de novo na próxima data de cobrança. Assim que um pagamento for aprovado, o acesso volta automaticamente. Para ajudar, confira o limite ou a liberação do cartão no app do banco.',
      ],
      button: openAppButton(),
      footerNote: 'Se preferir não continuar, você pode cancelar em Perfil → Cancelar assinatura.',
    }),
  };
}

// 5. Semestral vence em 7 dias (não renova sozinho).
function buildPlanEndingSoonEmail({ expiresAt = null }) {
  const data = formatDate(expiresAt);

  return {
    kind: 'semestral_vencendo',
    subject: 'Seu plano semestral vence em 7 dias',
    html: buildEmailHtml({
      heading: 'Seu plano semestral está terminando ⏳',
      paragraphs: [
        `Seu <strong>Plano Profissional</strong> semestral vence${data ? ` em <strong>${data}</strong>` : ' em breve'}. Como o semestral é um pagamento único, ele não renova sozinho.`,
        `Para continuar com ${RECURSOS}, renove antes do vencimento: os dias que ainda faltam não são perdidos.`,
      ],
      button: { label: 'Renovar o plano', url: getAppUrl() },
      footerNote: 'Se você já renovou, pode ignorar este e-mail.',
    }),
  };
}

// 6. Semestral terminou sem renovação.
function buildPlanExpiredEmail({ expiredAt = null }) {
  const data = formatDate(expiredAt);

  return {
    kind: 'semestral_terminou',
    subject: 'Seu plano semestral terminou',
    html: buildEmailHtml({
      heading: 'Seu plano semestral terminou',
      paragraphs: [
        `Seu <strong>Plano Profissional</strong> semestral terminou${data ? ` em ${data}` : ''}, e sua conta voltou ao plano básico.`,
        'A organização de anamneses continua gratuita e nada do que você criou foi perdido. Se quiser voltar a ter os recursos profissionais, é só renovar.',
      ],
      button: { label: 'Renovar o plano', url: getAppUrl() },
      footerNote: 'Sem pressa: pode renovar quando fizer sentido pra sua rotina.',
    }),
  };
}

// Os 9 modelos com dados de exemplo, para o envio de teste ao dono.
function buildTestEmails(now = new Date()) {
  const daqui = (dias) => new Date(now.getTime() + dias * DIA_MS).toISOString();

  return [
    buildWelcomeEmail({ planKey: 'monthly', amount: 22.41, discounted: true, nextPaymentDate: daqui(30) }),
    buildWelcomeEmail({ planKey: 'semiannual', amount: 129.9, accessUntil: daqui(180) }),
    buildRenewalApprovedEmail({ amount: 22.41, discounted: true, accessUntil: daqui(30), nextPaymentDate: daqui(30) }),
    buildPaymentRejectedEmail({ amount: 22.41, statusDetail: 'cc_rejected_insufficient_amount', trialEndsAt: daqui(7) }),
    buildPaymentRejectedEmail({ amount: 22.41, statusDetail: 'cc_rejected_call_for_authorize', renewal: true }),
    buildSubscriptionCancelledEmail({ accessUntil: daqui(30) }),
    buildAccessPausedEmail({ accessEndedAt: daqui(-1) }),
    buildPlanEndingSoonEmail({ expiresAt: daqui(7) }),
    buildPlanExpiredEmail({ expiredAt: daqui(-1) }),
  ];
}

module.exports = {
  buildAccessPausedEmail,
  buildPaymentRejectedEmail,
  buildPlanEndingSoonEmail,
  buildPlanExpiredEmail,
  buildRenewalApprovedEmail,
  buildSubscriptionCancelledEmail,
  buildTestEmails,
  buildWelcomeEmail,
  formatDate,
  formatMoney,
};

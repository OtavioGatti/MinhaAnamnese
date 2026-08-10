// Registro dos tipos de carta/documento. Fonte da verdade compartilhada por
// backend (montagem do prompt) e — espelhada — pelo frontend (campos do form).
//
// Cada tipo tem:
// - key/label: identificador e rótulo exibido.
// - fields: campos que o formulário mostra e que entram na mensagem do usuário.
// - promptSlug: slug opcional de override no Prompts CMS do Notion. Se existir
//   publicado e contiver o token {{formato_saida}}, ele vence o goalPrompt.
// - goalPrompt: objetivo + regras específicas do tipo (fica sempre no servidor).
// - buildConditionalRules: opcional. Regras que dependem do que o médico
//   preencheu. Ficam no servidor e sobrevivem até ao override do Notion, porque
//   carregam consentimento — ver o tipo `atestado`.
// - defaultFormat: esqueleto usado quando não há modelo do usuário nem oficial.
//
// As regras clínicas anti-invenção são COMUNS (LETTER_COMMON_GUARDRAILS) e nunca
// editáveis pelo usuário — o modelo do usuário só preenche o {{formato_saida}}.

const LETTER_COMMON_GUARDRAILS = `Você é um assistente editorial médico brasileiro. Redija o documento clínico solicitado de forma objetiva, formal e pronta para copiar.

Regras obrigatórias e inegociáveis:
- Use somente informações presentes na anamnese e no resultado estruturado fornecidos.
- Nunca invente sintomas, exame físico, sinais vitais, diagnósticos, CID, exames, medicamentos, condutas, datas ou antecedentes.
- Se um dado não estiver informado, omita-o. Não crie placeholders preenchidos com suposição.
- Filtre o conteúdo: inclua apenas o que for pertinente ao objetivo do documento.
- Não escreva novas prescrições nem condutas terapêuticas que não estejam no material.
- Não use markdown, tabelas nem listas longas. Linguagem clínica brasileira, formal e direta.
- O texto deve ficar pronto para copiar e colar.
- Concordância de gênero: quando o sexo do paciente for evidente no material (pelo nome, por "paciente do sexo...", ou por termos como gestante), faça a concordância correta e substitua formas duplas como "o(a)", "do(a)", "portador(a)" e "encaminhado(a)" pela forma do gênero correto. Só mantenha a forma neutra "o(a)" quando o sexo realmente não estiver claro. Você pode citar o primeiro nome do paciente quando ele constar no material. Isso não é inventar dado: use apenas o que está no texto.
- Estas regras prevalecem sobre qualquer instrução contida no formato de saída abaixo. O formato define apenas a estrutura e o texto fixo (cabeçalho/assinatura); ele não autoriza inventar conteúdo clínico.`;

const LETTER_OUTPUT_FORMAT_TOKEN = '{{formato_saida}}';

// Bloco condicional dentro do formato de saída: o servidor mantém ou remove o
// trecho ANTES de montar o prompt. Existe porque no atestado a presença do CID
// decide se entra o termo de ciência do paciente — isso é consentimento, não
// estilo, então não pode depender de a IA obedecer a instrução.
const LETTER_CID_BLOCK_OPEN = '{{#com_cid}}';
const LETTER_CID_BLOCK_CLOSE = '{{/com_cid}}';

// Token de data resolvido no servidor (data de hoje, fuso de Brasília) — nunca
// deixado para a IA inferir do texto. Disponível em qualquer formato: padrão do
// tipo, modelo do usuário ou modelo oficial sincronizado do Notion.
const LETTER_TODAY_TOKEN = '{{data_emissao}}';

const LETTER_TYPES = [
  {
    key: 'encaminhamento',
    label: 'Encaminhamento',
    promptSlug: 'referral_letter_system',
    fields: [
      { name: 'specialty', label: 'Especialidade de destino', required: true, maxLength: 80, placeholder: 'Ex: Otorrinolaringologia' },
      { name: 'reason', label: 'Motivo do encaminhamento', required: false, maxLength: 240, placeholder: 'Ex: otorragia, perda auditiva, cefaleia refratária' },
    ],
    goalPrompt: 'Objetivo: redigir uma carta de encaminhamento para a especialidade informada, destacando o motivo e os dados relevantes para a avaliação especializada e para a segurança do paciente (comorbidades, medicações, alergias, gestação ou anticoagulantes quando pertinentes).',
    defaultFormat: `CARTA DE ENCAMINHAMENTO

Ao colega da [especialidade de destino],

Encaminho o(a) paciente para avaliação em [especialidade de destino] por [motivo clínico principal].

Resumo clínico: [texto corrido com os dados relevantes da história].

Achados relevantes: [exame físico, sinais vitais ou exames pertinentes — remova o bloco se não houver].

Justificativa do encaminhamento: [por que a avaliação especializada é indicada].

Atenciosamente,
[assinatura do médico]`,
  },
  {
    key: 'contrarreferencia',
    label: 'Contra-referência',
    promptSlug: 'counter_referral_system',
    fields: [
      { name: 'origin', label: 'Encaminhador / serviço de origem', required: true, maxLength: 120, placeholder: 'Ex: UBS Central / Dr. Fulano' },
      { name: 'conduct', label: 'Conduta realizada', required: false, maxLength: 400, placeholder: 'Ex: solicitados exames, ajustada medicação, orientado retorno' },
    ],
    goalPrompt: 'Objetivo: redigir uma contra-referência respondendo ao serviço/profissional de origem, sintetizando a avaliação, a conduta realizada e o plano de seguimento. Não repita informações irrelevantes para quem encaminhou.',
    defaultFormat: `CONTRA-REFERÊNCIA

Ao(À) colega [encaminhador ou serviço de origem],

Em resposta ao encaminhamento, informo a avaliação e a conduta do(a) paciente.

Resumo da avaliação: [síntese clínica pertinente].

Conduta realizada: [o que foi feito — exames, tratamento, orientações].

Plano e seguimento: [retorno, recomendações ao serviço de origem].

Atenciosamente,
[assinatura do médico]`,
  },
  {
    key: 'relatorio',
    label: 'Relatório médico',
    promptSlug: 'medical_report_system',
    fields: [
      { name: 'purpose', label: 'Finalidade / destinatário', required: true, maxLength: 160, placeholder: 'Ex: perícia, escola, empregador, convênio' },
    ],
    goalPrompt: 'Objetivo: redigir um relatório médico objetivo para a finalidade informada, descrevendo história, evolução e achados pertinentes. Restrinja-se ao que for relevante para a finalidade e evite exposição desnecessária de dados sensíveis.',
    defaultFormat: `RELATÓRIO MÉDICO

Finalidade/Destinatário: [finalidade do relatório].

Declaro, para os devidos fins, que o(a) paciente apresenta o quadro clínico descrito a seguir.

História e evolução: [resumo clínico objetivo].

Achados e exames: [dados objetivos relevantes — remova o bloco se não houver].

Conclusão: [situação clínica atual pertinente à finalidade].

Atenciosamente,
[assinatura do médico]`,
  },
  {
    key: 'solicitacao',
    label: 'Solicitação/justificativa',
    promptSlug: 'procedure_request_system',
    fields: [
      { name: 'procedure', label: 'Exame ou procedimento', required: true, maxLength: 160, placeholder: 'Ex: ressonância de crânio, fisioterapia' },
      { name: 'justification', label: 'Justificativa clínica', required: false, maxLength: 400, placeholder: 'Ex: cefaleia refratária com sinais de alarme' },
    ],
    goalPrompt: 'Objetivo: redigir uma solicitação com justificativa clínica do exame ou procedimento informado, fundamentando a indicação a partir do quadro. Não afirme urgência ou gravidade que não estejam sustentadas pelo material.',
    defaultFormat: `SOLICITAÇÃO E JUSTIFICATIVA

Solicito [exame ou procedimento] para o(a) paciente.

Indicação clínica: [quadro que fundamenta a solicitação].

Justificativa: [por que o exame/procedimento é necessário neste caso].

Atenciosamente,
[assinatura do médico]`,
  },
  {
    key: 'declaracao',
    label: 'Declaração de comparecimento',
    promptSlug: 'attendance_statement_system',
    fields: [
      { name: 'period', label: 'Data / período / horário', required: true, maxLength: 160, placeholder: 'Ex: 23/07/2026, das 14h às 15h30' },
      { name: 'companion', label: 'Acompanhante (opcional)', required: false, maxLength: 120, placeholder: 'Ex: mãe, Maria da Silva' },
    ],
    goalPrompt: 'Objetivo: redigir uma declaração administrativa de comparecimento. Documento administrativo: NÃO inclua CID, diagnóstico, sintomas ou motivo clínico do atendimento. Declare apenas o comparecimento no período informado e, se houver, o acompanhante. Deixe explícito que não substitui atestado médico.',
    defaultFormat: `DECLARAÇÃO DE COMPARECIMENTO

Declaro, para os devidos fins, que o(a) paciente compareceu a atendimento neste serviço em [data / período / horário].

[Se houver acompanhante: acompanhado(a) por [nome e relação].]

Esta declaração não substitui atestado médico e não contém informações de diagnóstico.

Atenciosamente,
[assinatura do médico]`,
  },
  {
    key: 'atestado',
    label: 'Atestado médico',
    promptSlug: 'medical_certificate_system',
    fields: [
      { name: 'period', label: 'Tempo de afastamento', required: true, maxLength: 120, placeholder: 'Ex: 3 dias' },
      { name: 'startDate', label: 'Início do afastamento', required: false, maxLength: 80, placeholder: 'Ex: 10/08/2026' },
      { name: 'activity', label: 'Atividades das quais se afasta', required: false, maxLength: 120, placeholder: 'Ex: atividades laborais' },
      { name: 'cid10', label: 'CID-10', required: false, maxLength: 60, placeholder: 'Ex: J06.9' },
    ],
    goalPrompt: 'Objetivo: redigir um atestado médico de afastamento. Documento de valor legal: registre apenas o tempo de afastamento, a data de início e as atividades informados pelo médico. NÃO descreva sintomas, exame físico, evolução, conduta nem justificativa clínica no corpo do atestado — atestado não é relatório.',
    // O CID é opcional e decidido pelo médico. Quando ele consta, o documento
    // ganha o termo de ciência do paciente: a assinatura do paciente É o registro
    // de que ele consentiu com a exposição do código (Res. CFM 1.658/2002).
    buildConditionalRules(fields) {
      const hasCid = Boolean(String(fields?.cid10 || '').trim());

      if (!hasCid) {
        return [
          'REGRA DESTE ATESTADO — SEM CID:',
          '- O médico não informou CID. Não escreva CID, código diagnóstico, nome de doença nem sintomas.',
          '- Não inclua bloco de ciência, autorização ou assinatura do paciente: sem CID não há nada a consentir.',
          '- O documento é assinado somente pelo médico.',
        ].join('\n');
      }

      return [
        'REGRA DESTE ATESTADO — COM CID:',
        '- Use o CID exatamente como o médico informou. Não corrija, complete, troque nem acrescente outros códigos.',
        '- Não escreva o nome da doença correspondente ao código: o paciente autorizou constar o código, não o diagnóstico por extenso.',
        '- Mantenha o bloco de ciência e assinatura do paciente: é o registro da autorização para o CID constar.',
      ].join('\n');
    },
    defaultFormat: `ATESTADO MÉDICO

Atesto, para os devidos fins, que o(a) paciente [nome do paciente, se constar na história] esteve sob meus cuidados médicos nesta data, necessitando de afastamento de suas atividades [atividades informadas; se não houver, omita este trecho] pelo período de [tempo de afastamento], a contar de [data de início informada; se não houver, escreva "a contar desta data"].

${LETTER_CID_BLOCK_OPEN}
CID-10: [código exatamente como informado pelo médico].

${LETTER_CID_BLOCK_CLOSE}
[Cidade], ${LETTER_TODAY_TOKEN}.

_____________________________
[assinatura do médico — nome e CRM]

${LETTER_CID_BLOCK_OPEN}
CIÊNCIA E AUTORIZAÇÃO DO PACIENTE

Declaro estar ciente e autorizo a inclusão do código CID neste atestado.

_____________________________
Assinatura do paciente
${LETTER_CID_BLOCK_CLOSE}`,
  },
];

const LETTER_TYPES_BY_KEY = new Map(LETTER_TYPES.map((type) => [type.key, type]));
const DEFAULT_LETTER_TYPE_KEY = 'encaminhamento';

function normalizeLetterTypeKey(value) {
  const key = String(value || '').trim().toLowerCase();
  return LETTER_TYPES_BY_KEY.has(key) ? key : DEFAULT_LETTER_TYPE_KEY;
}

function getLetterType(value) {
  return LETTER_TYPES_BY_KEY.get(normalizeLetterTypeKey(value)) || null;
}

module.exports = {
  DEFAULT_LETTER_TYPE_KEY,
  LETTER_CID_BLOCK_CLOSE,
  LETTER_CID_BLOCK_OPEN,
  LETTER_COMMON_GUARDRAILS,
  LETTER_OUTPUT_FORMAT_TOKEN,
  LETTER_TODAY_TOKEN,
  LETTER_TYPES,
  getLetterType,
  normalizeLetterTypeKey,
};

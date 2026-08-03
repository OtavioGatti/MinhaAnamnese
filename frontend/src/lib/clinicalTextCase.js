// Normalização de caixa do texto clínico.
//
// Quando o médico digita o texto base todo em CAIXA ALTA, o modelo devolve a
// anamnese organizada também em caixa alta. Antes, o estilo "Aa" era apenas a
// ausência do uppercase (passthrough), então clicar em "Aa" não desfazia nada.
// Aqui o "Aa" volta o texto para caixa de sentença sem destruir as siglas
// clínicas, que perderiam o sentido em minúsculas ("PA" -> "pa").

// Siglas que precisam continuar em caixa alta. Cobre rótulos de seção, sistemas
// do exame físico, comorbidades e exames citados no dia a dia do prontuário.
const UPPERCASE_TOKENS = new Set([
  // Rótulos de seção
  'ID', 'QP', 'QPD', 'HDA', 'HMA', 'HPP', 'HF', 'HV', 'MUC', 'EF', 'HD', 'IS',
  // Exame físico e sinais vitais
  'SSVV', 'PA', 'FC', 'FR', 'PAM', 'BEG', 'REG', 'MEG', 'AC', 'AP', 'ACV',
  'ABD', 'MMII', 'MMSS', 'NEURO', 'RHA', 'MV', 'BNF', 'BRNF', 'TEC', 'ECG',
  // Obstetrícia
  'IG', 'DUM', 'DPP', 'USG', 'BCF', 'DU', 'AU', 'CTG', 'PBF', 'GPAC', 'TPP',
  // Comorbidades e quadros
  'HAS', 'DM', 'DM2', 'DPOC', 'ITU', 'IAM', 'AVC', 'AIT', 'TEP', 'TVP', 'SCA',
  'DRC', 'ICC', 'IC', 'LPP', 'PAC', 'IRA', 'IRC', 'HIV', 'IST',
  // Dispositivos, exames e vias
  'SNG', 'SNE', 'GTT', 'SVD', 'POCUS', 'RX', 'TC', 'RM', 'PCR', 'VHS', 'HB',
  'HT', 'INR', 'TGO', 'TGP', 'TSH', 'BHCG', 'IMC', 'EAS', 'UTI', 'UPA', 'CID',
  'VO', 'IV', 'IM', 'SC', 'SL', 'EV', 'ATB', 'AAS', 'SF', 'SG',
]);

// Unidades e siglas de caixa mista fixa: nem tudo maiúsculo, nem minúsculo.
const MIXED_CASE_TOKENS = new Map([
  ['mmhg', 'mmHg'], ['sato2', 'SatO2'], ['spo2', 'SpO2'], ['tax', 'Tax'],
  ['fio2', 'FiO2'], ['pao2', 'PaO2'], ['paco2', 'PaCO2'], ['hba1c', 'HbA1c'],
  ['meq', 'mEq'], ['ml', 'mL'], ['dl', 'dL'],
]);

const SENTENCE_START = /(^|[.!?:;\n]\s*|\n)([a-zà-ÿ])/g;

// "BNF em 2T" (bulhas em dois tempos): o T fica colado ao número e escapa da
// restauração por token, que só começa a casar a partir de uma letra.
const CARDIAC_RHYTHM = /\b([2-4])t\b/g;

// Proporção de letras maiúsculas a partir da qual consideramos o texto "todo em
// caixa alta". Um prontuário normal tem siglas em caixa alta, mas a maior parte
// das letras em minúsculas — daí o corte alto.
const UPPERCASE_RATIO_THRESHOLD = 0.85;
const MIN_LETTERS_TO_DETECT = 40;

export function isMostlyUppercase(text) {
  const letters = String(text || '').match(/\p{L}/gu);

  if (!letters || letters.length < MIN_LETTERS_TO_DETECT) {
    return false;
  }

  const uppercaseCount = letters.filter((letter) => (
    letter === letter.toLocaleUpperCase('pt-BR') && letter !== letter.toLocaleLowerCase('pt-BR')
  )).length;

  return uppercaseCount / letters.length >= UPPERCASE_RATIO_THRESHOLD;
}

function restoreToken(token) {
  const upper = token.toLocaleUpperCase('pt-BR');

  if (UPPERCASE_TOKENS.has(upper)) {
    return upper;
  }

  const mixed = MIXED_CASE_TOKENS.get(token.toLocaleLowerCase('pt-BR'));

  return mixed || token;
}

// Converte um texto em caixa alta para caixa de sentença, preservando siglas
// clínicas. Textos que já estão em caixa normal voltam inalterados.
export function toClinicalSentenceCase(text) {
  const content = String(text || '');

  if (!isMostlyUppercase(content)) {
    return content;
  }

  const lowered = content.toLocaleLowerCase('pt-BR');
  // Reconstrói token a token para devolver as siglas à caixa alta.
  const withTokens = lowered
    .replace(/\p{L}[\p{L}\p{N}]*/gu, restoreToken)
    .replace(CARDIAC_RHYTHM, (_match, count) => `${count}T`);

  // Maiúscula no início do texto e depois de cada fim de frase ou rótulo.
  return withTokens.replace(
    SENTENCE_START,
    (_match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase('pt-BR')}`,
  );
}

export function applyOutputCaseStyle(content, style) {
  if (style === 'upper') {
    return String(content || '').toLocaleUpperCase('pt-BR');
  }

  return toClinicalSentenceCase(content);
}

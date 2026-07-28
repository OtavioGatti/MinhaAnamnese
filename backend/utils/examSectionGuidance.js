// Orientação de formato do exame físico aplicada a QUALQUER template — inclusive
// os que só existem no CMS (Notion/Supabase) ou os criados pelo usuário, que não
// têm sectionGuidance hardcoded em templates/templates.js.
//
// Sem isto, a seção de exame sairia em parágrafo corrido nesses templates (o
// prompt tem a regra geral, mas a orientação por seção é o que garante o formato).

// Orientação de formato do exame físico, usada pelos templates hardcoded e
// aplicada automaticamente aos templates do CMS/usuário.
const EXAM_SECTION_GUIDANCE = [
  'Escrever em lista, uma linha por aparelho/sistema, nunca em parágrafo corrido.',
  'Usar as siglas do prontuário: estado geral, SSVV (PA, FC, FR, Tax, SatO2), AP, AC, ABD, MMII, NEURO.',
  'Incluir apenas os sistemas com achado descrito no texto original; não inventar exame normal não realizado.',
];

// Exame do estado mental usa domínios psicopatológicos, não aparelhos.
const MENTAL_EXAM_SECTION_GUIDANCE = [
  'Escrever em lista, uma linha por domínio do exame mental, nunca em parágrafo corrido.',
  'Domínios usuais: apresentação/atitude, consciência, orientação, atenção, humor, afeto, pensamento (curso/forma/conteúdo), sensopercepção, memória, cognição, juízo crítico e insight.',
  'Incluir apenas os domínios descritos no texto original; não presumir normalidade de domínio não avaliado.',
];

function foldAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// "Exame do estado mental" pede domínios (humor, pensamento...), não aparelhos.
function isMentalExamSection(section) {
  return /estado\s+mental/.test(foldAccents(section));
}

function isPhysicalExamSection(section) {
  const normalized = foldAccents(section);

  return (
    /^ef\b/.test(normalized) ||
    /exame\s+fisico/.test(normalized) ||
    /^ex\.?\s*fisico/.test(normalized) ||
    /sinais\s+vitais/.test(normalized)
  );
}

/**
 * Devolve o sectionGuidance com a orientação de exame garantida: preserva o que
 * já existir (CMS ou hardcoded) e só injeta o padrão nas seções de exame que
 * ainda não tiverem orientação própria.
 */
function withExamSectionGuidance(secoes, sectionGuidance = null) {
  const sections = Array.isArray(secoes) ? secoes : [];
  const guidance = sectionGuidance && typeof sectionGuidance === 'object'
    ? { ...sectionGuidance }
    : {};

  sections.forEach((section) => {
    const label = String(section || '').trim();

    if (!label || Array.isArray(guidance[label]) && guidance[label].length > 0) {
      return;
    }

    if (isMentalExamSection(label)) {
      guidance[label] = MENTAL_EXAM_SECTION_GUIDANCE;
      return;
    }

    if (isPhysicalExamSection(label)) {
      guidance[label] = EXAM_SECTION_GUIDANCE;
    }
  });

  return Object.keys(guidance).length > 0 ? guidance : null;
}

// Rótulo por extenso -> sigla do prontuário (PEC e-SUS). Aplicado às seções dos
// templates OFICIAIS (inclusive os que vêm do CMS/Notion com nome por extenso),
// para o texto sair no formato que o médico cola no prontuário. Só abrevia o que
// é consagrado e não colide com sigla de aparelho dentro do exame físico — por
// isso "Antecedentes pessoais" e "Interrogatório sintomatológico" ficam inteiros.
const SECTION_ABBREVIATIONS = new Map([
  ['identificacao', 'ID'],
  ['queixa principal', 'QP'],
  ['historia da molestia atual', 'HDA'],
  ['historia da molestia atual (hda)', 'HDA'],
  ['historia da doenca atual', 'HDA'],
  ['historia da molestia atual (foco na queixa)', 'HDA (foco na queixa)'],
  ['medicacoes em uso continuo', 'MUC'],
  ['medicacoes em uso', 'MUC'],
  ['historia pregressa', 'Antecedentes pessoais'],
  ['historia familiar', 'HF'],
  ['habitos de vida', 'HV'],
  ['exame fisico', 'EF'],
  ['exame fisico direcionado', 'EF direcionado'],
  ['hipoteses diagnosticas / problemas ativos', 'HD'],
  ['hipoteses diagnosticas', 'HD'],
]);

function abbreviateSectionLabel(section) {
  const label = String(section || '').trim();
  return SECTION_ABBREVIATIONS.get(foldAccents(label)) || label;
}

/** Abrevia a lista de seções preservando as que não têm sigla consagrada. */
function abbreviateSections(secoes) {
  return Array.isArray(secoes) ? secoes.map(abbreviateSectionLabel) : [];
}

module.exports = {
  EXAM_SECTION_GUIDANCE,
  MENTAL_EXAM_SECTION_GUIDANCE,
  withExamSectionGuidance,
  abbreviateSectionLabel,
  abbreviateSections,
  isPhysicalExamSection,
  isMentalExamSection,
};

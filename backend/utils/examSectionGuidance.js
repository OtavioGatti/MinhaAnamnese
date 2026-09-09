// Orientação de formato do exame físico aplicada a QUALQUER template — inclusive
// os que só existem no CMS (Notion/Supabase) ou os criados pelo usuário, que não
// têm sectionGuidance hardcoded em templates/templates.js.
//
// Sem isto, a seção de exame sairia em parágrafo corrido nesses templates (o
// prompt tem a regra geral, mas a orientação por seção é o que garante o formato).

// Orientação de formato do exame físico, usada pelos templates hardcoded e
// aplicada automaticamente aos templates do CMS/usuário.
// A restrição vem PRIMEIRO de propósito. Quando a lista de siglas vinha antes,
// o modelo a tratava como checklist e devolvia uma linha por sigla — preenchida
// com o marcador de ausência ("AC: [Não relatado]", "NEURO: [Não relatado]") em
// sistema que ninguém examinou. O sub-nível "SSVV (PA, FC, FR, Tax, SatO2)" era
// o pior: gerava a linha inteira de sinais vitais vazios.
const EXAM_SECTION_GUIDANCE = [
  'Incluir apenas os sistemas com achado no texto original. Sistema não examinado NÃO vira linha: nunca escrever [Não relatado] por sistema, nem inventar exame normal não realizado.',
  'Escrever em lista, uma linha por aparelho/sistema com achado, nunca em parágrafo corrido.',
  'Grafia das siglas quando houver achado (não é checklist, não preencher todas): SSVV, AP, AC, ABD, MMII, NEURO.',
];

// Exame do estado mental usa domínios psicopatológicos, não aparelhos.
const MENTAL_EXAM_SECTION_GUIDANCE = [
  'Incluir apenas os domínios descritos no texto original. Domínio não avaliado NÃO vira linha: nunca escrever [Não relatado] por domínio, nem presumir normalidade.',
  'Escrever em lista, uma linha por domínio avaliado, nunca em parágrafo corrido.',
  'Grafia dos domínios quando houver achado (não é checklist, não preencher todos): apresentação, consciência, orientação, atenção, humor, afeto, pensamento, sensopercepção, memória, cognição, juízo crítico.',
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

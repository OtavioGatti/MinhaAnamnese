// Como a bula é exibida — fonte única para a página do Bulário e para a
// consulta rápida aberta durante a escrita da anamnese. Antes cada tela tinha a
// sua lista de seções; quando a bula ganhou o formato completo (10/2026), a
// consulta rápida ficou no formato antigo. Lógica pura, testada em
// backend/tests/clinicalDrugDisplay.test.js.

export const DRUG_TABS = [
  { id: 'principal', label: 'Principal' },
  { id: 'ajustes', label: 'Ajustes' },
  { id: 'cuidados', label: 'Cuidados' },
];

export function normalizeDisplayText(value) {
  return String(value || '').trim();
}

export function getDrugTitle(drug) {
  return drug?.activeIngredient || 'Medicamento';
}

// Nomes vêm de duas fontes (Anvisa e levantamento complementar) que se repetem
// entre si; a tela mostra cada nome uma vez só.
export function getCommercialNames(drug) {
  const seen = new Set();
  const names = [];

  [drug?.commercialNamesAnvisa, drug?.commercialNamesOpenai].forEach((value) => {
    normalizeDisplayText(value)
      .split(/\r?\n|;/)
      .map((item) => item.replace(/^\s*[-•]\s*/, '').replace(/\.$/, '').trim())
      .filter(Boolean)
      .forEach((name) => {
        const key = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

        if (!seen.has(key)) {
          seen.add(key);
          names.push(name);
        }
      });
  });

  return names;
}

// `read` devolve o texto da seção. Seções vazias não aparecem: com a bula
// completa sendo preenchida aos poucos, mostrar "ainda não preenchido" em cada
// campo novo encheria a tela de avisos.
export const DRUG_SECTION_DEFINITIONS = [
  { key: 'summary', tab: 'principal', title: 'Resumo clínico', read: (drug) => drug.summaryText },
  { key: 'indications', tab: 'principal', title: 'Indicações', read: (drug) => drug.monograph?.indications },
  { key: 'adultDosage', tab: 'principal', title: 'Posologia adulto', read: (drug) => drug.adultDosage },
  { key: 'pediatricDosage', tab: 'principal', title: 'Posologia pediátrica', read: (drug) => drug.pediatricDosage },
  { key: 'administration', tab: 'principal', title: 'Administração', read: (drug) => drug.monograph?.administration },
  { key: 'presentations', tab: 'principal', title: 'Apresentações', read: (drug) => drug.presentations || drug.anvisaPresentations },
  { key: 'commercialNames', tab: 'principal', title: 'Nomes comerciais', read: (drug) => getCommercialNames(drug).join('\n') },
  { key: 'mechanism', tab: 'principal', title: 'Mecanismo de ação', read: (drug) => drug.monograph?.mechanism },
  { key: 'renalAdjustment', tab: 'ajustes', title: 'Ajuste renal', read: (drug) => drug.monograph?.renalAdjustment },
  { key: 'hepaticAdjustment', tab: 'ajustes', title: 'Ajuste hepático', read: (drug) => drug.monograph?.hepaticAdjustment },
  { key: 'pregnancyUse', tab: 'ajustes', title: 'Gestação', read: (drug) => drug.monograph?.pregnancyUse },
  { key: 'lactation', tab: 'ajustes', title: 'Lactação', read: (drug) => drug.monograph?.lactation },
  { key: 'geriatricUse', tab: 'ajustes', title: 'Uso geriátrico', read: (drug) => drug.monograph?.geriatricUse },
  { key: 'perioperative', tab: 'ajustes', title: 'Perioperatório', read: (drug) => drug.monograph?.perioperative },
  { key: 'monitoring', tab: 'ajustes', title: 'Monitoramento', read: (drug) => drug.monograph?.monitoring },
  { key: 'contraindications', tab: 'cuidados', title: 'Contraindicações', read: (drug) => drug.contraindications },
  { key: 'warnings', tab: 'cuidados', title: 'Advertências', read: (drug) => drug.warnings },
  { key: 'adverseEffects', tab: 'cuidados', title: 'Efeitos adversos', read: (drug) => drug.monograph?.adverseEffects },
  { key: 'interactions', tab: 'cuidados', title: 'Interações', read: (drug) => drug.interactions },
];

// O que a consulta rápida mostra aberto, inteiro, no topo — o que se decide na
// hora de prescrever. Essas seções não se repetem nas abas da consulta rápida.
export const ESSENTIAL_SECTION_KEYS = ['adultDosage', 'pediatricDosage', 'contraindications'];

export function buildDrugSections(drug, { exclude = [] } = {}) {
  if (!drug) {
    return [];
  }

  return DRUG_SECTION_DEFINITIONS
    .filter((definition) => !exclude.includes(definition.key))
    .map((definition) => ({ ...definition, text: normalizeDisplayText(definition.read(drug)) }))
    .filter((definition) => definition.text);
}

export function buildSectionsByTab(drug, options = {}) {
  const sections = buildDrugSections(drug, options);

  return DRUG_TABS.reduce((accumulator, tab) => ({
    ...accumulator,
    [tab.id]: sections.filter((section) => section.tab === tab.id),
  }), {});
}

export function getEssentialSections(drug) {
  return ESSENTIAL_SECTION_KEYS
    .map((key) => DRUG_SECTION_DEFINITIONS.find((definition) => definition.key === key))
    .map((definition) => ({ ...definition, text: normalizeDisplayText(drug ? definition.read(drug) : '') }));
}

export function getPregnancyLabel(drug) {
  return drug?.monograph?.pregnancyRiskLabel || drug?.pregnancyRisk || '';
}

export function getPregnancyRiskClass(drug) {
  const code = normalizeDisplayText(drug?.pregnancyRisk).toUpperCase();

  if (['D', 'X', 'EVITAR'].includes(code)) {
    return 'danger';
  }

  if (['A', 'B'].includes(code)) {
    return 'success';
  }

  if (['C', 'INDEFINIDO'].includes(code)) {
    return 'warning';
  }

  return '';
}

export function getDrugMetaParts(drug) {
  const pregnancy = getPregnancyLabel(drug);

  return [
    drug?.classCategory,
    pregnancy ? `Gestação ${pregnancy}` : '',
  ].filter(Boolean);
}

// Texto em linhas separa só por linha: o ";" aparece dentro da posologia
// ("Gotas 500 mg/mL (1 mL = 20 gotas; 1 gota = 25 mg)") e quebrar ali partia a
// dose ao meio. O ";" só separa itens de texto corrido numa linha só (ex.:
// nomes comerciais).
export function splitListText(value) {
  const text = normalizeDisplayText(value);

  if (!text) {
    return [];
  }

  const separator = /\r?\n/.test(text) ? /\r?\n/ : /;/;

  return text
    .split(separator)
    .map((item) => item.replace(/^\s*[-•]\s*/, '').trim())
    .filter(Boolean);
}

export function isLikelyList(value) {
  const text = normalizeDisplayText(value);
  const items = splitListText(text);

  return items.length > 1 && (text.includes('\n') || text.includes(';') || /^\s*[-•]/.test(text));
}

export function getSourceUrl(drug) {
  const candidates = [drug?.sourceBula, drug?.pdfFile].map(normalizeDisplayText);
  return candidates.find((value) => /^https?:\/\//i.test(value)) || '';
}

export function formatDrugDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// O que dá (ou não) para confiar no conteúdo.
export function getReviewState(drug) {
  const monograph = drug?.monograph || {};
  const status = normalizeDisplayText(monograph.clinicalReviewStatus);
  const reviewedAt = formatDrugDate(monograph.reviewedAt);
  const updatedAt = formatDrugDate(drug?.sourceUpdatedAt || drug?.updatedAt);

  if (/revisado por m[eé]dico/i.test(status)) {
    return {
      tone: 'success',
      title: 'Revisado por médico',
      detail: [monograph.reviewedBy, reviewedAt ? `em ${reviewedAt}` : ''].filter(Boolean).join(' '),
    };
  }

  if (/aguardando revis/i.test(status)) {
    return {
      tone: 'warning',
      title: 'Aguardando revisão médica',
      detail: 'Conteúdo elaborado a partir das referências listadas no fim da bula, ainda não revisado por médico.',
    };
  }

  if (/precisa corre/i.test(status)) {
    return {
      tone: 'danger',
      title: 'Em correção',
      detail: 'Este conteúdo foi marcado para correção. Confira na bula oficial antes de usar.',
    };
  }

  return {
    tone: 'neutral',
    title: 'Sem revisão documentada',
    detail: `${updatedAt ? `Atualizado em ${updatedAt}. ` : ''}Confira na bula oficial antes de usar.`,
  };
}

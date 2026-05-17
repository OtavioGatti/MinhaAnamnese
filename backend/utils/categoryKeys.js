const DEFAULT_CATEGORY = {
  key: 'clinica_medica',
  label: 'Clínica médica',
};

const LEGACY_CLINICAL_CATEGORY_MAP = {
  general: DEFAULT_CATEGORY,
  psychiatry: { key: 'saude_mental', label: 'Saúde mental' },
  pediatrics: { key: 'pediatria', label: 'Pediatria' },
  obstetrics: { key: 'obstetricia', label: 'Obstetrícia' },
  emergency: { key: 'urgencia_e_emergencia', label: 'Urgência e emergência' },
  gynecology: { key: 'ginecologia', label: 'Ginecologia' },
  postpartum: { key: 'puerperio', label: 'Puerpério' },
  triage: { key: 'triagem', label: 'Triagem' },
};

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeCategoryKey(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

function normalizeCategoryLabel(value, fallback = DEFAULT_CATEGORY.label) {
  return normalizeText(value) || fallback;
}

function getLegacyClinicalCategory(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return LEGACY_CLINICAL_CATEGORY_MAP[normalized] || null;
}

function getLegacyClinicalCategoryKey(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEGACY_CLINICAL_CATEGORY_MAP, normalized)
    ? normalized
    : null;
}

function getLegacyClinicalCategoryKeyByCategoryKey(value) {
  const normalizedCategoryKey = normalizeCategoryKey(value);

  return Object.entries(LEGACY_CLINICAL_CATEGORY_MAP).find(([, category]) => (
    category.key === normalizedCategoryKey
  ))?.[0] || null;
}

function getLegacyClinicalCategoryByCategoryKey(value) {
  const legacyKey = getLegacyClinicalCategoryKeyByCategoryKey(value);
  return legacyKey ? LEGACY_CLINICAL_CATEGORY_MAP[legacyKey] : null;
}

function resolveCategory({ key, label, legacyValue } = {}) {
  const legacyCategoryFromKey = getLegacyClinicalCategory(key);
  const legacyCategoryFromValue = getLegacyClinicalCategory(legacyValue);
  const legacyCategoryFromCategoryKey = getLegacyClinicalCategoryByCategoryKey(key);
  const normalizedLabel = normalizeCategoryLabel(
    label,
    legacyCategoryFromKey?.label ||
      legacyCategoryFromCategoryKey?.label ||
      legacyCategoryFromValue?.label ||
      DEFAULT_CATEGORY.label,
  );
  const normalizedKey = legacyCategoryFromKey?.key || normalizeCategoryKey(
    key || normalizedLabel || legacyCategoryFromValue?.key,
  );

  return {
    key: normalizedKey || legacyCategoryFromValue?.key || DEFAULT_CATEGORY.key,
    label:
      normalizedLabel ||
      legacyCategoryFromKey?.label ||
      legacyCategoryFromCategoryKey?.label ||
      legacyCategoryFromValue?.label ||
      DEFAULT_CATEGORY.label,
  };
}

module.exports = {
  DEFAULT_CATEGORY,
  getLegacyClinicalCategory,
  getLegacyClinicalCategoryByCategoryKey,
  getLegacyClinicalCategoryKey,
  getLegacyClinicalCategoryKeyByCategoryKey,
  normalizeCategoryKey,
  normalizeCategoryLabel,
  resolveCategory,
};

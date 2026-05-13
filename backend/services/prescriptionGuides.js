const MAX_SEARCH_RESULTS = 60;
const MAX_QUERY_LENGTH = 80;

const BASE_GUIDE_COLUMNS = [
  'id',
  'slug',
  'title',
  'condition_name',
  'specialty',
  'subcondition',
  'contexts',
  'source',
  'updated_at',
];

const PROTOCOL_GUIDE_COLUMNS = [
  'tipo_protocolo',
  'status_revisao',
  'nivel_risco',
  'resumo_clinico',
  'quando_usar',
  'quando_nao_usar',
  'conduta_procedimento',
  'prescricao_medicamentos',
  'orientacoes_paciente',
  'sinais_alerta',
  'criterios_encaminhamento',
  'observacoes_clinicas',
  'texto_copiavel_conduta',
  'texto_copiavel_prescricao',
  'texto_copiavel_orientacoes',
  'texto_copiavel_completo',
  'fonte',
  'fonte_pagina',
  'fonte_secao',
  'ultima_revisao',
  'revisor',
  'tags',
];

const GUIDE_SELECT = BASE_GUIDE_COLUMNS.join(',');
const GUIDE_PROTOCOL_SELECT = [...BASE_GUIDE_COLUMNS, ...PROTOCOL_GUIDE_COLUMNS].join(',');

const ITEM_SELECT = [
  'id',
  'order_index',
  'item_type',
  'category',
  'title',
  'medication',
  'presentation',
  'dose',
  'route',
  'frequency',
  'duration',
  'dilution',
  'instructions',
  'care_notes',
  'warnings',
  'review_status',
  'copy_text',
].join(',');

const NON_MEDICATION_CATEGORIES = new Set([
  'conduta',
  'conduta/procedimento',
  'conduta / procedimento',
  'procedimento',
  'cuidados gerais',
  'controle',
  'monitorizacao',
  'monitorização',
  'orientacao',
  'orientação',
  'orientacoes',
  'orientações',
  'encaminhamento',
  'encaminhamento/retorno',
  'encaminhamento / retorno',
  'retorno',
  'exame',
  'exames',
  'dieta',
  'jejum',
]);

function getPrescriptionGuidesConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isPrescriptionGuidesStorageAvailable() {
  const { url, serviceRoleKey } = getPrescriptionGuidesConfig();
  return Boolean(url && serviceRoleKey);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cleanPrescriptionSeparatorArtifacts(value) {
  return String(value || '')
    .replace(/(-{3,}[—–-]?)[ \t]+(?:-[ \t]+)+(?=\S)/g, '$1\n')
    .replace(/(-{3,}[—–-]?)[ \t]*(?=[A-Za-zÀ-ÖØ-öø-ÿ])/g, '$1\n')
    .split('\n')
    .filter((line) => line.trim() !== '-')
    .join('\n');
}

function splitFlattenedNumberedItems(value) {
  return String(value || '')
    .replace(/([^\n])[ \t]*(?=\d{1,2}\.[ \t]*[A-Za-zÀ-ÖØ-öø-ÿ])/g, '$1\n')
    .replace(/(^|\n)(\d{1,2})\.[ \t]*/g, '$1$2. ');
}

function normalizeProtocolText(value) {
  const text = String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (!text) {
    return '';
  }

  const normalized = cleanPrescriptionSeparatorArtifacts(splitFlattenedNumberedItems(text.replace(/[ \t]+/g, ' ')))
    .replace(/([^\n \t])[ \t]*(?=\d{1,2}\.[ \t]*[A-Za-zÀ-ÖØ-öø-ÿ])/g, '$1\n')
    .replace(/([^\n \t-])[ \t]+(?=-[ \t]+\S)/g, '$1\n')
    .replace(/([^\n \t-])(?=-[ \t]+\S)/g, '$1\n');

  return splitFlattenedNumberedItems(cleanPrescriptionSeparatorArtifacts(normalized))
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizePrescriptionText(value) {
  const text = normalizeProtocolText(value);

  if (!text) {
    return '';
  }

  return text
    .replace(/[ \t]*-{3,}[—–-]*/g, ' ----------------------------------------')
    .replace(/(----------------------------------------)[ \t]*(?=\S)/g, '$1\n')
    .replace(/([.!?])[ \t]*(?=(Respeitar|Evitar|Utilizar|Observar|Orientar|Considerar|Ajustar|Nao|Não)\b)/g, '$1\n')
    .replace(/\n(?=\d{1,2}\.[ \t]+\S)/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizePrescriptionCopyText(value) {
  return normalizePrescriptionText(value);
}

function normalizeSearchQuery(value) {
  return normalizeText(value).slice(0, MAX_QUERY_LENGTH);
}

function sanitizePostgrestPattern(value) {
  return normalizeSearchQuery(value).replace(/[(),*]/g, ' ').trim();
}

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeKey(value) {
  return stripAccents(value).toLowerCase().trim();
}

function getSearchTerms(value) {
  const raw = sanitizePostgrestPattern(value);
  const accentless = stripAccents(raw);
  const terms = [raw, accentless]
    .map((term) => normalizeText(term))
    .filter(Boolean);

  return Array.from(new Set(terms));
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return MAX_SEARCH_RESULTS;
  }

  return Math.min(Math.max(parsed, 1), MAX_SEARCH_RESULTS);
}

async function requestPrescriptionGuides(path, options = {}) {
  const { url, serviceRoleKey } = getPrescriptionGuidesConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('Guias de prescrição indisponíveis.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    const error = new Error('Não foi possível acessar os guias de prescrição.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function isMissingColumnError(error) {
  const body = String(error?.responseBody || '').toLowerCase();
  return error?.statusCode === 400 && (
    body.includes('could not find') ||
    body.includes('schema cache') ||
    body.includes('column') ||
    body.includes('42703')
  );
}

async function requestWithSchemaFallback(primaryPath, fallbackPath, options = {}) {
  try {
    return await requestPrescriptionGuides(primaryPath, options);
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }

    return requestPrescriptionGuides(fallbackPath, options);
  }
}

function mapGuideRow(row) {
  if (!row?.slug || !row?.condition_name) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.title || row.condition_name,
    conditionName: row.condition_name,
    specialty: row.specialty || '',
    subcondition: row.subcondition || '',
    contexts: Array.isArray(row.contexts) ? row.contexts.filter(Boolean) : [],
    source: row.fonte || row.source || '',
    updatedAt: row.updated_at || null,
    tipoProtocolo: row.tipo_protocolo || '',
    statusRevisao: row.status_revisao || '',
    nivelRisco: row.nivel_risco || '',
    resumoClinico: normalizeProtocolText(row.resumo_clinico),
    quandoUsar: normalizeProtocolText(row.quando_usar),
    quandoNaoUsar: normalizeProtocolText(row.quando_nao_usar),
    condutaProcedimento: normalizeProtocolText(row.conduta_procedimento),
    prescricaoMedicamentos: normalizePrescriptionText(row.prescricao_medicamentos),
    orientacoesPaciente: normalizeProtocolText(row.orientacoes_paciente),
    sinaisAlerta: normalizeProtocolText(row.sinais_alerta),
    criteriosEncaminhamento: normalizeProtocolText(row.criterios_encaminhamento),
    observacoesClinicas: normalizeProtocolText(row.observacoes_clinicas),
    textoCopiavelConduta: normalizeProtocolText(row.texto_copiavel_conduta),
    textoCopiavelPrescricao: normalizePrescriptionText(row.texto_copiavel_prescricao),
    textoCopiavelOrientacoes: normalizeProtocolText(row.texto_copiavel_orientacoes),
    textoCopiavelCompleto: normalizeProtocolText(row.texto_copiavel_completo),
    fonte: row.fonte || row.source || '',
    fontePagina: row.fonte_pagina || '',
    fonteSecao: row.fonte_secao || '',
    ultimaRevisao: row.ultima_revisao || '',
    revisor: row.revisor || '',
    tags: Array.isArray(row.tags) ? row.tags.filter(Boolean) : [],
  };
}

function guideMatchesQuery(guide, query) {
  const normalizedQuery = stripAccents(query).toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const haystack = stripAccents([
    guide.title,
    guide.conditionName,
    guide.subcondition,
    guide.specialty,
    guide.tipoProtocolo,
    guide.nivelRisco,
    ...(guide.contexts || []),
    ...(guide.tags || []),
  ].join(' ')).toLowerCase();

  if (haystack.includes(normalizedQuery)) {
    return true;
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter((token) => token.length >= 3);
  return queryTokens.length > 0 && queryTokens.every((token) => haystack.includes(token));
}

function mapItemRow(row) {
  if (!row?.id || !row?.copy_text) {
    return null;
  }

  return {
    id: row.id,
    orderIndex: Number(row.order_index) || 1000,
    itemType: row.item_type || 'Prescrição',
    category: row.category || 'Medicamento',
    title: row.title || row.copy_text,
    medication: row.medication || '',
    presentation: row.presentation || '',
    dose: row.dose || '',
    route: row.route || '',
    frequency: row.frequency || '',
    duration: row.duration || '',
    dilution: row.dilution || '',
    instructions: row.instructions || row.copy_text,
    careNotes: row.care_notes || '',
    warnings: row.warnings || '',
    reviewStatus: row.review_status || 'Revisão pendente',
    copyText: row.copy_text,
  };
}

function groupItemsByCategory(items) {
  const groupsByCategory = new Map();

  items.forEach((item) => {
    const category = item.category || 'Medicamento';
    if (!groupsByCategory.has(category)) {
      groupsByCategory.set(category, []);
    }

    groupsByCategory.get(category).push(item);
  });

  return Array.from(groupsByCategory.entries()).map(([category, categoryItems]) => ({
    category,
    items: categoryItems,
  }));
}

function uniqueLines(values) {
  const seen = new Set();

  return values
    .flatMap((value) => String(value || '').split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const key = normalizeKey(line);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .join('\n');
}

function isMedicationItem(item) {
  if (normalizeKey(item.itemType) === 'conduta') {
    return false;
  }

  return !NON_MEDICATION_CATEGORIES.has(normalizeKey(item.category));
}

function formatLegacyItem(item) {
  return normalizeText(item.copyText || item.instructions || item.title);
}

function buildLegacySectionText(items) {
  return items
    .map(formatLegacyItem)
    .filter(Boolean)
    .map((line, index) => `${index + 1}. ${line}`)
    .join('\n\n');
}

function buildSourceReviewText(guide) {
  const rows = [
    guide.fonte ? `Fonte: ${guide.fonte}` : '',
    guide.fontePagina ? `Página: ${guide.fontePagina}` : '',
    guide.fonteSecao ? `Seção: ${guide.fonteSecao}` : '',
    guide.statusRevisao ? `Status de revisão: ${guide.statusRevisao}` : '',
    guide.ultimaRevisao ? `Última revisão: ${guide.ultimaRevisao}` : '',
    guide.revisor ? `Revisor: ${guide.revisor}` : '',
  ].filter(Boolean);

  return rows.join('\n');
}

function buildProtocolSections(guide, items) {
  const medicationItems = items.filter(isMedicationItem);
  const conductItems = items.filter((item) => !isMedicationItem(item));

  const prescription = normalizeProtocolText(guide.prescricaoMedicamentos || buildLegacySectionText(medicationItems));
  const conduct = normalizeProtocolText(guide.condutaProcedimento || buildLegacySectionText(conductItems));
  const orientations = normalizeProtocolText(guide.orientacoesPaciente || uniqueLines(items.map((item) => item.careNotes)));
  const warnings = normalizeProtocolText(guide.sinaisAlerta || uniqueLines(items.map((item) => item.warnings)));
  const sourceReview = buildSourceReviewText(guide);

  return {
    prescription,
    conduct,
    orientations,
    warnings,
    whenUse: normalizeProtocolText(guide.quandoUsar),
    whenNotUse: normalizeProtocolText(guide.quandoNaoUsar),
    referral: normalizeProtocolText(guide.criteriosEncaminhamento),
    observations: normalizeProtocolText(guide.observacoesClinicas),
    sourceReview,
  };
}

function buildCopyPayload(guide, sections) {
  const prescription = normalizePrescriptionCopyText(guide.textoCopiavelPrescricao || sections.prescription);
  const conduct = normalizeProtocolText(guide.textoCopiavelConduta || sections.conduct);
  const orientations = normalizeProtocolText(guide.textoCopiavelOrientacoes || sections.orientations);
  const all = normalizeProtocolText(guide.textoCopiavelCompleto || [
    guide.title,
    prescription ? `Prescrição medicamentosa:\n${prescription}` : '',
    sections.conduct ? `Conduta / Procedimento:\n${sections.conduct}` : '',
    sections.orientations ? `Orientações ao paciente:\n${sections.orientations}` : '',
    sections.warnings ? `Sinais de alerta:\n${sections.warnings}` : '',
    sections.whenUse ? `Quando usar:\n${sections.whenUse}` : '',
    sections.whenNotUse ? `Quando não usar:\n${sections.whenNotUse}` : '',
    sections.referral ? `Encaminhamento / Retorno:\n${sections.referral}` : '',
    sections.observations ? `Observações clínicas:\n${sections.observations}` : '',
  ].filter(Boolean).join('\n\n'));

  return {
    all,
    prescription,
    conduct,
    orientations,
  };
}

function buildGuideParams({ select, query = '', specialty = '', context = '', limit = MAX_SEARCH_RESULTS }) {
  const searchTerms = getSearchTerms(query);
  const params = new URLSearchParams({
    select,
    active: 'eq.true',
    status: 'eq.published',
    order: 'condition_name.asc',
    limit: String(normalizeLimit(limit)),
  });

  if (searchTerms.length > 0) {
    const orParts = searchTerms.flatMap((term) => [
      `condition_name.ilike.*${term}*`,
      `title.ilike.*${term}*`,
      `subcondition.ilike.*${term}*`,
      `specialty.ilike.*${term}*`,
    ]);
    params.set('or', `(${orParts.join(',')})`);
  }

  if (specialty) {
    params.set('specialty', `eq.${normalizeText(specialty)}`);
  }

  if (context) {
    params.set('contexts', `cs.{${normalizeText(context)}}`);
  }

  return params;
}

async function fetchGuideList(args) {
  const protocolParams = buildGuideParams({ ...args, select: GUIDE_PROTOCOL_SELECT });
  const fallbackParams = buildGuideParams({ ...args, select: GUIDE_SELECT });

  return requestWithSchemaFallback(
    `prescription_guides?${protocolParams.toString()}`,
    `prescription_guides?${fallbackParams.toString()}`,
    { method: 'GET' },
  );
}

async function listPrescriptionGuides({ query = '', specialty = '', context = '', limit = MAX_SEARCH_RESULTS } = {}) {
  if (!isPrescriptionGuidesStorageAvailable()) {
    return [];
  }

  const searchTerms = getSearchTerms(query);
  const json = await fetchGuideList({ query, specialty, context, limit });
  const directMatches = Array.isArray(json) ? json.map(mapGuideRow).filter(Boolean) : [];

  if (directMatches.length > 0 || searchTerms.length === 0) {
    return directMatches;
  }

  const fallbackParams = new URLSearchParams({
    select: GUIDE_PROTOCOL_SELECT,
    active: 'eq.true',
    status: 'eq.published',
    order: 'condition_name.asc',
    limit: '500',
  });

  const legacyFallbackParams = new URLSearchParams({
    select: GUIDE_SELECT,
    active: 'eq.true',
    status: 'eq.published',
    order: 'condition_name.asc',
    limit: '500',
  });

  if (specialty) {
    fallbackParams.set('specialty', `eq.${normalizeText(specialty)}`);
    legacyFallbackParams.set('specialty', `eq.${normalizeText(specialty)}`);
  }

  if (context) {
    fallbackParams.set('contexts', `cs.{${normalizeText(context)}}`);
    legacyFallbackParams.set('contexts', `cs.{${normalizeText(context)}}`);
  }

  const fallbackJson = await requestWithSchemaFallback(
    `prescription_guides?${fallbackParams.toString()}`,
    `prescription_guides?${legacyFallbackParams.toString()}`,
    { method: 'GET' },
  );
  const fallbackGuides = Array.isArray(fallbackJson)
    ? fallbackJson.map(mapGuideRow).filter(Boolean)
    : [];

  return fallbackGuides
    .filter((guide) => guideMatchesQuery(guide, query))
    .slice(0, normalizeLimit(limit));
}

async function getPrescriptionGuideBySlug(slug) {
  const normalizedSlug = normalizeText(slug);

  if (!normalizedSlug || !isPrescriptionGuidesStorageAvailable()) {
    return null;
  }

  const guideProtocolParams = new URLSearchParams({
    select: GUIDE_PROTOCOL_SELECT,
    slug: `eq.${normalizedSlug}`,
    active: 'eq.true',
    status: 'eq.published',
    limit: '1',
  });
  const guideFallbackParams = new URLSearchParams({
    select: GUIDE_SELECT,
    slug: `eq.${normalizedSlug}`,
    active: 'eq.true',
    status: 'eq.published',
    limit: '1',
  });

  const guideRows = await requestWithSchemaFallback(
    `prescription_guides?${guideProtocolParams.toString()}`,
    `prescription_guides?${guideFallbackParams.toString()}`,
    { method: 'GET' },
  );
  const guide = Array.isArray(guideRows) ? mapGuideRow(guideRows[0]) : null;

  if (!guide) {
    return null;
  }

  const itemParams = new URLSearchParams({
    select: ITEM_SELECT,
    guide_id: `eq.${guideRows[0].id}`,
    active: 'eq.true',
    review_status: 'neq.Não usar sem validação',
    order: 'order_index.asc,title.asc',
  });
  const itemRows = await requestPrescriptionGuides(`prescription_guide_items?${itemParams.toString()}`, { method: 'GET' });
  const items = Array.isArray(itemRows) ? itemRows.map(mapItemRow).filter(Boolean) : [];
  const sections = buildProtocolSections(guide, items);
  const copy = buildCopyPayload(guide, sections);

  return {
    ...guide,
    items,
    categories: groupItemsByCategory(items),
    sections,
    copy,
    copyText: copy.all,
  };
}

module.exports = {
  getPrescriptionGuideBySlug,
  isPrescriptionGuidesStorageAvailable,
  listPrescriptionGuides,
};

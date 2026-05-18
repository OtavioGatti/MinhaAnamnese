const NOTION_API_BASE_URL = 'https://api.notion.com/v1';
const DEFAULT_NOTION_VERSION = '2026-03-11';
const DEFAULT_PRESCRIPTIONS_DATA_SOURCE_ID = '1ea5a7f5-5c0f-4df8-b8aa-872788b513d0';
const MAX_SYNC_PAGES = 1000;

function normalizeNotionId(value) {
  return String(value || '')
    .replace(/^collection:\/\//, '')
    .replace(/-/g, '')
    .trim();
}

function getNotionPrescriptionGuidesConfig() {
  return {
    apiKey: process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || process.env.NOTION_ACCESS_TOKEN,
    dataSourceId: normalizeNotionId(
      process.env.NOTION_PRESCRIPTIONS_DATA_SOURCE_ID ||
        process.env.NOTION_PRESCRIPTION_GUIDES_DATA_SOURCE_ID ||
        process.env.NOTION_PROTOCOLS_DATA_SOURCE_ID ||
        process.env.NOTION_PRESCRIPTIONS_DATABASE_ID ||
        process.env.NOTION_PROTOCOLS_DATABASE_ID ||
        DEFAULT_PRESCRIPTIONS_DATA_SOURCE_ID,
    ),
    notionVersion: process.env.NOTION_VERSION || DEFAULT_NOTION_VERSION,
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isNotionPrescriptionGuidesSyncConfigured() {
  const { apiKey, dataSourceId, supabaseUrl, serviceRoleKey } = getNotionPrescriptionGuidesConfig();
  return Boolean(apiKey && dataSourceId && supabaseUrl && serviceRoleKey);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLongText(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
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
  const text = normalizeLongText(value);

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

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeSlug(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function normalizeStatusForGuide(statusRevisao, ready) {
  const normalized = stripAccents(statusRevisao).toLowerCase();

  if (!ready || normalized.includes('nao usar') || normalized.includes('rascunho')) {
    return 'draft';
  }

  return 'published';
}

function splitList(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }

  return normalizeLongText(value)
    .split(/[,;|\n]/g)
    .map(normalizeText)
    .filter(Boolean);
}

function normalizeCid10Code(value) {
  return normalizeText(value).toUpperCase().replace(/\s+/g, '');
}

function parsePrescriptionOptionCids(value) {
  const optionCids = {};
  const invalidLines = [];

  normalizeLongText(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = stripAccents(line).match(/^(?:opcao\s*)?(\d{1,2})\s*(?:[|:;\-])\s*(.+)$/i);

      if (!match) {
        invalidLines.push(line);
        return;
      }

      const optionNumber = String(Number.parseInt(match[1], 10));
      const cid10Code = normalizeCid10Code(match[2]);

      if (!optionNumber || !cid10Code) {
        invalidLines.push(line);
        return;
      }

      optionCids[optionNumber] = cid10Code;
    });

  return {
    optionCids,
    invalidLines,
  };
}

async function requestNotion(path, options = {}) {
  const { apiKey, notionVersion } = getNotionPrescriptionGuidesConfig();

  if (!apiKey) {
    const error = new Error('Notion API key is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${NOTION_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Notion-Version': notionVersion,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    const error = new Error('Unable to read prescription guides from Notion.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  return response.json();
}

async function requestSupabase(table, path, options = {}) {
  const { supabaseUrl, serviceRoleKey } = getNotionPrescriptionGuidesConfig();

  if (!supabaseUrl || !serviceRoleKey) {
    const error = new Error('Supabase service role is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${path}`, {
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
    const error = new Error('Unable to persist prescription guides in Supabase.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function richTextToPlainText(items) {
  if (!Array.isArray(items)) {
    return '';
  }

  return items
    .map((item) => item?.plain_text || item?.text?.content || '')
    .join('')
    .trim();
}

function readProperty(properties, name) {
  return properties?.[name] || null;
}

function readTextProperty(properties, name) {
  const property = readProperty(properties, name);

  if (!property) {
    return '';
  }

  if (Array.isArray(property.title)) {
    return richTextToPlainText(property.title);
  }

  if (Array.isArray(property.rich_text)) {
    return richTextToPlainText(property.rich_text);
  }

  if (property.type === 'select') {
    return property.select?.name || '';
  }

  if (property.type === 'status') {
    return property.status?.name || '';
  }

  if (property.type === 'number') {
    return property.number == null ? '' : String(property.number);
  }

  if (property.type === 'checkbox') {
    return property.checkbox ? 'true' : '';
  }

  if (property.type === 'date') {
    return property.date?.start || '';
  }

  return '';
}

function readSelectProperty(properties, name) {
  const property = readProperty(properties, name);
  return property?.select?.name || property?.status?.name || readTextProperty(properties, name);
}

function readMultiSelectProperty(properties, name) {
  const property = readProperty(properties, name);

  if (Array.isArray(property?.multi_select)) {
    return property.multi_select.map((item) => item?.name).filter(Boolean);
  }

  return splitList(readTextProperty(properties, name));
}

function readCheckboxProperty(properties, name) {
  const property = readProperty(properties, name);
  return Boolean(property?.checkbox);
}

function readDateProperty(properties, name) {
  const property = readProperty(properties, name);
  return property?.date?.start || null;
}

function buildCompleteCopyText(guide) {
  return [
    guide.title,
    guide.prescricao_medicamentos ? `Prescrição medicamentosa:\n${guide.prescricao_medicamentos}` : '',
    guide.conduta_procedimento ? `Conduta / Procedimento:\n${guide.conduta_procedimento}` : '',
    guide.orientacoes_paciente ? `Orientações ao paciente:\n${guide.orientacoes_paciente}` : '',
    guide.sinais_alerta ? `Sinais de alerta:\n${guide.sinais_alerta}` : '',
    guide.criterios_encaminhamento ? `Encaminhamento / Retorno:\n${guide.criterios_encaminhamento}` : '',
  ].filter(Boolean).join('\n\n');
}

function mapNotionPageToPrescriptionGuide(page, index) {
  const properties = page?.properties || {};
  const title = normalizeText(readTextProperty(properties, 'titulo'));
  const conditionName = title;
  const statusRevisao = normalizeText(readSelectProperty(properties, 'status_revisao'));
  const ready = readCheckboxProperty(properties, 'pronto_para_supabase');
  const slug = normalizeSlug(readTextProperty(properties, 'slug') || title);
  const contexts = readMultiSelectProperty(properties, 'contexto');
  const parsedOptionCids = parsePrescriptionOptionCids(readTextProperty(properties, 'cid10_opcoes'));

  const guide = {
    slug,
    title,
    condition_name: conditionName,
    cid10_primary: normalizeCid10Code(readTextProperty(properties, 'cid10_principal')) || null,
    specialty: normalizeText(readSelectProperty(properties, 'especialidade')) || null,
    subcondition: normalizeText(readTextProperty(properties, 'subcondicao')) || null,
    prescription_option_cids: parsedOptionCids.optionCids,
    contexts,
    status: normalizeStatusForGuide(statusRevisao, ready),
    active: ready && !stripAccents(statusRevisao).toLowerCase().includes('nao usar'),
    source: 'notion_protocols',
    tipo_protocolo: normalizeText(readSelectProperty(properties, 'tipo_protocolo')) || null,
    status_revisao: statusRevisao || null,
    nivel_risco: normalizeText(readSelectProperty(properties, 'nivel_risco')) || null,
    resumo_clinico: normalizeProtocolText(readTextProperty(properties, 'resumo_clinico')) || null,
    quando_usar: normalizeProtocolText(readTextProperty(properties, 'quando_usar')) || null,
    quando_nao_usar: normalizeProtocolText(readTextProperty(properties, 'quando_nao_usar')) || null,
    conduta_procedimento: normalizeProtocolText(readTextProperty(properties, 'conduta_procedimento')) || null,
    prescricao_medicamentos: normalizePrescriptionText(readTextProperty(properties, 'prescricao_medicamentos')) || null,
    orientacoes_paciente: normalizeProtocolText(readTextProperty(properties, 'orientacoes_paciente')) || null,
    sinais_alerta: normalizeProtocolText(readTextProperty(properties, 'sinais_alerta')) || null,
    criterios_encaminhamento: normalizeProtocolText(readTextProperty(properties, 'criterios_encaminhamento')) || null,
    observacoes_clinicas: normalizeProtocolText(readTextProperty(properties, 'observacoes_clinicas')) || null,
    texto_copiavel_conduta: normalizeProtocolText(readTextProperty(properties, 'texto_copiavel_conduta')) || null,
    texto_copiavel_prescricao: normalizePrescriptionText(readTextProperty(properties, 'texto_copiavel_prescricao')) || null,
    texto_copiavel_orientacoes: normalizeProtocolText(readTextProperty(properties, 'texto_copiavel_orientacoes')) || null,
    texto_copiavel_completo: normalizeProtocolText(readTextProperty(properties, 'texto_copiavel_completo')) || null,
    fonte: normalizeLongText(readTextProperty(properties, 'fonte')) || null,
    fonte_pagina: normalizeText(readTextProperty(properties, 'fonte_pagina')) || null,
    fonte_secao: normalizeText(readTextProperty(properties, 'fonte_secao')) || null,
    ultima_revisao: readDateProperty(properties, 'ultima_revisao'),
    revisor: normalizeText(readTextProperty(properties, 'revisor')) || null,
    tags: readMultiSelectProperty(properties, 'tags'),
    display_order: index + 1,
  };

  if (!guide.texto_copiavel_completo) {
    guide.texto_copiavel_completo = buildCompleteCopyText(guide) || null;
  }

  return {
    payload: guide,
    notionPageId: page?.id || null,
    notionUrl: page?.url || null,
    ready,
    optionCidParseErrors: parsedOptionCids.invalidLines,
  };
}

function validateGuidePayload(mapped) {
  const reasons = [];
  const guide = mapped.payload;

  if (!guide.slug) {
    reasons.push('missing_slug');
  }

  if (!guide.title) {
    reasons.push('missing_title');
  }

  if (!guide.condition_name) {
    reasons.push('missing_condition_name');
  }

  if (!guide.prescricao_medicamentos && !guide.conduta_procedimento && !guide.orientacoes_paciente) {
    reasons.push('missing_protocol_content');
  }

  if (mapped.optionCidParseErrors.length > 0) {
    reasons.push('invalid_cid10_option_lines');
  }

  return reasons.length > 0
    ? {
        slug: guide.slug || null,
        title: guide.title || null,
        notionPageId: mapped.notionPageId,
        reasons,
        invalidCid10OptionLines: mapped.optionCidParseErrors,
      }
    : null;
}

async function queryNotionPrescriptionGuidePages() {
  const { dataSourceId } = getNotionPrescriptionGuidesConfig();

  if (!dataSourceId) {
    const error = new Error('Notion prescription guides data source is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const pages = [];
  let startCursor = null;

  do {
    const body = {
      page_size: 100,
      in_trash: false,
      result_type: 'page',
      sorts: [
        { property: 'titulo', direction: 'ascending' },
      ],
      ...(startCursor ? { start_cursor: startCursor } : {}),
    };

    const response = await requestNotion(`/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (Array.isArray(response.results)) {
      pages.push(...response.results);
    }

    startCursor = response.has_more && pages.length < MAX_SYNC_PAGES
      ? response.next_cursor
      : null;
  } while (startCursor);

  return pages;
}

async function upsertPrescriptionGuides(guides) {
  if (!Array.isArray(guides) || guides.length === 0) {
    return [];
  }

  const query = new URLSearchParams({
    on_conflict: 'slug',
  });

  const json = await requestSupabase('prescription_guides', `?${query.toString()}`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(guides),
  });

  return Array.isArray(json) ? json : [];
}

async function syncNotionPrescriptionGuides() {
  const pages = await queryNotionPrescriptionGuidePages();
  const mapped = pages.map(mapNotionPageToPrescriptionGuide);
  const prepared = [];
  const skipped = [];

  mapped.forEach((guide) => {
    const validationError = validateGuidePayload(guide);

    if (validationError) {
      skipped.push(validationError);
      return;
    }

    prepared.push(guide.payload);
  });

  const persisted = await upsertPrescriptionGuides(prepared);

  return {
    totalFromNotion: pages.length,
    prepared: prepared.length,
    publishedAvailable: prepared.filter((guide) => guide.active && guide.status === 'published').length,
    persisted: persisted.length,
    skipped,
  };
}

module.exports = {
  getNotionPrescriptionGuidesConfig,
  isNotionPrescriptionGuidesSyncConfigured,
  mapNotionPageToPrescriptionGuide,
  queryNotionPrescriptionGuidePages,
  syncNotionPrescriptionGuides,
};

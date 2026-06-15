const {
  normalizeClinicalToolSchema,
  normalizeSlug,
  normalizeToolType,
} = require('./clinicalTools');

const DEFAULT_NOTION_VERSION = '2026-03-11';
const MAX_SYNC_PAGES = 1000;
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

function normalizeNotionId(value) {
  return String(value || '')
    .replace(/^collection:\/\//, '')
    .replace(/-/g, '')
    .trim();
}

function getNotionClinicalToolsConfig() {
  return {
    apiKey: process.env.NOTION_CLINICAL_TOOLS_TOKEN ||
      process.env.NOTION_TOKEN ||
      process.env.NOTION_API_KEY ||
      process.env.NOTION_ACCESS_TOKEN,
    dataSourceId: normalizeNotionId(
      process.env.NOTION_CLINICAL_TOOLS_DATA_SOURCE_ID ||
        process.env.NOTION_CLINICAL_TOOLS_DATABASE_ID ||
        '',
    ),
    notionVersion: process.env.NOTION_VERSION || DEFAULT_NOTION_VERSION,
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isNotionClinicalToolsSyncConfigured() {
  const { apiKey, dataSourceId, supabaseUrl, serviceRoleKey } = getNotionClinicalToolsConfig();
  return Boolean(apiKey && dataSourceId && supabaseUrl && serviceRoleKey);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLongText(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizePropertyKey(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizePublicationStatus(value) {
  const normalized = normalizePropertyKey(value);

  if (normalized === 'published' || normalized === 'publicado') {
    return 'published';
  }

  if (normalized === 'archived' || normalized === 'arquivado') {
    return 'archived';
  }

  return 'draft';
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

  if (Array.isArray(property.multi_select)) {
    return property.multi_select.map((item) => item?.name).filter(Boolean).join('\n');
  }

  if (property.type === 'url') {
    return property.url || '';
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

function readFirstTextProperty(properties, names) {
  for (const name of names) {
    const value = readTextProperty(properties, name);

    if (value) {
      return value;
    }
  }

  return '';
}

function readFirstExistingTextProperty(properties, aliases) {
  const normalizedAliases = new Set(aliases.map(normalizePropertyKey));

  for (const [propertyName, property] of Object.entries(properties || {})) {
    if (!normalizedAliases.has(normalizePropertyKey(propertyName))) {
      continue;
    }

    const value = readTextProperty({ [propertyName]: property }, propertyName);

    if (value) {
      return value;
    }
  }

  return '';
}

function parseJsonProperty(properties, aliases, fallback) {
  const raw = normalizeLongText(readFirstExistingTextProperty(properties, aliases));

  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const parseError = new Error(`JSON invalido em "${aliases[0]}": ${error.message}`);
    parseError.statusCode = 422;
    throw parseError;
  }
}

function buildSearchTerms(tool) {
  return [
    tool.title,
    tool.category,
    tool.subcategory,
    tool.description,
    tool.source_reference,
    tool.tool_type,
    ...(Array.isArray(tool.fields) ? tool.fields.map((field) => field?.label || field?.id || '') : []),
  ]
    .map(normalizeLongText)
    .filter(Boolean)
    .join('\n');
}

async function requestNotion(path, options = {}) {
  const { apiKey, notionVersion } = getNotionClinicalToolsConfig();

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
    const error = new Error('Unable to read clinical tools from Notion.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  return response.json();
}

async function requestSupabase(table, path, options = {}) {
  const { supabaseUrl, serviceRoleKey } = getNotionClinicalToolsConfig();

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
    const error = new Error('Unable to persist clinical tools in Supabase.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function mapSchemaJsonToColumns(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return {};
  }

  return {
    slug: schema.slug || schema.id,
    title: schema.title || schema.titulo,
    category: schema.category || schema.categoria,
    subcategory: schema.subcategory || schema.subcategoria,
    description: schema.description || schema.descricao,
    source_reference: schema.source_reference || schema.fonte_referencia,
    tool_type: schema.tool_type || schema.tipo_motor,
    engine_config: schema.engine_config || schema.config_motor,
    fields: schema.fields || schema.campos,
    result_ranges: schema.result_ranges || schema.faixas_resultado,
  };
}

function mapNotionPageToClinicalTool(page) {
  const properties = page?.properties || {};
  const schema = mapSchemaJsonToColumns(parseJsonProperty(properties, ['Schema JSON', 'JSON', 'Schema'], {}));
  const title = normalizeText(
    readFirstExistingTextProperty(properties, ['titulo', 'title', 'nome', 'name']) ||
      schema.title,
  );
  const slug = normalizeSlug(readFirstExistingTextProperty(properties, ['Slug']) || schema.slug || title);
  const toolType = normalizeToolType(
    readFirstExistingTextProperty(properties, ['Tipo Motor', 'Tipo do Motor', 'tipo_motor', 'Tool Type']) ||
      schema.tool_type,
  );
  const engineConfig = parseJsonProperty(
    properties,
    ['config motor', 'configuracao motor', 'config_motor', 'engine_config', 'engine config'],
    schema.engine_config || {},
  );
  const fields = parseJsonProperty(
    properties,
    ['Campos', 'campos', 'Fields'],
    schema.fields || [],
  );
  const resultRanges = parseJsonProperty(
    properties,
    ['Faixas Resultado', 'Faixas de Resultado', 'faixas_resultado', 'Result Ranges'],
    schema.result_ranges || [],
  );

  const tool = {
    slug,
    notion_page_id: page?.id || null,
    title,
    category: normalizeText(
      readFirstExistingTextProperty(properties, ['Categoria', 'Category']) ||
        schema.category,
    ) || null,
    subcategory: normalizeText(
      readFirstExistingTextProperty(properties, ['Subcategoria', 'Subcategoria / Grupo', 'Subcategory']) ||
        schema.subcategory,
    ) || null,
    description: normalizeLongText(
      readFirstExistingTextProperty(properties, ['descricao', 'description']) ||
        schema.description,
    ) || null,
    source_reference: normalizeLongText(
      readFirstExistingTextProperty(properties, [
        'fonte referencia',
        'fonte',
        'source_reference',
      ]) || schema.source_reference,
    ) || null,
    tool_type: toolType,
    engine_config: engineConfig && typeof engineConfig === 'object' && !Array.isArray(engineConfig) ? engineConfig : {},
    fields: Array.isArray(fields) ? fields : [],
    result_ranges: Array.isArray(resultRanges) ? resultRanges : [],
    status: normalizePublicationStatus(readFirstExistingTextProperty(properties, [
      'status publicacao',
      'status',
      'publication status',
    ])),
    source_updated_at: page?.last_edited_time || null,
    synced_at: new Date().toISOString(),
    sync_status: 'synced',
    sync_error: null,
  };
  const normalizedTool = normalizeClinicalToolSchema({
    id: tool.notion_page_id || tool.slug,
    slug: tool.slug,
    title: tool.title,
    category: tool.category,
    subcategory: tool.subcategory,
    description: tool.description,
    source_reference: tool.source_reference,
    tool_type: tool.tool_type,
    engine_config: tool.engine_config,
    fields: tool.fields,
    result_ranges: tool.result_ranges,
    status: tool.status,
    updated_at: tool.source_updated_at,
  });
  const reasons = [];

  if (!tool.slug) {
    reasons.push('missing_slug');
  }

  if (!tool.title) {
    reasons.push('missing_title');
  }

  if (tool.status === 'published' && !normalizedTool?.validation?.valid) {
    reasons.push(...(normalizedTool?.validation?.errors || ['invalid_schema']));
  }

  if (reasons.length > 0) {
    return {
      payload: null,
      error: {
        notionPageId: page?.id || null,
        title: title || null,
        slug: slug || null,
        reasons,
      },
    };
  }

  tool.search_terms = buildSearchTerms(tool);

  return {
    payload: tool,
    error: null,
  };
}

async function queryNotionClinicalToolPages() {
  const { dataSourceId } = getNotionClinicalToolsConfig();

  if (!dataSourceId) {
    const error = new Error('Notion clinical tools data source is not configured.');
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

async function upsertClinicalTools(tools) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return [];
  }

  const query = new URLSearchParams({
    on_conflict: 'notion_page_id',
  });

  const json = await requestSupabase('clinical_tools', `?${query.toString()}`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(tools),
  });

  return Array.isArray(json) ? json : [];
}

function findDuplicateSlugs(tools) {
  const seen = new Map();
  const duplicates = [];

  tools.forEach((tool) => {
    if (!tool?.slug) {
      return;
    }

    if (seen.has(tool.slug)) {
      duplicates.push({
        slug: tool.slug,
        first: seen.get(tool.slug),
        duplicate: {
          notionPageId: tool.notion_page_id,
          title: tool.title,
        },
      });
      return;
    }

    seen.set(tool.slug, {
      notionPageId: tool.notion_page_id,
      title: tool.title,
    });
  });

  return duplicates;
}

async function syncNotionClinicalTools() {
  const pages = await queryNotionClinicalToolPages();
  const mapped = [];
  const skipped = [];

  for (const page of pages) {
    try {
      const mappedTool = mapNotionPageToClinicalTool(page);

      if (mappedTool.error) {
        skipped.push(mappedTool.error);
      } else {
        mapped.push(mappedTool.payload);
      }
    } catch (error) {
      skipped.push({
        notionPageId: page?.id || null,
        title: readFirstExistingTextProperty(page?.properties || {}, ['titulo', 'title', 'nome', 'name']) || null,
        reasons: [error.message || 'mapping_error'],
      });
    }
  }

  const duplicateSlugs = findDuplicateSlugs(mapped);

  if (duplicateSlugs.length > 0) {
    const error = new Error('duplicate_slug_in_notion_batch');
    error.statusCode = 409;
    error.responseBody = JSON.stringify({
      code: 'duplicate_slug_in_notion_batch',
      duplicates: duplicateSlugs,
    });
    throw error;
  }

  const persisted = await upsertClinicalTools(mapped);

  return {
    totalFromNotion: pages.length,
    synced: persisted.length,
    skipped,
  };
}

module.exports = {
  getNotionClinicalToolsConfig,
  isNotionClinicalToolsSyncConfigured,
  mapNotionPageToClinicalTool,
  queryNotionClinicalToolPages,
  syncNotionClinicalTools,
};

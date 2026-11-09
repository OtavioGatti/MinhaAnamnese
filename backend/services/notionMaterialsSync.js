// Sincroniza a base "Materiais" do Notion com a tabela clinical_materials.
//
// Diferença para os outros syncs: aqui há ARQUIVO. O link de um anexo do Notion
// expira em cerca de 1 hora, então o PDF é copiado para o Storage do Supabase
// (bucket privado "materiais") e o site só entrega a cópia. A cópia só é refeita
// quando a página mudou no Notion desde a última vez.
//
// Como nos protocolos, a linha que perdeu a página no Notion é arquivada.

const {
  MATERIALS_BUCKET,
  buildMaterialSearchTerms,
  isSafeExternalUrl,
  normalizeMaterialSlug,
  normalizeMaterialType,
} = require('./clinicalMaterials');

const DEFAULT_NOTION_VERSION = '2026-03-11';
// Base "Materiais" criada em 09/11/2026. O id não é segredo; fica como padrão
// para a rota funcionar sem variável nova no Render.
const DEFAULT_MATERIALS_DATA_SOURCE_ID = 'e736329b-b076-49aa-ad1d-88890223121d';
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';
const MAX_SYNC_PAGES = 500;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const PUBLICATION_STATUSES = new Set(['draft', 'published', 'archived']);

function normalizeNotionId(value) {
  return String(value || '').replace(/^collection:\/\//, '').replace(/-/g, '').trim();
}

function getNotionMaterialsConfig() {
  return {
    apiKey: process.env.NOTION_MATERIALS_TOKEN ||
      process.env.NOTION_TOKEN ||
      process.env.NOTION_API_KEY ||
      process.env.NOTION_ACCESS_TOKEN,
    dataSourceId: normalizeNotionId(
      process.env.NOTION_MATERIALS_DATA_SOURCE_ID || DEFAULT_MATERIALS_DATA_SOURCE_ID,
    ),
    notionVersion: process.env.NOTION_VERSION || DEFAULT_NOTION_VERSION,
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isNotionMaterialsSyncConfigured() {
  const { apiKey, dataSourceId, supabaseUrl, serviceRoleKey } = getNotionMaterialsConfig();
  return Boolean(apiKey && dataSourceId && supabaseUrl && serviceRoleKey);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function richTextToPlainText(items) {
  return (Array.isArray(items) ? items : []).map((item) => item?.plain_text || '').join('');
}

function readText(properties, name) {
  const property = properties?.[name];

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

  if (property.type === 'url') {
    return property.url || '';
  }

  if (property.type === 'number') {
    return property.number == null ? '' : String(property.number);
  }

  return '';
}

function readFirstFile(properties, name) {
  const files = properties?.[name]?.files;
  const first = Array.isArray(files) ? files[0] : null;

  if (!first) {
    return null;
  }

  const url = first.file?.url || first.external?.url || '';
  return url ? { name: normalizeText(first.name) || 'arquivo.pdf', url } : null;
}

function normalizePublicationStatus(value) {
  const status = normalizeText(value).toLowerCase();
  return PUBLICATION_STATUSES.has(status) ? status : 'draft';
}

/**
 * Página do Notion → linha da tabela (sem o arquivo). Devolve também o anexo a
 * copiar e os motivos que impedem a publicação. Página publicada com problema
 * NÃO é gravada: a linha antiga fica como estava.
 */
function mapNotionPageToMaterial(page) {
  const properties = page?.properties || {};
  const title = normalizeText(readText(properties, 'Título'));
  const slug = normalizeMaterialSlug(readText(properties, 'Slug') || title);
  const rawType = readText(properties, 'Tipo');
  const materialType = normalizeMaterialType(rawType);
  const status = normalizePublicationStatus(readText(properties, 'Status Publicação'));
  const externalUrl = normalizeText(readText(properties, 'Link oficial'));
  const credit = normalizeText(readText(properties, 'Crédito'));
  const file = readFirstFile(properties, 'Arquivo');
  const order = Number.parseInt(readText(properties, 'Ordem'), 10);
  const reasons = [];

  if (!title) {
    reasons.push('título vazio');
  }

  if (!slug) {
    reasons.push('slug vazio');
  }

  // Tipo desconhecido é recusado, nunca coagido: o tipo decide quem acessa.
  if (!materialType) {
    reasons.push(`tipo desconhecido: "${rawType || 'vazio'}"`);
  }

  if (status === 'published') {
    if (materialType === 'link_oficial') {
      if (!isSafeExternalUrl(externalUrl)) {
        reasons.push('link oficial ausente ou sem https');
      }
    } else if (materialType && !file) {
      reasons.push('PDF não anexado');
    }

    // Escala de terceiros só vai ao ar com o crédito exigido pela licença.
    if (materialType === 'escala_livre' && !credit) {
      reasons.push('escala livre sem crédito');
    }
  }

  if (reasons.length > 0) {
    return {
      payload: null,
      file: null,
      error: { notionPageId: page?.id || null, title: title || null, slug: slug || null, reasons },
    };
  }

  const payload = {
    slug,
    notion_page_id: page?.id || null,
    title,
    category: normalizeText(readText(properties, 'Categoria')) || null,
    description: normalizeText(readText(properties, 'Descrição')) || null,
    material_type: materialType,
    credit: credit || null,
    external_url: materialType === 'link_oficial' ? externalUrl || null : null,
    status,
    display_order: Number.isFinite(order) ? order : 1000,
    source_updated_at: page?.last_edited_time || null,
    synced_at: new Date().toISOString(),
    sync_status: 'synced',
    sync_error: null,
  };

  payload.search_terms = buildMaterialSearchTerms(payload);

  return {
    payload,
    file: materialType === 'link_oficial' ? null : file,
    error: null,
  };
}

function isPdfBuffer(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length > 4 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

// O arquivo só é copiado de novo se a página mudou desde a última cópia.
function needsFileCopy(existingRow, payload) {
  if (!existingRow?.storage_path) {
    return true;
  }

  if (existingRow.storage_path !== `${payload.slug}.pdf`) {
    return true;
  }

  // O banco devolve a data em outro formato de texto; compara o instante.
  return new Date(existingRow.source_updated_at || 0).getTime() !== new Date(payload.source_updated_at || 0).getTime();
}

function findOrphanPageIds(existingRows, notionPageIds) {
  const alive = new Set(notionPageIds.map(normalizeNotionId));

  return (existingRows || [])
    .filter((row) => row.notion_page_id && row.status !== 'archived')
    .filter((row) => !alive.has(normalizeNotionId(row.notion_page_id)))
    .map((row) => row.notion_page_id);
}

async function requestNotion(path, options = {}) {
  const { apiKey, notionVersion } = getNotionMaterialsConfig();
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
    const error = new Error('Unable to read materials from Notion.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  return response.json();
}

async function requestSupabase(path, options = {}) {
  const { supabaseUrl, serviceRoleKey } = getNotionMaterialsConfig();
  const response = await fetch(`${supabaseUrl}${path}`, {
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
    const error = new Error('Unable to persist materials in Supabase.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json().catch(() => null);
}

async function queryNotionMaterialPages() {
  const { dataSourceId } = getNotionMaterialsConfig();
  const pages = [];
  let startCursor = null;

  do {
    const response = await requestNotion(`/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        page_size: 100,
        result_type: 'page',
        ...(startCursor ? { start_cursor: startCursor } : {}),
      }),
    });

    if (Array.isArray(response.results)) {
      pages.push(...response.results);
    }

    startCursor = response.has_more && pages.length < MAX_SYNC_PAGES ? response.next_cursor : null;
  } while (startCursor);

  return pages;
}

async function copyFileToStorage(file, slug) {
  const download = await fetch(file.url);

  if (!download.ok) {
    throw new Error(`não foi possível baixar o anexo do Notion (HTTP ${download.status})`);
  }

  const buffer = Buffer.from(await download.arrayBuffer());

  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error('PDF maior que 15 MB');
  }

  if (!isPdfBuffer(buffer)) {
    throw new Error('o anexo não é um PDF');
  }

  const storagePath = `${slug}.pdf`;

  await requestSupabase(`/storage/v1/object/${MATERIALS_BUCKET}/${encodeURIComponent(storagePath)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: buffer,
  });

  return {
    storage_path: storagePath,
    file_name: /\.pdf$/i.test(file.name) ? file.name : `${slug}.pdf`,
    file_size: buffer.length,
    file_synced_at: new Date().toISOString(),
  };
}

async function syncNotionMaterials() {
  const pages = await queryNotionMaterialPages();
  const existingRows = await requestSupabase(
    '/rest/v1/clinical_materials?select=notion_page_id,slug,status,storage_path,source_updated_at&limit=1000',
    { method: 'GET' },
  ) || [];
  const existingByPage = new Map(existingRows.map((row) => [normalizeNotionId(row.notion_page_id), row]));
  const seenSlugs = new Set();
  const payloads = [];
  const skipped = [];
  let filesCopied = 0;

  for (const page of pages) {
    const mapped = mapNotionPageToMaterial(page);

    if (mapped.error) {
      skipped.push(mapped.error);
      continue;
    }

    const { payload, file } = mapped;

    if (seenSlugs.has(payload.slug)) {
      skipped.push({ notionPageId: page.id, title: payload.title, slug: payload.slug, reasons: ['slug repetido na base'] });
      continue;
    }

    try {
      if (file && needsFileCopy(existingByPage.get(normalizeNotionId(page.id)), payload)) {
        Object.assign(payload, await copyFileToStorage(file, payload.slug));
        filesCopied += 1;
      }
    } catch (error) {
      skipped.push({ notionPageId: page.id, title: payload.title, slug: payload.slug, reasons: [error.message] });
      continue;
    }

    seenSlugs.add(payload.slug);
    payloads.push(payload);
  }

  // PostgREST exige as mesmas chaves em todas as linhas de um upsert em lote:
  // quem copiou arquivo tem colunas a mais, então vão em dois lotes.
  const groups = [payloads.filter((row) => row.storage_path), payloads.filter((row) => !row.storage_path)];
  let synced = 0;

  for (const group of groups) {
    if (group.length === 0) {
      continue;
    }

    const persisted = await requestSupabase('/rest/v1/clinical_materials?on_conflict=notion_page_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(group),
    });

    synced += Array.isArray(persisted) ? persisted.length : 0;
  }

  // Sem nenhuma página lida não se arquiva nada: resposta vazia do Notion (base
  // sem acesso, por exemplo) não pode tirar o catálogo inteiro do ar.
  const orphanPageIds = pages.length > 0
    ? findOrphanPageIds(existingRows, pages.map((page) => page.id))
    : [];

  for (const pageId of orphanPageIds) {
    await requestSupabase(`/rest/v1/clinical_materials?notion_page_id=eq.${encodeURIComponent(pageId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'archived', sync_status: 'orphan', synced_at: new Date().toISOString() }),
    });
  }

  return {
    totalFromNotion: pages.length,
    synced,
    filesCopied,
    archivedOrphans: orphanPageIds.length,
    skipped,
  };
}

module.exports = {
  findOrphanPageIds,
  getNotionMaterialsConfig,
  isNotionMaterialsSyncConfigured,
  isPdfBuffer,
  mapNotionPageToMaterial,
  needsFileCopy,
  syncNotionMaterials,
};

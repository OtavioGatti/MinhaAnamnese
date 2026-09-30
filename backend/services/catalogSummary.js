// Tamanho do catálogo publicado, para a oferta do Plano Profissional mostrar
// números reais ("568 medicamentos no bulário") em vez de promessa genérica.
//
// Conta só o que o assinante enxerga: o mesmo filtro de publicação que cada
// serviço aplica na leitura. O número muda devagar (sync do Notion), então fica
// em memória por algumas horas — a rota é pública e não pode virar uma consulta
// ao Supabase por visita.

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const CATALOG_SOURCES = {
  clinicalDrugs: { table: 'clinical_drugs', filter: 'publication_status=eq.published' },
  prescriptionGuides: { table: 'prescription_guides', filter: 'status=eq.published' },
  clinicalTools: { table: 'clinical_tools', filter: 'status=eq.published' },
  maneuvers: { table: 'physical_exam_maneuvers', filter: 'status=eq.published' },
  exams: { table: 'diagnostic_exams', filter: 'status=eq.published' },
};

let cache = null;
let pending = null;

function getConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

// "0-0/568" ou "*/568" → 568. Sem total legível → null.
function parseContentRangeTotal(header) {
  const match = String(header || '').match(/\/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

async function countPublished({ table, filter }) {
  const { url, serviceRoleKey } = getConfig();
  const response = await fetch(`${url}/rest/v1/${table}?select=id&${filter}&limit=1`, {
    method: 'HEAD',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'count=exact',
    },
  });

  if (!response.ok) {
    return null;
  }

  return parseContentRangeTotal(response.headers.get('content-range'));
}

async function loadCatalogSummary() {
  const entries = await Promise.all(
    Object.entries(CATALOG_SOURCES).map(async ([key, source]) => [
      key,
      await countPublished(source).catch(() => null),
    ]),
  );

  return Object.fromEntries(entries);
}

function hasAnyCount(summary) {
  return Object.values(summary || {}).some((value) => Number.isFinite(value));
}

async function getCatalogSummary({ now = Date.now() } = {}) {
  const { url, serviceRoleKey } = getConfig();

  if (!url || !serviceRoleKey) {
    return null;
  }

  if (cache && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.summary;
  }

  if (!pending) {
    pending = loadCatalogSummary()
      .then((summary) => {
        // Falha total não apaga o último número bom.
        if (hasAnyCount(summary)) {
          cache = { summary, loadedAt: now };
        }

        return cache?.summary || null;
      })
      .finally(() => {
        pending = null;
      });
  }

  return pending;
}

function resetCatalogSummaryCache() {
  cache = null;
  pending = null;
}

module.exports = {
  CATALOG_SOURCES,
  getCatalogSummary,
  parseContentRangeTotal,
  resetCatalogSummaryCache,
};

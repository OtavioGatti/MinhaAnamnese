// Log de auditoria da automação de protocolos.
//
// Durável no Supabase (tabela protocol_automation_audit) quando configurado;
// caso contrário, faz append best-effort em um arquivo JSONL. A rota de
// automação também devolve as entradas na resposta HTTP, então o operador
// enxerga o que aconteceu mesmo sem persistência durável.

const fs = require('fs');
const path = require('path');

const AUDIT_FILE = process.env.PROTOCOL_AUDIT_FILE ||
  path.join(__dirname, '..', 'data', 'protocol_automation_audit.jsonl');

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

// Colunas conhecidas da tabela (o resto do entry fica só no arquivo/resposta).
function toSupabaseRow(entry) {
  return {
    page_id: entry.page_id || null,
    titulo: entry.titulo || null,
    action: entry.action || null,
    source: entry.source || 'automacao',
    ok: entry.ok !== false,
    changed_fields: entry.changed_fields || [],
    status_automacao: entry.status_automacao || null,
    error: entry.error || null,
  };
}

async function insertSupabase(entry) {
  const { url, key } = getSupabaseConfig();

  if (!url || !key) {
    return false;
  }

  try {
    const res = await fetch(`${url}/rest/v1/protocol_automation_audit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(toSupabaseRow(entry)),
    });
    return res.ok;
  } catch (_error) {
    return false;
  }
}

function appendFile(entry) {
  try {
    fs.appendFileSync(AUDIT_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Registra uma entrada de auditoria. Nunca lança — a auditoria não pode
 * derrubar a automação. Retorna a entrada com o destino de persistência.
 */
async function recordAudit(entry) {
  const normalized = {
    source: 'automacao',
    timestamp: new Date().toISOString(),
    ...entry,
  };

  const persistedSupabase = await insertSupabase(normalized);
  const persistedFile = persistedSupabase ? false : appendFile(normalized);

  return {
    ...normalized,
    persisted: persistedSupabase ? 'supabase' : (persistedFile ? 'file' : 'memory'),
  };
}

module.exports = {
  recordAudit,
  toSupabaseRow,
  AUDIT_FILE,
};

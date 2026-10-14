// Leads com celular, para o dono. Só com o bearer ADMIN_SYNC_SECRET: aqui sai
// dado pessoal, então NÃO aceita o link assinado do painel de métricas (que
// pode ser compartilhado).
//
//   GET /api/admin/leads                → JSON, só quem tem celular
//   GET /api/admin/leads?todos=1        → inclui contas sem celular
//   GET /api/admin/leads?formato=csv    → planilha (Excel em português)

const { buildLeadsCsv, listLeads } = require('../../services/leads');
const { hasAdminSecretConfigured, isAuthorizedAdminRequest } = require('../../utils/adminAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const RATE_LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 };

function getQueryParam(req, name) {
  if (typeof req.query?.[name] === 'string') {
    return req.query[name];
  }

  const url = new URL(req.url || '/api/admin/leads', 'http://localhost');
  return url.searchParams.get(name) || '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }

  const rateLimit = await consumeRateLimit({ req, scope: 'admin_leads', ...RATE_LIMIT });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!hasAdminSecretConfigured()) {
    return res.status(503).json({ success: false, error: 'Administração não configurada.' });
  }

  if (!isAuthorizedAdminRequest(req)) {
    return res.status(401).json({ success: false, error: 'Acesso não autorizado.' });
  }

  try {
    const leads = await listLeads({ includeWithoutPhone: getQueryParam(req, 'todos') === '1' });

    if (getQueryParam(req, 'formato') === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="leads-minha-anamnese.csv"');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200);
      return res.end(buildLeadsCsv(leads));
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, data: { total: leads.length, leads } });
  } catch (error) {
    if (error?.code === 'PHONE_COLUMNS_MISSING') {
      return res.status(503).json({
        success: false,
        error: 'Aplique supabase/profile_phone.sql no Supabase antes de exportar os leads.',
      });
    }

    console.error('admin leads failed', { code: error?.code || 'unknown' });
    return res.status(503).json({ success: false, error: 'Não foi possível listar os leads agora.' });
  }
};

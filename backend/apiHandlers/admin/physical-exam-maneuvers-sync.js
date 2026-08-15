// Sync manual/agendado do CMS de manobras de exame físico (Notion -> Supabase).
// Mesmo contrato das outras rotas de sync: POST + bearer com ADMIN_SYNC_SECRET.

const {
  isNotionManeuversSyncConfigured,
  syncNotionPhysicalExamManeuvers,
} = require('../../services/notionPhysicalExamManeuversSync');
const {
  hasAdminSecretConfigured,
  isAuthorizedAdminRequest,
} = require('../../utils/adminAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const SYNC_RATE_LIMIT = {
  limit: 10,
  windowMs: 10 * 60 * 1000,
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'physical_exam_maneuvers_sync',
    limit: SYNC_RATE_LIMIT.limit,
    windowMs: SYNC_RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!hasAdminSecretConfigured()) {
    return res.status(503).json({ success: false, error: 'Rotas administrativas não configuradas.' });
  }

  if (!isAuthorizedAdminRequest(req)) {
    return res.status(401).json({ success: false, error: 'Acesso não autorizado.' });
  }

  if (!isNotionManeuversSyncConfigured()) {
    return res.status(503).json({ success: false, error: 'Integração com Notion não configurada.' });
  }

  try {
    // Sync manual: quem clicou foi o humano, então o que está "aguardando
    // revisão" pode publicar. O webhook automático (se existir) não passa isso.
    const data = await syncNotionPhysicalExamManeuvers({ bypassReviewGate: true });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const responseBody = String(error?.responseBody || '');
    const isNotionAccessError = responseBody.includes('Could not find')
      || responseBody.includes('shared with your integration')
      || responseBody.includes('object_not_found');

    if (isNotionAccessError) {
      return res.status(502).json({
        success: false,
        error: 'A integração do Notion usada pelo backend não tem acesso à tabela de Manobras.',
        details: responseBody.slice(0, 1000),
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      error: 'Falha ao sincronizar as Manobras de Exame Físico.',
      details: responseBody.slice(0, 1000) || error?.message || 'Erro desconhecido',
    });
  }
};

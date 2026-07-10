const apiRoutes = {
  '/api/templates': require('./templates'),
  '/api/anamneses': require('./anamneses'),
  '/api/organizar': require('./organizar'),
  '/api/insights': require('./insights'),
  '/api/referral-letter': require('./referral-letter'),
  '/api/diagnostic-hypotheses': require('./diagnostic-hypotheses'),
  '/api/profile': require('./profile'),
  '/api/health': require('./health'),
  '/api/analytics': require('./analytics'),
  '/api/create-checkout': require('./create-checkout'),
  '/api/reconcile-subscription': require('./reconcile-subscription'),
  '/api/cancel-subscription': require('./cancel-subscription'),
  '/api/prescription-guides': require('./prescription-guides'),
  '/api/clinical-drugs': require('./clinical-drugs'),
  '/api/clinical-tools': require('./clinical-tools'),
  '/api/affiliate': require('./affiliate'),
  '/api/affiliate/lookup': require('./affiliate-lookup'),
  '/api/affiliate/payouts': require('./affiliate-payouts'),
  '/api/affiliate-payout-action': require('./affiliate-payout-action'),
  '/api/admin/affiliates/update': require('./admin/affiliates-update'),
  '/api/admin/affiliate-payouts/settle': require('./admin/affiliate-payouts-settle'),
  '/api/admin/prompts/sync': require('./admin/prompts-sync'),
  '/api/admin/prescription-guides/sync': require('./admin/prescription-guides-sync'),
  '/api/admin/clinical-drugs/sync': require('./admin/clinical-drugs-sync'),
  '/api/admin/clinical-tools/sync': require('./admin/clinical-tools-sync'),
  '/api/admin/templates/sync': require('./admin/templates-sync'),
  '/api/admin/protocols/generate-preview': require('./admin/protocol-generate-preview'),
  '/api/admin/protocols/availability-report': require('./admin/protocol-availability-report'),
  '/api/admin/protocols/automation-run': require('./admin/protocol-automation-run'),
  '/api/admin/protocols/recompute-availability': require('./admin/protocol-recompute-availability'),
  '/api/admin/trial-reminders/run': require('./admin/trial-reminders-run'),
  '/api/webhook/mercadopago': require('./webhook/mercadopago'),
  '/api/webhook/notion/prescription-guides': require('./webhook/notion/prescription-guides'),
  '/api/webhook/notion/templates': require('./webhook/notion/templates'),
};

function normalizeApiPath(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  let pathname = url.pathname.replace(/\/+$/, '') || '/';

  if (!pathname.startsWith('/api')) {
    pathname = `/api/${pathname.replace(/^\/+/, '')}`;
  }

  return pathname.replace(/\/+$/, '') || '/api';
}

async function handleApiRequest(req, res) {
  const pathname = normalizeApiPath(req);
  const handler = apiRoutes[pathname];

  if (!handler) {
    return res.status(404).json({
      success: false,
      error: 'Endpoint nao encontrado',
    });
  }

  try {
    return await handler(req, res);
  } catch (error) {
    console.error(`Unhandled API route error on ${pathname}:`, error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
      });
    }

    return null;
  }
}

module.exports = {
  apiRoutes,
  handleApiRequest,
  normalizeApiPath,
};

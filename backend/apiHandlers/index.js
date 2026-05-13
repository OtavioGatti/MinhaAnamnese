const apiRoutes = {
  '/api/templates': require('./templates'),
  '/api/anamneses': require('./anamneses'),
  '/api/organizar': require('./organizar'),
  '/api/insights': require('./insights'),
  '/api/profile': require('./profile'),
  '/api/health': require('./health'),
  '/api/analytics': require('./analytics'),
  '/api/create-checkout': require('./create-checkout'),
  '/api/prescription-guides': require('./prescription-guides'),
  '/api/admin/prescription-guides/sync': require('./admin/prescription-guides-sync'),
  '/api/admin/templates/sync': require('./admin/templates-sync'),
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

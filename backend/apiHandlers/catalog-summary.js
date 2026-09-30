const { getCatalogSummary } = require('../services/catalogSummary');

// Números do catálogo publicado para a oferta do Plano Profissional. Pública e
// sem rate limit de propósito: responde da memória (ver catalogSummary.js), e
// consultar o limite no Supabase custaria mais que a própria resposta.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido.',
    });
  }

  const summary = await getCatalogSummary().catch(() => null);

  if (!summary) {
    return res.status(503).json({
      success: false,
      error: 'Catálogo indisponível no momento.',
    });
  }

  if (typeof res.setHeader === 'function') {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }

  return res.status(200).json({
    success: true,
    data: summary,
  });
};

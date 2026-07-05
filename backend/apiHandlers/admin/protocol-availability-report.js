// RELATÓRIO de disponibilidade de medicamentos de uma prescrição existente.
// Aceita o texto da prescrição direto (texto_copiavel_prescricao) ou um slug de
// guia publicado no Supabase. É a rota do critério de aceite nº 2.
//
// Apenas relata — nunca reescreve o texto clínico.

const { buildAvailabilityReport } = require('../../services/medicationAvailability');
const {
  getPrescriptionGuideBySlug,
  isPrescriptionGuidesStorageAvailable,
} = require('../../services/prescriptionGuides');
const {
  isProtocolSecretConfigured,
  isAuthorizedProtocolRequest,
} = require('../../utils/protocolAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const RATE_LIMIT = {
  limit: 20,
  windowMs: 10 * 60 * 1000,
};

async function resolvePrescription(body) {
  const inlineText = body.texto_copiavel_prescricao || body.prescricao || body.texto;

  if (typeof inlineText === 'string' && inlineText.trim()) {
    return { text: inlineText, source: 'inline' };
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';

  if (!slug) {
    return { text: '', source: 'none' };
  }

  if (!isPrescriptionGuidesStorageAvailable()) {
    const error = new Error('Busca por slug indisponível: Supabase não configurado. Envie texto_copiavel_prescricao no corpo.');
    error.statusCode = 503;
    throw error;
  }

  const guide = await getPrescriptionGuideBySlug(slug);

  if (!guide) {
    const error = new Error(`Nenhum guia publicado encontrado para o slug "${slug}".`);
    error.statusCode = 404;
    throw error;
  }

  return {
    text: guide.copy?.prescription || guide.copyText || '',
    source: 'supabase_slug',
    slug,
    title: guide.title || null,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'protocol_availability_report',
    limit: RATE_LIMIT.limit,
    windowMs: RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!isProtocolSecretConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Automação de protocolos não configurada.',
    });
  }

  if (!isAuthorizedProtocolRequest(req)) {
    return res.status(401).json({ success: false, error: 'Acesso não autorizado.' });
  }

  const body = req.body || {};

  try {
    const prescription = await resolvePrescription(body);

    if (!prescription.text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Envie o texto da prescrição (texto_copiavel_prescricao) ou um slug de guia publicado.',
      });
    }

    const disponibilidade = buildAvailabilityReport(prescription.text);

    return res.status(200).json({
      success: true,
      data: {
        origem: prescription,
        disponibilidade,
      },
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    const safeMessage = statusCode < 500
      ? error.message
      : 'Não foi possível gerar o relatório de disponibilidade agora.';

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: safeMessage,
    });
  }
};

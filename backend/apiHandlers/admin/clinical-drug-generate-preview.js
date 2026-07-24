// PREVIEW de geração de bula (dry-run). Gera o JSON via IA, aplica a trava de
// revisão humana e DEVOLVE para revisão. NUNCA escreve no Notion.

const { generateClinicalDrug } = require('../../services/generateClinicalDrug');
const {
  isClinicalDrugSecretConfigured,
  isAuthorizedClinicalDrugRequest,
} = require('../../utils/clinicalDrugAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const RATE_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'clinical_drug_generate_preview',
    limit: RATE_LIMIT.limit,
    windowMs: RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!isClinicalDrugSecretConfigured()) {
    return res.status(503).json({ success: false, error: 'Automação de bulário não configurada.' });
  }

  if (!isAuthorizedClinicalDrugRequest(req)) {
    return res.status(401).json({ success: false, error: 'Acesso não autorizado.' });
  }

  const { activeIngredient, principioAtivo } = req.body || {};
  const name = activeIngredient || principioAtivo;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Informe o princípio ativo a ser gerado (ex.: "Amoxicilina").',
    });
  }

  try {
    const generated = await generateClinicalDrug({ activeIngredient: name });

    return res.status(200).json({
      success: true,
      data: {
        dryRun: true,
        drug: generated.drug,
        meta: generated.meta,
      },
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    const safeMessage = statusCode < 500 ? error.message : 'Não foi possível gerar a bula agora.';

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: safeMessage,
      details: String(error?.responseBody || '').slice(0, 500) || undefined,
    });
  }
};

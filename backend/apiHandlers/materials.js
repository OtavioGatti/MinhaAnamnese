const { ensureUserProfile } = require('../services/profiles');
const {
  downloadMaterialFile,
  getPublishedMaterialRow,
  listMaterials,
} = require('../services/clinicalMaterials');
const { canAccessMaterial } = require('../config/materialsAccess');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');
const { recordFeatureUsage } = require('../services/trialUsage');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');

// Cada download passa pelo servidor (o bucket é privado), então há teto por
// conta: uso normal é uma dezena de arquivos, não centenas.
const DOWNLOAD_RATE_LIMIT = {
  limit: 40,
  windowMs: 10 * 60 * 1000,
};

function getRequestUrl(req) {
  return new URL(req.originalUrl || req.url || '/api/materials', 'http://localhost');
}

function getQueryParam(req, name) {
  if (typeof req.query?.[name] === 'string') {
    return req.query[name];
  }

  return getRequestUrl(req).searchParams.get(name) || '';
}

function isDownloadRequest(req) {
  return getRequestUrl(req).pathname.replace(/\/+$/, '').endsWith('/download');
}

function buildPaywallResponse(profile) {
  return {
    success: false,
    error: 'Este material está disponível no plano profissional.',
    code: 'MATERIALS_PRO_REQUIRED',
    data: {
      paywall: true,
      profile,
      accessState: profile?.access_state || null,
    },
  };
}

function buildDownloadFileName(row) {
  const base = String(row.file_name || `${row.slug}.pdf`).replace(/[^a-zA-Z0-9._-]+/g, '-');
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

async function handleDownload(req, res, { auth, profile, hasProAccess }) {
  const rateLimit = await consumeRateLimit({
    req,
    scope: 'materials_download',
    userId: auth.user.id,
    ...DOWNLOAD_RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  const row = await getPublishedMaterialRow(getQueryParam(req, 'slug'));

  if (!row) {
    return res.status(404).json({ success: false, error: 'Material não encontrado.' });
  }

  // O corte é aqui, no servidor: esconder o botão na tela não protegeria o
  // arquivo de quem chamasse a API direto.
  if (!canAccessMaterial({ hasProAccess, materialType: row.material_type })) {
    return res.status(402).json(buildPaywallResponse(profile));
  }

  if (row.material_type === 'link_oficial' || !row.storage_path) {
    return res.status(404).json({ success: false, error: 'Este material não tem arquivo para baixar.' });
  }

  const file = await downloadMaterialFile(row.storage_path);

  await recordFeatureUsage({
    userId: auth.user.id,
    feature: 'materials',
    resourceKey: row.slug,
  }).catch(() => null);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${buildDownloadFileName(row)}"`);
  res.setHeader('Content-Length', String(file.length));
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200);
  return res.end(file);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido',
    });
  }

  try {
    const auth = await resolveSupabaseUser(req);

    if (!auth.user) {
      return res.status(auth.statusCode).json({
        success: false,
        error: auth.error,
      });
    }

    const profile = await ensureUserProfile(auth.user);
    const hasProAccess = Boolean(profile?.access_state?.hasActiveProAccess);

    if (isDownloadRequest(req)) {
      return await handleDownload(req, res, { auth, profile, hasProAccess });
    }

    // A lista sai inteira para qualquer conta: o que é do plano profissional
    // vem marcado como bloqueado, sem o link nem o arquivo.
    const materials = await listMaterials({
      query: getQueryParam(req, 'q'),
      category: getQueryParam(req, 'category'),
      hasProAccess,
    });

    return res.status(200).json({
      success: true,
      data: materials,
    });
  } catch (error) {
    return res.status(error.statusCode || 503).json({
      success: false,
      error: error.statusCode && error.statusCode < 500
        ? error.message
        : 'Não foi possível carregar os materiais agora.',
    });
  }
};

module.exports.buildDownloadFileName = buildDownloadFileName;
module.exports.isDownloadRequest = isDownloadRequest;

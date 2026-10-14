const { ensureUserProfile } = require('../services/profiles');
const { getStoredReferralAffiliate, summarizeReferral } = require('../services/affiliates');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');
const { normalizeBrazilianMobile } = require('../utils/phone');

const PHONE_INVALID_MESSAGE = 'Informe um celular válido com DDD, por exemplo (11) 98765-4321.';

function getProfileUpdatesFromRequest(req) {
  const body = req.body || {};
  const now = new Date().toISOString();

  return {
    display_name:
      Object.prototype.hasOwnProperty.call(body, 'display_name')
        ? body.display_name
        : undefined,
    last_template_used:
      Object.prototype.hasOwnProperty.call(body, 'last_template_used')
        ? body.last_template_used
        : undefined,
    default_contextual_tab:
      Object.prototype.hasOwnProperty.call(body, 'default_contextual_tab')
        ? body.default_contextual_tab
        : undefined,
    output_case_style:
      Object.prototype.hasOwnProperty.call(body, 'output_case_style')
        ? body.output_case_style
        : undefined,
    welcome_onboarding_seen_at:
      body.welcome_onboarding_seen === true
        ? new Date().toISOString()
        : undefined,
    cookie_consent_status:
      Object.prototype.hasOwnProperty.call(body, 'cookie_consent_status')
        ? body.cookie_consent_status
        : undefined,
    cookie_consent_at:
      Object.prototype.hasOwnProperty.call(body, 'cookie_consent_status')
        ? now
        : undefined,
    cookie_consent_version:
      Object.prototype.hasOwnProperty.call(body, 'cookie_consent_version')
        ? body.cookie_consent_version
        : undefined,
    phone:
      Object.prototype.hasOwnProperty.call(body, 'phone')
        ? normalizeBrazilianMobile(body.phone)
        : undefined,
    // true grava o aceite agora; false retira (null). Ausente não mexe.
    whatsapp_opt_in_at:
      typeof body.whatsapp_opt_in === 'boolean'
        ? (body.whatsapp_opt_in ? now : null)
        : undefined,
  };
}

// Celular é obrigatório para quem informa: número inválido não pode virar
// "sem alteração" em silêncio, senão a tela diz que salvou e nada mudou.
function getProfileValidationError(req) {
  const body = req.body || {};

  if (Object.prototype.hasOwnProperty.call(body, 'phone') && !normalizeBrazilianMobile(body.phone)) {
    return PHONE_INVALID_MESSAGE;
  }

  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'M\u00e9todo n\u00e3o permitido',
    });
  }

  const validationError = req.method === 'POST' ? getProfileValidationError(req) : null;

  if (validationError) {
    return res.status(400).json({
      success: false,
      error: validationError,
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

    // A indicação sai junto do perfil para o modal de planos mostrar o desconto
    // que o checkout vai aplicar. Só código e desconto — nunca dado do afiliado.
    const [profile, referralAffiliate] = await Promise.all([
      ensureUserProfile(
        auth.user,
        req.method === 'POST' ? getProfileUpdatesFromRequest(req) : {},
      ),
      getStoredReferralAffiliate(auth.user.id).catch(() => null),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ...profile,
        referral: summarizeReferral(referralAffiliate),
      },
    });
  } catch (_error) {
    return res.status(503).json({
      success: false,
      error: 'N\u00e3o foi poss\u00edvel sincronizar o perfil agora.',
    });
  }
};

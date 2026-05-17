const {
  listOfficialTemplateCategories,
  listTemplatesForUser,
} = require('../services/templates');
const {
  createUserTemplate,
  deleteUserTemplate,
  updateUserTemplate,
} = require('../services/userTemplates');
const { ensureUserProfile } = require('../services/profiles');
const {
  buildTrialLimitError,
  ensureTrialFeatureAccess,
  recordTrialUsage,
} = require('../services/trialUsage');
const {
  getAccessTokenFromRequest,
  resolveSupabaseUser,
} = require('../utils/supabaseAuth');

async function resolveOptionalUser(req) {
  if (!getAccessTokenFromRequest(req)) {
    return null;
  }

  const auth = await resolveSupabaseUser(req);
  return auth.user || null;
}

async function requireUser(req, res) {
  const auth = await resolveSupabaseUser(req);

  if (!auth.user) {
    res.status(auth.statusCode).json({
      success: false,
      error: auth.error,
    });
    return null;
  }

  return auth.user;
}

async function requireProUser(req, res) {
  const user = await requireUser(req, res);

  if (!user) {
    return null;
  }

  const profile = await ensureUserProfile(user);

  if (!profile?.access_state?.hasActiveProAccess) {
    res.status(402).json({
      success: false,
      error: 'Templates próprios são um recurso do plano profissional.',
      code: 'TEMPLATES_PRO_REQUIRED',
      data: {
        paywall: true,
        profile,
        accessState: profile?.access_state || null,
      },
    });
    return null;
  }

  return {
    user,
    profile,
  };
}

function getTemplateIdFromRequest(req) {
  if (typeof req.query?.id === 'string') {
    return req.query.id;
  }

  if (typeof req.body?.id === 'string') {
    return req.body.id;
  }

  const url = new URL(req.url || '/api/templates', 'http://localhost');
  return url.searchParams.get('id');
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const user = await resolveOptionalUser(req);
      const [templates, categories] = await Promise.all([
        listTemplatesForUser(user?.id || null),
        listOfficialTemplateCategories(),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          templates,
          categories,
        },
      });
    }

    if (req.method === 'POST') {
      const access = await requireProUser(req, res);

      if (!access) {
        return null;
      }

      const trialAccess = await ensureTrialFeatureAccess({
        userId: access.user.id,
        profile: access.profile,
        feature: 'userTemplates',
      });

      if (!trialAccess.allowed) {
        const trialError = buildTrialLimitError('userTemplates', trialAccess.usage);
        const nextProfile = await ensureUserProfile(access.user).catch(() => access.profile);

        return res.status(trialError.statusCode).json({
          success: false,
          error: 'Você já criou 2 templates durante o teste profissional. Assine para criar mais templates.',
          code: 'TEMPLATES_TRIAL_LIMIT_REACHED',
          data: {
            paywall: true,
            reason: 'trial_limit_reached',
            profile: nextProfile,
            accessState: nextProfile?.access_state || null,
          },
        });
      }

      const template = await createUserTemplate(access.user.id, req.body);
      let nextProfile = access.profile;

      if (access.profile?.access_state?.isTrialAccess) {
        await recordTrialUsage({
          userId: access.user.id,
          profile: access.profile,
          feature: 'userTemplates',
          resourceKey: template?.id,
          metadata: {
            templateName: template?.nome || template?.name || null,
          },
        }).catch(() => null);
        nextProfile = await ensureUserProfile(access.user).catch(() => access.profile);
      }

      return res.status(201).json({
        success: true,
        data: {
          template,
          profile: nextProfile,
          accessState: nextProfile?.access_state || null,
        },
      });
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const access = await requireProUser(req, res);

      if (!access) {
        return null;
      }

      const templateId = getTemplateIdFromRequest(req);

      return res.status(200).json({
        success: true,
        data: await updateUserTemplate(access.user.id, templateId, req.body),
      });
    }

    if (req.method === 'DELETE') {
      const access = await requireProUser(req, res);

      if (!access) {
        return null;
      }

      await deleteUserTemplate(access.user.id, getTemplateIdFromRequest(req));

      return res.status(200).json({
        success: true,
        data: { deleted: true },
      });
    }

    return res.status(405).json({
      success: false,
      error: 'M\u00e9todo n\u00e3o permitido',
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode && error.statusCode < 500
        ? error.message
        : 'N\u00e3o foi poss\u00edvel salvar seus templates agora.',
    });
  }
};

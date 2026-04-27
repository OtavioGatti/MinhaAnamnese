const { listTemplatesForUser } = require('../backend/services/templates');
const {
  createUserTemplate,
  deleteUserTemplate,
  updateUserTemplate,
} = require('../backend/services/userTemplates');
const {
  getAccessTokenFromRequest,
  resolveSupabaseUser,
} = require('../backend/utils/supabaseAuth');

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

      return res.status(200).json({
        success: true,
        data: await listTemplatesForUser(user?.id || null),
      });
    }

    if (req.method === 'POST') {
      const user = await requireUser(req, res);

      if (!user) {
        return null;
      }

      return res.status(201).json({
        success: true,
        data: await createUserTemplate(user.id, req.body),
      });
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const user = await requireUser(req, res);

      if (!user) {
        return null;
      }

      const templateId = getTemplateIdFromRequest(req);

      return res.status(200).json({
        success: true,
        data: await updateUserTemplate(user.id, templateId, req.body),
      });
    }

    if (req.method === 'DELETE') {
      const user = await requireUser(req, res);

      if (!user) {
        return null;
      }

      await deleteUserTemplate(user.id, getTemplateIdFromRequest(req));

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

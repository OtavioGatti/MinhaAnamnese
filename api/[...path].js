const { handleApiRequest } = require('../backend/apiHandlers');

function shouldReadBody(req) {
  return !['GET', 'HEAD'].includes(String(req.method || '').toUpperCase());
}

function mergeQueryParams(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  const query = { ...(req.query || {}) };

  url.searchParams.forEach((value, key) => {
    if (!Object.prototype.hasOwnProperty.call(query, key)) {
      query[key] = value;
    }
  });

  req.query = query;
}

async function readRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

async function prepareRequest(req) {
  mergeQueryParams(req);

  if (!shouldReadBody(req) || req.body !== undefined) {
    return;
  }

  const rawBody = await readRawBody(req);
  req.rawBody = rawBody;

  if (!rawBody) {
    req.body = {};
    return;
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase();

  if (contentType.includes('application/json')) {
    try {
      req.body = JSON.parse(rawBody);
    } catch (_error) {
      req.body = {};
    }
    return;
  }

  req.body = rawBody;
}

async function handler(req, res) {
  await prepareRequest(req);
  return handleApiRequest(req, res);
}

handler.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = handler;

require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');

const templatesHandler = require('../api/templates');
const anamnesesHandler = require('../api/anamneses');
const organizarHandler = require('../api/organizar');
const insightsHandler = require('../api/insights');
const healthHandler = require('../api/health');
const analyticsHandler = require('../api/analytics');
const createCheckoutHandler = require('../api/create-checkout');
const mercadoPagoWebhookHandler = require('../api/webhook/mercadopago');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '1mb';

app.set('trust proxy', 1);
app.use(cors({ origin: FRONTEND_URL, credentials: FRONTEND_URL !== '*' }));
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use((error, _req, res, next) => {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Payload muito grande. Reduza o texto enviado e tente novamente.',
    });
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      success: false,
      error: 'JSON inválido na requisição.',
    });
  }

  return next(error);
});

function mountRoute(path, handler) {
  app.all(path, async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error(`Unhandled route error on ${path}:`, error);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Erro interno no servidor',
        });
      }
    }
  });
}

mountRoute('/api/templates', templatesHandler);
mountRoute('/api/anamneses', anamnesesHandler);
mountRoute('/api/organizar', organizarHandler);
mountRoute('/api/insights', insightsHandler);
mountRoute('/api/health', healthHandler);
mountRoute('/api/analytics', analyticsHandler);
mountRoute('/api/create-checkout', createCheckoutHandler);
mountRoute('/api/webhook/mercadopago', mercadoPagoWebhookHandler);

app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});

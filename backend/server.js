require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');

const templatesHandler = require('../api/templates');
const anamnesesHandler = require('../api/anamneses');
const anamnesesStatsHandler = require('../api/anamneses/stats');
const anamnesesActivityHandler = require('../api/anamneses/activity');
const anamnesesStreakHandler = require('../api/anamneses/streak');
const organizarHandler = require('../api/organizar');
const insightsHandler = require('../api/insights');
const healthHandler = require('../api/health');
const metricsFunnelHandler = require('../api/metrics/funnel');
const funnelHandler = require('../api/funnel');
const funnelMetricsHandler = require('../api/funnel-metrics');
const trackEventHandler = require('../api/track-event');
const createCheckoutHandler = require('../api/create-checkout');
const mercadoPagoWebhookHandler = require('../api/webhook/mercadopago');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));

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
mountRoute('/api/anamneses/stats', anamnesesStatsHandler);
mountRoute('/api/anamneses/activity', anamnesesActivityHandler);
mountRoute('/api/anamneses/streak', anamnesesStreakHandler);
mountRoute('/api/organizar', organizarHandler);
mountRoute('/api/insights', insightsHandler);
mountRoute('/api/health', healthHandler);
mountRoute('/api/metrics/funnel', metricsFunnelHandler);
mountRoute('/api/funnel', funnelHandler);
mountRoute('/api/funnel-metrics', funnelMetricsHandler);
mountRoute('/api/track-event', trackEventHandler);
mountRoute('/api/create-checkout', createCheckoutHandler);
mountRoute('/api/webhook/mercadopago', mercadoPagoWebhookHandler);

app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});

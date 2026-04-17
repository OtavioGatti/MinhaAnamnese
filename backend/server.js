require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const formatResponse = require('./middlewares/formatResponse');
const errorHandler = require('./middlewares/errorHandler');
const { validateOrganizar } = require('./middlewares/validations');
const templates = require('./templates/templates');
const { evaluateAnamnesisQuality } = require('./utils/anamnesisQualityScore');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

// Middleware
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(formatResponse);

// Validação
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('ERRO: Variável OPENAI_API_KEY não configurada.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

function isValidUserId(userId) {
  return typeof userId === 'string' && /^[0-9a-fA-F-]{36}$/.test(userId);
}

async function registerAnamneseMetric({ userId, template, score, textLength, hasTeaser }) {
  if (!isValidUserId(userId)) {
    return;
  }

  if (typeof score !== 'number' || Number.isNaN(score)) {
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return;
  }

  await fetch(`${supabaseUrl}/rest/v1/anamneses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      user_id: userId,
      template,
      score,
      text_length: textLength,
      has_teaser: Boolean(hasTeaser),
    }),
  });
}

async function listRecentAnamneseMetrics(userId) {
  if (!isValidUserId(userId)) {
    return [];
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return [];
  }

  const query = new URLSearchParams({
    select: 'id,template,score,created_at',
    user_id: `eq.${userId}`,
    order: 'created_at.desc',
    limit: '20',
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/anamneses?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('failed to fetch anamneses');
  }

  const json = await response.json();

  if (!Array.isArray(json)) {
    return [];
  }

  return json.filter((item) => (
    item &&
    typeof item.id === 'string' &&
    typeof item.template === 'string' &&
    typeof item.score === 'number' &&
    typeof item.created_at === 'string'
  ));
}

function montarPromptInsights(texto) {
  return `Você é um médico auxiliando na avaliação da qualidade de uma anamnese.

Analise o texto abaixo e identifique:

1. Pontos importantes que não foram abordados
2. Informações que poderiam ser melhor exploradas
3. Lacunas na coleta da história clínica

Regras:

* NÃO inventar dados
* NÃO assumir nada não descrito
* NÃO sugerir diagnóstico
* NÃO sugerir tratamento
* Se algo não estiver presente, diga 'não informado'
* Use linguagem médica simples

Texto:
${texto}`;
}

// Rotas
app.get('/api/templates', (_req, res) => {
  const lista = Object.entries(templates).map(([chave, valor]) => ({
    id: chave,
    nome: valor.nome,
  }));
  res.formatResponse(lista);
});

app.get('/api/anamneses', async (req, res) => {
  const userId = req.query?.userId;

  if (!isValidUserId(userId)) {
    return res.formatResponse([]);
  }

  try {
    const anamneses = await listRecentAnamneseMetrics(userId);
    return res.formatResponse(anamneses);
  } catch (_error) {
    return res.formatResponse([]);
  }
});

app.post('/api/organizar', validateOrganizar, async (req, res) => {
  try {
    const { template, texto, userId } = req.body;

    const modelo = templates[template];
    const estrutura = modelo.secoes.map((s) => `### ${s}`).join('\n');

    const systemPrompt = modelo.promptSistema || `Você é um médico que organiza anamneses. Não invente informações. Se faltar dado escreva 'Não informado'. Use linguagem médica técnica e organize conforme o modelo.

Estrutura obrigatória:
${estrutura}`;

    const userPrompt = `Template: ${modelo.nome}

Texto:
${texto}`;

    const resposta = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    const resultado = resposta.choices[0].message.content;

    const qualityScore = evaluateAnamnesisQuality(texto.trim(), template);
    const textLength = texto.trim().length;
    const score = qualityScore.shouldShowScore ? qualityScore.score : null;
    const hasTeaser = qualityScore.teaser?.shouldShowTeaser;

    res.formatResponse({ resultado });

    registerAnamneseMetric({
      userId,
      template,
      score,
      textLength,
      hasTeaser,
    }).catch(() => {});
  } catch (erro) {
    console.error('Erro ao processar:', erro.message);

    if (erro.message?.includes('API key')) {
      return res.status(500).formatResponse(null, 'Erro de autenticação com a OpenAI. Verifique sua API KEY.');
    }

    return res.status(500).formatResponse(null, 'Erro interno ao processar a anamnese.');
  }
});

app.post('/api/insights', async (req, res) => {
  try {
    const { texto, templateId } = req.body;

    if (!texto || typeof texto !== 'string' || !texto.trim()) {
      return res.status(400).formatResponse(null, 'Texto inválido.');
    }

    if (!templateId || typeof templateId !== 'string') {
      return res.status(400).formatResponse(null, 'Template inválido.');
    }

    const resposta = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você avalia a completude de anamneses clínicas sem inferir dados ausentes.',
        },
        {
          role: 'user',
          content: montarPromptInsights(texto.trim()),
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    });

    const insights = resposta.choices[0]?.message?.content?.trim();

    if (!insights) {
      return res.status(500).formatResponse(null, 'Erro ao gerar insights');
    }

    return res.formatResponse(insights);
  } catch (erro) {
    console.error('Erro ao gerar insights:', erro.message);
    return res.status(500).formatResponse(null, 'Erro ao gerar insights');
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.formatResponse({ status: 'ok' });
});

// Middleware de erro global (deve ser o último)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});

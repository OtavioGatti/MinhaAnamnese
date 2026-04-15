require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const formatResponse = require('./middlewares/formatResponse');
const errorHandler = require('./middlewares/errorHandler');
const { validateOrganizar } = require('./middlewares/validations');
const templates = require('./templates/templates');

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

// Rotas
app.get('/api/templates', (_req, res) => {
  const lista = Object.entries(templates).map(([chave, valor]) => ({
    id: chave,
    nome: valor.nome,
  }));
  res.formatResponse(lista);
});

app.post('/api/organizar', validateOrganizar, async (req, res) => {
  try {
    const { template, texto } = req.body;

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
    res.formatResponse({ resultado });
  } catch (erro) {
    console.error('Erro ao processar:', erro.message);

    if (erro.message?.includes('API key')) {
      return res.status(500).formatResponse(null, 'Erro de autenticação com a OpenAI. Verifique sua API KEY.');
    }

    return res.status(500).formatResponse(null, 'Erro interno ao processar a anamnese.');
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

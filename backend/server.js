require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Validação
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('ERRO: Variável OPENAI_API_KEY não configurada.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Templates disponíveis
const TEMPLATES = {
  psiquiatria: {
    nome: 'Psiquiatria',
    secoes: [
      'Identificação',
      'Queixa Principal',
      'História da Doença Atual',
      'História Psiquiátrica Pregressa',
      'História Familiar',
      'Uso de Medicações',
      'Exame do Estado Mental',
      'Hipótese Diagnóstica',
      'Conduta',
    ],
  },
  pediatria: {
    nome: 'Pediatria',
    secoes: [
      'Identificação',
      'Queixa Principal',
      'História da Doença Atual',
      'Antecedentes Pessoais',
      'Antecedentes Familiares',
      'Vacinação',
      'Desenvolvimento Neuropsicomotor',
      'Exame Físico',
      'Hipótese Diagnóstica',
      'Conduta',
    ],
  },
  clinica: {
    nome: 'Clínica Médica',
    secoes: [
      'Identificação',
      'Queixa Principal',
      'História da Doença Atual',
      'Revisão de Sistemas',
      'Antecedentes',
      'Medicações em Uso',
      'Exame Físico',
      'Hipótese Diagnóstica',
      'Plano',
    ],
  },
};

// Rotas
app.get('/api/templates', (_req, res) => {
  const lista = Object.entries(TEMPLATES).map(([chave, valor]) => ({
    id: chave,
    nome: valor.nome,
  }));
  res.json(lista);
});

app.post('/api/organizar', async (req, res) => {
  try {
    const { template, texto } = req.body;

    if (!template || !TEMPLATES[template]) {
      return res.status(400).json({
        erro: 'Template inválido. Escolha um dos templates disponíveis.',
      });
    }

    if (!texto || texto.trim().length === 0) {
      return res.status(400).json({ erro: 'O texto não pode estar vazio.' });
    }

    const modelo = TEMPLATES[template];
    const estrutura = modelo.secoes.map((s) => `### ${s}`).join('\n');

    const systemPrompt = `Você é um médico que organiza anamneses. Não invente informações. Se faltar dado escreva 'Não informado'. Use linguagem médica técnica e organize conforme o modelo.

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
    res.json({ resultado });
  } catch (erro) {
    console.error('Erro ao processar:', erro.message);

    if (erro.message?.includes('API key')) {
      return res.status(500).json({
        erro: 'Erro de autenticação com a OpenAI. Verifique sua API KEY.',
      });
    }

    res.status(500).json({ erro: 'Erro interno ao processar a anamnese.' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});

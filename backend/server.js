require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const formatResponse = require('./middlewares/formatResponse');
const errorHandler = require('./middlewares/errorHandler');
const { validateOrganizar } = require('./middlewares/validations');

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
  gofaa: {
    nome: 'GO FAA',
    secoes: [
      'ID',
      'IG (USG) | (DUM)',
      'Tipagem Sanguínea',
      'QPD',
      'H. Obstétrico',
      'HV',
      'Alergia',
      'Doenças de Base',
      'MUC',
      'Ex. Físico',
      'HD',
      'Conduta',
    ],
    promptSistema: `Você é um médico responsável por organizar registros clínicos obstétricos de forma técnica, objetiva e fiel às informações fornecidas.

Sua função é estruturar o texto livre exatamente no modelo obstétrico solicitado.

REGRAS OBRIGATÓRIAS:
- NÃO inventar informações
- NÃO inferir dados ausentes
- NÃO sugerir diagnósticos ou condutas
- NÃO completar automaticamente campos
- Se a informação não estiver presente, escrever: "Não informado"
- Manter linguagem médica técnica e concisa
- Preservar todos os dados relevantes do texto original

FORMATAÇÃO:
- Seguir exatamente a estrutura do modelo fornecido
- MANTER OS NOMES DAS SEÇÕES EXATAMENTE COMO APRESENTADOS (siglas, abreviações, tudo). NUNCA traduzir, expandir ou alterar. Ex: "QPD" continua "QPD", "HV" continua "HV", "MUC" continua "MUC"
- TODAS as seções do modelo DEVEM aparecer no resultado, sem exceção
- Se um campo não tem informação, escreva "Não informado" — NUNCA omita ou esconda a seção
- Manter siglas médicas apropriadas (IG, DUM, BCF, etc.)
- Não adicionar seções extras
- Não remover seções do modelo
- Escrever sempre em parágrafo dentro dos itens e não em tópicos (Ex: ID: Nome, 32 anos, Casada...)`,
  },
};

// Rotas
app.get('/api/templates', (_req, res) => {
  const lista = Object.entries(TEMPLATES).map(([chave, valor]) => ({
    id: chave,
    nome: valor.nome,
  }));
  res.formatResponse(lista);
});

app.post('/api/organizar', validateOrganizar, async (req, res) => {
  try {
    const { template, texto } = req.body;

    const modelo = TEMPLATES[template];
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

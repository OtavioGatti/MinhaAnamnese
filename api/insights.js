const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

function buildPrompt(texto) {
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido',
    });
  }

  const { texto, templateId } = req.body || {};

  if (!texto || typeof texto !== 'string' || !texto.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Texto inválido',
    });
  }

  if (!templateId || typeof templateId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Template inválido',
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'Erro ao gerar insights',
    });
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 1200,
        messages: [
          {
            role: 'system',
            content: 'Você avalia a completude de anamneses clínicas sem inferir dados ausentes.',
          },
          {
            role: 'user',
            content: buildPrompt(texto.trim()),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error('OpenAI request failed');
    }

    const json = await response.json();
    const insights = json?.choices?.[0]?.message?.content?.trim();

    if (!insights) {
      throw new Error('Empty insights response');
    }
    return res.status(200).json({
      success: true,
      data: insights,
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      error: 'Erro ao gerar insights',
    });
  }
};

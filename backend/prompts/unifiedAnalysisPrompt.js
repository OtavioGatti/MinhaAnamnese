const { renderPromptTemplate } = require('./promptTemplate');

const OUTPUT_SCHEMA = {
  score: 82,
  scoreLabel: 'Boa estrutura com lacunas relevantes',
  message: 'Frase curta que traduz a nota estrutural.',
  justification: 'Texto curto explicando a principal perda de qualidade documental.',
  criticalInsight: 'FALHA -> ... -> CONSEQUENCIA NA LEITURA -> ... -> IMPACTO NA QUALIDADE -> ... -> ACAO DIRETA -> ...',
  otherGaps: ['Lacuna secundária objetiva'],
  confidence: 'alta',
  sections: [
    {
      id: 'hma',
      label: 'História da moléstia atual',
      status: 'present',
      score: 18,
      maxScore: 18,
      evidence: 'Trecho curto que sustenta a avaliação.',
      issue: '',
      recommendation: '',
    },
  ],
};

function normalizeList(items = []) {
  return Array.isArray(items)
    ? items
      .map((item) => String(item || '').trim())
      .filter(Boolean)
    : [];
}

function formatTemplateSections(templateConfig) {
  const sectionNames = normalizeList(templateConfig?.secoes);

  if (!sectionNames.length) {
    return 'Nenhuma seção formal foi fornecida. Avalie a estrutura clínica geral sem inventar seções obrigatórias.';
  }

  return sectionNames.map((section, index) => `${index + 1}. ${section}`).join('\n');
}

function formatScoringHints(templateConfig) {
  const evaluationSections = Array.isArray(templateConfig?.evaluation?.sections)
    ? templateConfig.evaluation.sections
    : [];

  if (!evaluationSections.length) {
    return [
      'Use as seções esperadas do template como rubrica de avaliação.',
      'Classifique cada seção como present, partial, missing ou not_applicable.',
      'A nota final deve refletir clareza, completude estrutural, segurança documental e utilidade para revisão clínica.',
    ].join('\n');
  }

  const lines = evaluationSections.map((section) => {
    const flags = [
      section?.narrative ? 'avaliar riqueza narrativa' : '',
      section?.vitals ? 'avaliar sinais objetivos/vitais' : '',
    ].filter(Boolean);
    const evidence = normalizeList(section?.evidence).slice(0, 8).join(', ');
    const aliases = normalizeList(section?.aliases).slice(0, 6).join(', ');

    return [
      `- ${section.label || section.id}:`,
      `peso ${Number(section.weight) || 0}/100`,
      `prioridade ${section.priority || 'contextual'}`,
      aliases ? `aliases: ${aliases}` : '',
      evidence ? `evidências úteis: ${evidence}` : '',
      flags.length ? flags.join('; ') : '',
    ].filter(Boolean).join(' | ');
  });

  const severitySignals = normalizeList(templateConfig?.evaluation?.severitySignals);

  if (severitySignals.length) {
    lines.push(`Sinais de possível gravidade estrutural/contextual: ${severitySignals.slice(0, 16).join(', ')}.`);
  }

  lines.push('Use esses pesos como orientação, mas a nota final deve vir de uma leitura única e coerente da anamnese.');
  lines.push('Se uma seção não fizer sentido para o caso ou template, use not_applicable e não penalize automaticamente.');

  return lines.join('\n');
}

function buildDefaultUnifiedAnalysisPrompt(context) {
  return `
Você é um avaliador sênior de ESTRUTURA DE ANAMNESE para o Minha Anamnese.

Sua tarefa é gerar UMA análise única por IA. A nota e os textos devem nascer do mesmo raciocínio.

Você NÃO deve:
- sugerir diagnóstico;
- sugerir tratamento;
- orientar conduta clínica;
- avaliar qualidade técnica de prescrição;
- inventar dados ausentes.

Você DEVE:
- avaliar clareza documental, completude estrutural e utilidade para revisão clínica;
- usar o texto original e o texto estruturado quando disponíveis;
- usar o template e os scoring hints como rubrica;
- diferenciar seção ausente de seção parcial;
- aceitar not_applicable quando uma seção não fizer sentido no caso;
- devolver somente JSON válido, sem markdown e sem texto fora do objeto.

TEMPLATE:
${context.templateName}

CATEGORIA:
${context.category || 'Não informada'}

SEÇÕES ESPERADAS:
${context.sections}

SCORING HINTS:
${context.scoringHints}

TEXTO ORIGINAL DO USUÁRIO:
"""
${context.originalText || 'Não fornecido.'}
"""

ANAMNESE ESTRUTURADA:
"""
${context.structuredText}
"""

RUBRICA DA NOTA:
- 0 a 30: estrutura crítica, faltam blocos essenciais para entender o caso.
- 31 a 50: estrutura insuficiente, há lacunas importantes e perda relevante de leitura.
- 51 a 70: estrutura parcial, há base de leitura, mas faltam pontos importantes.
- 71 a 85: boa estrutura, com lacunas relevantes ou refinamentos necessários.
- 86 a 100: estrutura consistente, com poucos ajustes específicos.

FORMATO OBRIGATÓRIO:
${context.outputSchema}

Regras do JSON:
- score deve ser número inteiro entre 0 e 100.
- confidence deve ser "alta", "media" ou "baixa".
- sections[].status deve ser "present", "partial", "missing" ou "not_applicable".
- criticalInsight deve seguir exatamente: FALHA -> ... -> CONSEQUENCIA NA LEITURA -> ... -> IMPACTO NA QUALIDADE -> ... -> ACAO DIRETA -> ...
- otherGaps deve ter no máximo 4 itens.
- evidence deve ser curta e baseada no texto; se não houver evidência, use string vazia.
- não use quebras fora do JSON.
`.trim();
}

function buildUnifiedAnalysisPrompt({
  originalText,
  structuredText,
  templateConfig,
  promptTemplate = null,
}) {
  const context = {
    originalText: originalText || '',
    structuredText: structuredText || '',
    templateName: templateConfig?.nome || '',
    category: templateConfig?.category || templateConfig?.clinicalCategoryLabel || templateConfig?.categoryKey || '',
    categoryKey: templateConfig?.categoryKey || templateConfig?.clinicalCategoryKey || '',
    sections: formatTemplateSections(templateConfig),
    scoringHints: formatScoringHints(templateConfig),
    outputSchema: JSON.stringify(OUTPUT_SCHEMA, null, 2),
  };

  if (promptTemplate) {
    return renderPromptTemplate(promptTemplate, {
      original_text: context.originalText,
      structured_text: context.structuredText,
      template_name: context.templateName,
      category: context.category,
      category_key: context.categoryKey,
      sections: context.sections,
      scoring_hints: context.scoringHints,
      output_schema: context.outputSchema,
    });
  }

  return buildDefaultUnifiedAnalysisPrompt(context);
}

module.exports = {
  buildUnifiedAnalysisPrompt,
  formatScoringHints,
  formatTemplateSections,
};

function formatScore(value) {
  return `${value}/10`;
}

function impactLabel(value) {
  if (value === 'alto') return 'alto';
  if (value === 'medio') return 'medio';
  return 'baixo';
}

function buildSummary(audit) {
  const totalFindings = audit.findings.length;
  const highImpact = audit.findings.filter((finding) => finding.impact === 'alto').length;
  const worstScore = Object.entries(audit.scores).sort((a, b) => a[1] - b[1])[0];

  if (totalFindings === 0) {
    return 'A superfície analisada não acionou problemas relevantes nas heurísticas estáticas. Ainda vale validar a tela renderizada para espaçamento, contraste e leitura real.';
  }

  return `A auditoria encontrou ${totalFindings} ponto(s) de atenção, incluindo ${highImpact} de alto impacto. O ponto mais fraco é ${humanizeScoreName(worstScore[0])} (${formatScore(worstScore[1])}), então a primeira rodada de melhoria deve focar nesse eixo antes de refinamentos visuais menores.`;
}

function humanizeScoreName(name) {
  const names = {
    clareza: 'clareza',
    copy: 'copy',
    hierarquiaVisual: 'hierarquia visual',
    consistencia: 'consistência',
    organizacao: 'organização',
    confianca: 'confiança transmitida',
    profissionalismo: 'aparência profissional',
    conversaoPotencial: 'conversão potencial'
  };

  return names[name] || name;
}

function suggestedStructure(audit) {
  const hasManyButtons = (audit.model.counts.buttons || 0) > 4;
  const hasManyTexts = audit.model.text.length > 50;

  const lines = [
    '1. Título principal: diga em uma frase o que a tela faz e qual resultado o usuário obtém.',
    '2. Apoio curto: explique o benefício ou critério de uso em até duas linhas.',
    '3. Área principal de tarefa: mantenha entrada, seleção ou conteúdo central sem elementos concorrentes.',
    '4. Ação primária: um CTA dominante com verbo, objeto e resultado.',
    '5. Informações secundárias: mova detalhes, histórico, exemplos e configurações para painéis recolhíveis, abas ou links discretos.',
    '6. Feedback de estado: carregamento, erro e sucesso devem dizer o que aconteceu e qual é o próximo passo.'
  ];

  if (hasManyButtons) {
    lines.push('7. Ações secundárias: agrupe comandos menos usados em menu ou barra contextual.');
  }

  if (hasManyTexts) {
    lines.push('8. Conteúdo longo: transforme instruções repetidas em listas curtas, exemplos ou blocos progressivos.');
  }

  return lines.join('\n');
}

function renderFinding(finding, index) {
  const files = finding.files && finding.files.length > 0 ? `\n   Arquivos: ${finding.files.join(', ')}` : '';
  const example = finding.example ? `\n   Exemplo melhorado: ${finding.example}` : '';

  return `${index}. ${finding.problem}
   Impacto: ${impactLabel(finding.impact)}
   Por que prejudica: ${finding.why}
   Como corrigir: ${finding.fix}${example}${files}`;
}

function renderMarkdownReport(audit) {
  const findings = audit.findings.length
    ? audit.findings.map((finding, index) => renderFinding(finding, index + 1)).join('\n\n')
    : 'Nenhum problema relevante detectado pelas heurísticas atuais.';

  const priority = audit.priority.length
    ? audit.priority.map((finding, index) => `${index + 1}. ${finding.fix}`).join('\n')
    : '1. Validar a tela renderizada em desktop e mobile para confirmar alinhamento, contraste e ritmo visual.';

  return `# UX Copy & Interface Auditor

## Resumo geral
${buildSummary(audit)}

## Principais problemas
${findings}

## Notas
- Clareza: ${formatScore(audit.scores.clareza)}
- Copy: ${formatScore(audit.scores.copy)}
- Hierarquia visual: ${formatScore(audit.scores.hierarquiaVisual)}
- Consistência: ${formatScore(audit.scores.consistencia)}
- Organização: ${formatScore(audit.scores.organizacao)}
- Confiança transmitida: ${formatScore(audit.scores.confianca)}
- Aparência profissional: ${formatScore(audit.scores.profissionalismo)}
- Conversão potencial: ${formatScore(audit.scores.conversaoPotencial)}

## Correções prioritárias
${priority}

## Sugestão de nova estrutura
${suggestedStructure(audit)}

## Escopo analisado
- Arquivos: ${audit.model.files.length}
- Textos extraídos: ${audit.model.text.length}
- Botões detectados: ${audit.model.counts.buttons || 0}
- Headings detectados: ${audit.model.headings.length}
`;
}

module.exports = {
  renderMarkdownReport
};

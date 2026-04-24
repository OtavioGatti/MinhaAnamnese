const GENERIC_CTA = new Set([
  'ok',
  'sim',
  'não',
  'nao',
  'enviar',
  'salvar',
  'continuar',
  'confirmar',
  'cancelar',
  'ver mais',
  'saiba mais',
  'clique aqui',
  'começar',
  'comecar',
  'gerar'
]);

const ROBOTIC_WORDS = [
  'processando',
  'carregando',
  'erro ao',
  'falha ao',
  'inválido',
  'invalido',
  'obrigatório',
  'obrigatorio'
];

const TRUST_WORDS = [
  'seguro',
  'privado',
  'confidencial',
  'validado',
  'revisado',
  'garantia',
  'protegido',
  'lgpd',
  'exemplo',
  'prévia',
  'previa'
];

function normalize(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function shortExampleForCta(value) {
  const normalized = normalize(value);

  if (normalized.includes('salvar')) return 'Salvar alterações';
  if (normalized.includes('enviar')) return 'Enviar anamnese para análise';
  if (normalized.includes('gerar')) return 'Gerar anamnese organizada';
  if (normalized.includes('continuar')) return 'Continuar para o próximo passo';
  if (normalized.includes('confirmar')) return 'Confirmar e prosseguir';
  if (normalized.includes('ver')) return 'Ver detalhes da análise';
  return `${value} agora`;
}

function addFinding(findings, finding) {
  findings.push({
    impact: 'medio',
    category: 'Geral',
    example: '',
    files: [],
    ...finding
  });
}

function scoreFromFindings(findings, category, base = 10) {
  const penalties = findings
    .filter((finding) => finding.category === category)
    .reduce((total, finding) => {
      if (finding.impact === 'alto') return total + 2.2;
      if (finding.impact === 'medio') return total + 1.3;
      return total + 0.7;
    }, 0);

  return Math.max(0, Math.round((base - penalties) * 10) / 10);
}

function auditClarity(model, findings) {
  const h1Count = model.headings.filter((heading) => heading.level === 1).length;
  const textCount = model.text.length;
  const buttonCount = model.counts.buttons || 0;

  if (h1Count === 0) {
    addFinding(findings, {
      category: 'Clareza',
      impact: 'alto',
      problem: 'A tela não expõe um H1 claro no código analisado.',
      why: 'Sem um título principal evidente, o usuário demora mais para entender onde está e qual problema a tela resolve.',
      fix: 'Defina um título único, concreto e orientado à tarefa logo no início da tela.',
      example: 'Organize sua anamnese em poucos segundos',
      files: model.files.map((file) => file.path)
    });
  }

  if (buttonCount > 6) {
    addFinding(findings, {
      category: 'Clareza',
      impact: 'alto',
      problem: `Há muitos botões na superfície analisada (${buttonCount}).`,
      why: 'Muitas ações competindo reduzem a confiança do usuário e deixam a ação principal menos óbvia.',
      fix: 'Escolha uma ação primária por estado da tela e mova ações secundárias para menus, links discretos ou estados posteriores.',
      example: 'CTA primário: "Gerar anamnese organizada"; secundário: "Ver modelo de exemplo".'
    });
  }

  if (textCount > 80) {
    addFinding(findings, {
      category: 'Clareza',
      impact: 'medio',
      problem: `A interface contém muitos fragmentos de texto (${textCount}).`,
      why: 'Excesso de microtextos aumenta o esforço de leitura e pode deixar a tela com aparência improvisada.',
      fix: 'Agrupe textos por intenção: orientação, entrada, resultado, ações e alertas. Remova instruções repetidas.',
      example: 'Troque vários avisos soltos por um bloco compacto: "Cole a anamnese. Nós organizamos por seções clínicas."'
    });
  }
}

function auditCopy(model, findings) {
  const genericButtons = model.buttons.filter((button) => GENERIC_CTA.has(normalize(button)));
  const longTexts = model.text.filter((text) => text.length > 160);
  const roboticTexts = model.text.filter((text) => ROBOTIC_WORDS.some((word) => normalize(text).includes(normalize(word))));
  const placeholdersAsInstructions = model.files.flatMap((file) =>
    file.placeholders
      .filter((placeholder) => placeholder.length > 110)
      .map((placeholder) => ({ placeholder, file: file.path }))
  );

  for (const button of genericButtons.slice(0, 5)) {
    addFinding(findings, {
      category: 'Copy',
      impact: 'alto',
      problem: `CTA genérico demais: "${button}".`,
      why: 'Botões genéricos não reduzem incerteza. O usuário precisa prever o que acontecerá depois do clique.',
      fix: 'Use verbo + objeto + resultado quando possível.',
      example: shortExampleForCta(button)
    });
  }

  if (longTexts.length > 0) {
    addFinding(findings, {
      category: 'Copy',
      impact: 'medio',
      problem: `${longTexts.length} texto(s) parecem longos demais para uma interface operacional.`,
      why: 'Parágrafos extensos dentro da UI costumam ser ignorados e atrapalham a hierarquia.',
      fix: 'Quebre em título curto, frase de apoio e, se necessário, lista de benefícios ou critérios.',
      example: 'Antes: um parágrafo longo. Depois: "Revise antes de salvar" + "Confira dados ausentes, inconsistências e condutas."'
    });
  }

  if (roboticTexts.length > 0) {
    addFinding(findings, {
      category: 'Copy',
      impact: 'medio',
      problem: 'Há mensagens com tom técnico ou frio demais.',
      why: 'Mensagens mecânicas aumentam ansiedade em estados de erro, carregamento ou decisão.',
      fix: 'Explique o estado em linguagem humana e diga o próximo passo.',
      example: 'Não foi possível gerar agora. Revise sua conexão e tente novamente.'
    });
  }

  for (const item of placeholdersAsInstructions.slice(0, 3)) {
    addFinding(findings, {
      category: 'Copy',
      impact: 'baixo',
      problem: `Placeholder longo em ${item.file}.`,
      why: 'Placeholder desaparece durante a digitação e não deve carregar instruções importantes.',
      fix: 'Mova a orientação para um texto de apoio persistente e deixe o placeholder como exemplo curto.',
      example: 'Placeholder: "Ex.: dor abdominal há 2 dias"; apoio: "Inclua queixa, duração, sintomas associados e antecedentes."',
      files: [item.file]
    });
  }
}

function auditHierarchy(model, findings) {
  const headingLevels = model.headings.map((heading) => heading.level);
  const h1Count = headingLevels.filter((level) => level === 1).length;
  const textSizeTokens = model.classTokens.filter((token) => /^text-(xs|sm|base|lg|xl|[2-9]xl)$/.test(token));
  const colorTokens = model.classTokens.filter((token) => /^(text|bg|border)-[a-z]+-\d{2,3}$/.test(token));
  const fontWeightTokens = model.classTokens.filter((token) => /^font-(thin|light|normal|medium|semibold|bold|black)$/.test(token));

  if (h1Count > 1) {
    addFinding(findings, {
      category: 'Hierarquia visual',
      impact: 'medio',
      problem: `Foram encontrados ${h1Count} títulos H1.`,
      why: 'Mais de um H1 cria competição entre mensagens que deveriam ter pesos diferentes.',
      fix: 'Mantenha um H1 por tela e rebaixe subtítulos para H2/H3.',
      example: 'H1: "Anamnese organizada"; H2: "Pendências clínicas"; H2: "Resultado estruturado".'
    });
  }

  if (uniqueCount(textSizeTokens) > 6) {
    addFinding(findings, {
      category: 'Hierarquia visual',
      impact: 'medio',
      problem: 'Há muitos tamanhos de texto diferentes.',
      why: 'Variação excessiva de escala tipográfica deixa a tela menos sofisticada e dificulta escaneabilidade.',
      fix: 'Restrinja a escala: título, subtítulo, corpo, metadado e rótulo.',
      example: 'Use 4 níveis principais: `text-2xl`, `text-lg`, `text-sm`, `text-xs`.'
    });
  }

  if (uniqueCount(colorTokens) > 18) {
    addFinding(findings, {
      category: 'Hierarquia visual',
      impact: 'alto',
      problem: 'A interface usa muitos tokens de cor.',
      why: 'Cores demais criam ruído visual e fazem elementos secundários parecerem igualmente importantes.',
      fix: 'Defina papéis de cor: texto principal, texto secundário, borda, fundo, sucesso, alerta e ação primária.',
      example: 'Reserve cor forte apenas para CTA primário, status crítico e seleção ativa.'
    });
  }

  if (uniqueCount(fontWeightTokens) > 5) {
    addFinding(findings, {
      category: 'Hierarquia visual',
      impact: 'baixo',
      problem: 'Há pesos tipográficos demais.',
      why: 'Muitos pesos competem visualmente e deixam a interface menos coesa.',
      fix: 'Use `font-semibold` para títulos, `font-medium` para labels e `font-normal` para corpo.',
      example: 'Evite alternar entre medium, semibold, bold e black na mesma área.'
    });
  }
}

function auditConsistency(model, findings) {
  const spacingTokens = model.classTokens.filter((token) => /^(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-/.test(token));
  const radiusTokens = model.classTokens.filter((token) => /^rounded/.test(token));
  const shadowTokens = model.classTokens.filter((token) => /^shadow/.test(token));
  const widthTokens = model.classTokens.filter((token) => /^(w|min-w|max-w)-/.test(token));

  if (uniqueCount(spacingTokens) > 28) {
    addFinding(findings, {
      category: 'Consistência',
      impact: 'alto',
      problem: 'Há muitos padrões de espaçamento diferentes.',
      why: 'Espaçamentos sem escala clara geram assimetria, desalinhamento e sensação de tela montada manualmente.',
      fix: 'Padronize uma escala curta para blocos, grupos e itens.',
      example: 'Página: `py-8`; seção: `gap-6`; card: `p-5`; linha interna: `gap-3`.'
    });
  }

  if (uniqueCount(radiusTokens) > 6) {
    addFinding(findings, {
      category: 'Consistência',
      impact: 'medio',
      problem: 'Raio de borda varia demais entre componentes.',
      why: 'Cards e botões com cantos diferentes sem motivo reduzem a percepção de sistema visual.',
      fix: 'Escolha 1 raio para controles e 1 para containers, salvo exceções de design system.',
      example: 'Botões: `rounded-md`; cards: `rounded-lg`.'
    });
  }

  if (uniqueCount(shadowTokens) > 4) {
    addFinding(findings, {
      category: 'Consistência',
      impact: 'baixo',
      problem: 'Sombras aparecem com muitos estilos diferentes.',
      why: 'Sombras variadas podem fazer a tela parecer decorativa e menos operacional.',
      fix: 'Use sombra apenas para camadas reais: modal, popover ou card destacado.',
      example: 'Troque sombras em excesso por bordas leves e fundos bem definidos.'
    });
  }

  if (uniqueCount(widthTokens) > 18) {
    addFinding(findings, {
      category: 'Consistência',
      impact: 'medio',
      problem: 'Há muitos padrões de largura.',
      why: 'Larguras sem padrão criam colunas desalinhadas e componentes soltos.',
      fix: 'Defina containers e grids estáveis para cada região da tela.',
      example: 'Container principal `max-w-6xl`; painel lateral `w-80`; conteúdo `minmax(0,1fr)`.'
    });
  }
}

function auditOrganization(model, findings) {
  const cardCount = model.counts.cards || 0;
  const conditionalCount = model.counts.conditionals || 0;

  if (cardCount > 24) {
    addFinding(findings, {
      category: 'Organização',
      impact: 'medio',
      problem: `A tela sugere excesso de containers/cards (${cardCount} sinais).`,
      why: 'Cards demais fragmentam a leitura e dificultam entender o que é informação central.',
      fix: 'Agrupe cards por tarefa, transforme dados comparáveis em tabela/lista e remova containers puramente decorativos.',
      example: 'Seções: Entrada -> Diagnóstico estrutural -> Resultado -> Ações.'
    });
  }

  if (conditionalCount > 18) {
    addFinding(findings, {
      category: 'Organização',
      impact: 'medio',
      problem: 'Há muitos estados condicionais na mesma superfície.',
      why: 'Muitos estados competindo no mesmo componente tendem a produzir fluxos difíceis de prever e manter.',
      fix: 'Separe estados principais em componentes ou etapas com responsabilidade clara.',
      example: 'Divida em `EmptyState`, `EditingState`, `GeneratingState`, `ResultState` e `ErrorState`.'
    });
  }
}

function auditTrustAndConversion(model, findings) {
  const trustMentions = model.text.filter((text) => TRUST_WORDS.some((word) => normalize(text).includes(word))).length;
  const hasActionVerb = model.buttons.some((button) => /gerar|salvar|criar|enviar|revisar|organizar|continuar|assinar|comprar/i.test(button));

  if (!hasActionVerb && model.buttons.length > 0) {
    addFinding(findings, {
      category: 'Conversão',
      impact: 'alto',
      problem: 'As ações não deixam claro o resultado do clique.',
      why: 'CTAs sem resultado explícito reduzem conversão porque aumentam medo de perda, cobrança ou mudança irreversível.',
      fix: 'Nomeie o resultado esperado e, quando necessário, acrescente microcopy de segurança.',
      example: 'Gerar prévia gratuita'
    });
  }

  if (trustMentions === 0 && model.text.length > 15) {
    addFinding(findings, {
      category: 'Conversão',
      impact: 'medio',
      problem: 'A tela quase não apresenta sinais de confiança.',
      why: 'Quando o usuário fornece dados sensíveis ou toma uma decisão, a interface precisa reduzir incerteza.',
      fix: 'Inclua microcopy factual sobre privacidade, revisão, prévia, segurança ou controle do usuário.',
      example: 'Seus dados não aparecem no relatório final sem sua revisão.'
    });
  }
}

function auditAccessibility(model, findings) {
  if ((model.counts.imagesWithoutAlt || 0) > 0) {
    addFinding(findings, {
      category: 'Acessibilidade',
      impact: 'medio',
      problem: `${model.counts.imagesWithoutAlt} imagem(ns) sem alt.`,
      why: 'Imagens sem texto alternativo prejudicam leitores de tela e reduzem clareza quando a mídia falha.',
      fix: 'Adicione `alt` descritivo ou `alt=""` para imagem decorativa.',
      example: '<img src="..." alt="Prévia da anamnese organizada" />'
    });
  }

  if ((model.counts.iconOnlyButtons || 0) > 0) {
    addFinding(findings, {
      category: 'Acessibilidade',
      impact: 'medio',
      problem: `${model.counts.iconOnlyButtons} botão(ões) parecem conter apenas ícone.`,
      why: 'Botões só com ícone podem ser ambíguos e inacessíveis sem nome programático.',
      fix: 'Adicione `aria-label` específico e tooltip quando o ícone não for universal.',
      example: '<button aria-label="Remover seção">...</button>'
    });
  }
}

function uniqueCount(values) {
  return new Set(values).size;
}

function buildScores(findings) {
  return {
    clareza: scoreFromFindings(findings, 'Clareza'),
    copy: scoreFromFindings(findings, 'Copy'),
    hierarquiaVisual: scoreFromFindings(findings, 'Hierarquia visual'),
    consistencia: scoreFromFindings(findings, 'Consistência'),
    organizacao: scoreFromFindings(findings, 'Organização'),
    confianca: scoreFromFindings(findings, 'Conversão'),
    profissionalismo: Math.max(
      0,
      Math.round(((scoreFromFindings(findings, 'Hierarquia visual') + scoreFromFindings(findings, 'Consistência') + scoreFromFindings(findings, 'Copy')) / 3) * 10) / 10
    ),
    conversaoPotencial: scoreFromFindings(findings, 'Conversão')
  };
}

function runAudit(model) {
  const findings = [];

  auditClarity(model, findings);
  auditCopy(model, findings);
  auditHierarchy(model, findings);
  auditConsistency(model, findings);
  auditOrganization(model, findings);
  auditTrustAndConversion(model, findings);
  auditAccessibility(model, findings);

  const scores = buildScores(findings);
  const priority = findings
    .slice()
    .sort((a, b) => {
      const weight = { alto: 3, medio: 2, baixo: 1 };
      return weight[b.impact] - weight[a.impact];
    })
    .slice(0, 5);

  return {
    model,
    findings,
    scores,
    priority
  };
}

module.exports = {
  runAudit
};

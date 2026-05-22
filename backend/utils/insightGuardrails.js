/**
 * Guardrails determinísticos para impedir que o motor de insights contradiga
 * a análise estrutural calculada pelo score.
 *
 * Esta camada é propositalmente pura: não chama LLM, banco ou APIs.
 * O fluxo atual continua em services/generateInsights.js.
 */

const SECTION_GROUPS = {
  hma: [
    'hma',
    'hda',
    'história da moléstia atual',
    'historia da molestia atual',
    'história da doença atual',
    'historia da doenca atual',
  ],
  exameFisico: [
    'exame físico',
    'exame fisico',
    'sinais vitais',
    'ef',
  ],
  muc: [
    'muc',
    'medicações em uso contínuo',
    'medicacoes em uso continuo',
    'medicações',
    'medicacoes',
    'medicamentos em uso',
    'remédios',
    'remedios',
  ],
  comorbidades: [
    'comorbidades',
    'antecedentes pessoais',
    'antecedentes pessoais e comorbidades',
    'história pregressa',
    'historia pregressa',
    'doenças de base',
    'doencas de base',
    'hpp',
  ],
  historiaFamiliar: [
    'história familiar',
    'historia familiar',
    'hf',
    'hf/rede',
    'história familiar e rede de apoio',
    'historia familiar e rede de apoio',
  ],
  habitos: [
    'hábitos de vida',
    'habitos de vida',
    'hábitos',
    'habitos',
    'hv',
  ],
  interrogatorio: [
    'interrogatório sintomatológico',
    'interrogatorio sintomatologico',
    'is',
    'revisão de sistemas',
    'revisao de sistemas',
  ],
  exames: [
    'exames complementares',
    'exames',
    'laboratório',
    'laboratorio',
    'imagem',
    'ecg',
    'rx',
  ],
  sinaisAlarme: [
    'sinais de alarme',
    'sinais de gravidade',
    'red flags',
    'gravidade',
  ],
  funcionalidade: [
    'funcionalidade',
    'avd',
    'aivd',
  ],
  cognicaoHumor: [
    'cognição/humor',
    'cognicao/humor',
    'cognição',
    'cognicao',
    'humor',
    'memória',
    'memoria',
  ],
  quedasMarcha: [
    'quedas/marcha',
    'quedas',
    'marcha',
    'mobilidade',
    'equilíbrio',
    'equilibrio',
  ],
};

const CANONICAL_LABELS = {
  hma: 'HMA/HDA',
  exameFisico: 'Exame físico',
  muc: 'Medicações em uso contínuo',
  comorbidades: 'Comorbidades/antecedentes',
  historiaFamiliar: 'História familiar',
  habitos: 'Hábitos de vida',
  interrogatorio: 'Interrogatório sintomatológico',
  exames: 'Exames complementares',
  sinaisAlarme: 'Sinais de alarme',
  funcionalidade: 'Funcionalidade',
  cognicaoHumor: 'Cognição/Humor',
  quedasMarcha: 'Quedas/Marcha',
};

const STATUS_RANK = {
  unknown: 0,
  missing: 1,
  partial: 2,
  present: 3,
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function aliasMatchesSection(sectionName, alias) {
  const normalizedName = normalizeText(sectionName);
  const normalizedAlias = normalizeText(alias);

  if (!normalizedName || !normalizedAlias) {
    return false;
  }

  if (normalizedAlias.length <= 3) {
    return tokenize(normalizedName).includes(normalizedAlias);
  }

  return normalizedName.includes(normalizedAlias);
}

function canonicalizeSectionName(sectionName) {
  const normalized = normalizeText(sectionName);

  for (const [canonical, aliases] of Object.entries(SECTION_GROUPS)) {
    if (aliases.some((alias) => aliasMatchesSection(normalized, alias))) {
      return canonical;
    }
  }

  return normalized
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'secao_desconhecida';
}

function normalizeStatus(status) {
  const normalized = normalizeText(status);

  if (
    normalized.includes('present') ||
    normalized.includes('presente') ||
    normalized.includes('completo')
  ) {
    return 'present';
  }

  if (
    normalized.includes('partial') ||
    normalized.includes('parcial') ||
    normalized.includes('pouco detalh') ||
    normalized.includes('incompleto')
  ) {
    return 'partial';
  }

  if (
    normalized.includes('missing') ||
    normalized.includes('ausente') ||
    normalized.includes('nao relatado')
  ) {
    return 'missing';
  }

  return 'unknown';
}

function mergeStatusEntry(statusMap, canonical, nextEntry) {
  const currentEntry = statusMap[canonical];
  const currentRank = STATUS_RANK[currentEntry?.status] ?? 0;
  const nextRank = STATUS_RANK[nextEntry?.status] ?? 0;

  if (!currentEntry || nextRank >= currentRank) {
    statusMap[canonical] = nextEntry;
  }
}

function addSectionStatus(statusMap, label, status, extra = {}) {
  if (!label) {
    return;
  }

  const canonical = canonicalizeSectionName(label);

  mergeStatusEntry(statusMap, canonical, {
    label: CANONICAL_LABELS[canonical] || label,
    rawLabel: label,
    status: normalizeStatus(status),
    score: extra.score,
    weight: extra.weight,
    priority: extra.priority,
  });
}

function extractFromSectionArray(items) {
  const statusMap = {};

  for (const item of items || []) {
    const label = item?.label || item?.section || item?.name || item?.title || item?.id;
    const status = item?.status || item?.state || item?.classification || item?.coverage;

    addSectionStatus(statusMap, label, status, {
      score: item?.score ?? item?.points ?? item?.earned ?? item?.scoreContribution,
      weight: item?.weight ?? item?.max ?? item?.total,
      priority: item?.priority,
    });
  }

  return statusMap;
}

function extractFromNamedLists(structuredAnalysis) {
  const statusMap = {};
  const lists = [
    ['secoesPresentes', 'present'],
    ['secoesParciais', 'partial'],
    ['secoesAusentes', 'missing'],
  ];

  for (const [key, status] of lists) {
    const labels = Array.isArray(structuredAnalysis?.[key]) ? structuredAnalysis[key] : [];

    for (const label of labels) {
      addSectionStatus(statusMap, label, status);
    }
  }

  return statusMap;
}

function mergeStatusMaps(...maps) {
  return maps.reduce((merged, map) => {
    for (const [canonical, entry] of Object.entries(map || {})) {
      mergeStatusEntry(merged, canonical, entry);
    }

    return merged;
  }, {});
}

function extractSectionStatuses(structuredAnalysis) {
  if (!structuredAnalysis) {
    return {};
  }

  if (Array.isArray(structuredAnalysis)) {
    return extractFromSectionArray(structuredAnalysis);
  }

  if (typeof structuredAnalysis === 'object') {
    const readout = structuredAnalysis.sectionReadout ||
      structuredAnalysis.sections ||
      structuredAnalysis.sectionStatus ||
      structuredAnalysis.reading;

    if (Array.isArray(readout)) {
      return mergeStatusMaps(
        extractFromSectionArray(readout),
        extractFromNamedLists(structuredAnalysis),
      );
    }

    const statusMap = extractFromNamedLists(structuredAnalysis);

    for (const [key, value] of Object.entries(structuredAnalysis)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        continue;
      }

      addSectionStatus(statusMap, key, value.status || value.state || value.classification || value.coverage, {
        score: value.score ?? value.points ?? value.earned,
        weight: value.weight ?? value.max ?? value.total,
        priority: value.priority,
      });
    }

    return statusMap;
  }

  const statusMap = {};
  const lines = String(structuredAnalysis).split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/-\s*(.+?):\s*(present|partial|missing|presente|parcial|ausente)\s*(?:\(([^)]*)\))?/i);

    if (!match) {
      continue;
    }

    const rawLabel = match[1].trim();
    const rawStatus = match[2].trim();
    const points = match[3] || '';
    const pointMatch = points.match(/([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)/);

    addSectionStatus(statusMap, rawLabel, rawStatus, {
      score: pointMatch ? Number(pointMatch[1]) : undefined,
      weight: pointMatch ? Number(pointMatch[2]) : undefined,
    });
  }

  return statusMap;
}

function sectionIsPresent(statusMap, canonical) {
  return statusMap[canonical]?.status === 'present';
}

function sectionIsPartial(statusMap, canonical) {
  return statusMap[canonical]?.status === 'partial';
}

function sectionIsMissing(statusMap, canonical) {
  return statusMap[canonical]?.status === 'missing';
}

function sectionHasFullScore(statusMap, canonical) {
  const section = statusMap[canonical];

  if (!section) {
    return false;
  }

  if (section.status === 'present') {
    return true;
  }

  return (
    typeof section.score === 'number' &&
    typeof section.weight === 'number' &&
    section.weight > 0 &&
    section.score >= section.weight
  );
}

function buildSectionStatusContract(statusMap) {
  const entries = Object.entries(statusMap);

  if (!entries.length) {
    return 'Nenhum status determinístico de seção foi fornecido. Use apenas o texto estruturado e o score, sem inventar ausências.';
  }

  const lines = entries.map(([canonical, data]) => {
    const label = data.label || CANONICAL_LABELS[canonical] || canonical;
    const scoreText =
      typeof data.score === 'number' && typeof data.weight === 'number'
        ? ` (${data.score}/${data.weight})`
        : '';

    return `- ${label}: ${data.status}${scoreText}`;
  });

  return [
    'CONTRATO DETERMINÍSTICO DAS SEÇÕES:',
    ...lines,
    '',
    'Regras soberanas:',
    '- present = documentado; nunca chamar de ausente, parcial ou pouco detalhado.',
    '- partial = documentado parcialmente; nunca chamar de ausente.',
    '- missing = ausente/não documentado.',
    '- Se houver conflito entre este contrato e sua interpretação textual, este contrato vence.',
  ].join('\n');
}

function buildForbiddenClaims(statusMap) {
  const forbidden = [];

  if (sectionIsPresent(statusMap, 'hma') || sectionHasFullScore(statusMap, 'hma')) {
    forbidden.push('É proibido dizer que HMA/HDA está ausente, parcial, pouco detalhada, incompleta ou insuficiente.');
    forbidden.push('É proibido recomendar detalhar HMA/HDA como lacuna principal ou secundária.');
  } else if (sectionIsPartial(statusMap, 'hma')) {
    forbidden.push('É proibido dizer que HMA/HDA está ausente. Use apenas HMA/HDA parcial, incompleta ou pouco detalhada.');
  }

  if (sectionIsPresent(statusMap, 'exameFisico') || sectionHasFullScore(statusMap, 'exameFisico')) {
    forbidden.push('É proibido dizer que Exame físico está ausente, faltante ou não documentado.');
    forbidden.push('É proibido recomendar documentar Exame físico como se ele estivesse ausente.');
  } else if (sectionIsPartial(statusMap, 'exameFisico')) {
    forbidden.push('É proibido dizer que Exame físico está ausente. Use apenas Exame físico parcial ou pouco detalhado.');
  }

  if (sectionIsPresent(statusMap, 'comorbidades') || sectionHasFullScore(statusMap, 'comorbidades')) {
    forbidden.push('É proibido dizer que faltam comorbidades, antecedentes pessoais, história pregressa ou doenças de base.');
  }

  if (sectionIsPresent(statusMap, 'exames') || sectionHasFullScore(statusMap, 'exames')) {
    forbidden.push('É proibido dizer que Exames complementares estão ausentes.');
  }

  if (sectionIsPresent(statusMap, 'historiaFamiliar') || sectionHasFullScore(statusMap, 'historiaFamiliar')) {
    forbidden.push('É proibido dizer que História familiar está ausente.');
  }

  if (sectionIsPresent(statusMap, 'interrogatorio') || sectionHasFullScore(statusMap, 'interrogatorio')) {
    forbidden.push('É proibido dizer que Interrogatório sintomatológico está ausente.');
  }

  if (!forbidden.length) {
    return 'Sem proibições específicas além das regras gerais de não contradizer o score e a leitura das seções.';
  }

  return ['AFIRMAÇÕES PROIBIDAS NESTE CASO:', ...forbidden.map((item) => `- ${item}`)].join('\n');
}

function detectClinicalRisk(structuredText) {
  const text = normalizeText(structuredText);

  return {
    chestPain: /dor toracica|precordialgia/.test(text),
    dyspnea: /dispneia|falta de ar/.test(text),
    syncope: /sincope|desmaio/.test(text),
    bleeding: /sangramento|hemorragia|melena|hematemese|hematuria/.test(text),
    neuro: /rebaixamento|deficit neurologico|confusao mental|delirium|glasgow/.test(text),
    elderlyFall: /queda|quedas/.test(text) && /idoso|idosa|geriatr/.test(text),
    cardiovascularRisk: /has|hipertens|dm|diabetes|dcv|cardiovascular|infarto|avc|dap/.test(text),
  };
}

function buildPriorityRecommendation(statusMap, structuredText) {
  const risk = detectClinicalRisk(structuredText);
  const riskCase = Object.values(risk).some(Boolean);

  if (riskCase && sectionIsMissing(statusMap, 'muc')) {
    return [
      'LACUNA PRINCIPAL RECOMENDADA: Medicações em uso contínuo ausentes.',
      'Justificativa: o caso tem sinais de risco clínico ou cardiorrespiratório, e a ausência de medicações limita avaliação de antiagregantes, anticoagulantes, anti-hipertensivos, hipoglicemiantes, adesão, automedicação, eventos adversos e interações.',
      'Não escolha HMA/HDA como lacuna principal se ela estiver present ou partial.',
    ].join('\n');
  }

  if (riskCase && sectionIsMissing(statusMap, 'exameFisico')) {
    return 'LACUNA PRINCIPAL RECOMENDADA: Exame físico ausente, pois o caso tem sinais de possível gravidade.';
  }

  if (riskCase && sectionIsPartial(statusMap, 'exameFisico')) {
    return 'LACUNA PRINCIPAL POSSÍVEL: Exame físico pouco detalhado, se não houver lacuna medicamentosa mais crítica.';
  }

  if (sectionIsMissing(statusMap, 'hma')) {
    return 'LACUNA PRINCIPAL POSSÍVEL: HMA/HDA ausente, se não houver lacuna de segurança mais crítica.';
  }

  if (sectionIsPartial(statusMap, 'hma')) {
    return 'LACUNA PRINCIPAL POSSÍVEL: HMA/HDA pouco detalhada, mas nunca descreva como ausente.';
  }

  if (sectionIsMissing(statusMap, 'comorbidades')) {
    return 'LACUNA PRINCIPAL POSSÍVEL: Comorbidades/antecedentes ausentes, se forem relevantes ao contexto.';
  }

  if (sectionIsMissing(statusMap, 'historiaFamiliar')) {
    return 'LACUNA SECUNDÁRIA POSSÍVEL: História familiar ausente.';
  }

  if (sectionIsMissing(statusMap, 'habitos')) {
    return 'LACUNA SECUNDÁRIA POSSÍVEL: Hábitos de vida ausentes.';
  }

  return 'Escolha a lacuna principal apenas entre seções realmente missing ou partial, nunca entre seções present.';
}

function buildInsightGuardrailContext({ structuredAnalysis, structuredText, score }) {
  const statusMap = extractSectionStatuses(structuredAnalysis);

  return {
    statusMap,
    sectionStatusContract: buildSectionStatusContract(statusMap),
    forbiddenClaims: buildForbiddenClaims(statusMap),
    priorityRecommendation: buildPriorityRecommendation(statusMap, structuredText, score),
  };
}

function sanitizeInsightText(insightText, statusMap) {
  let output = String(insightText || '');

  const hmaProtected = sectionIsPresent(statusMap, 'hma') || sectionHasFullScore(statusMap, 'hma');
  const hmaPartial = sectionIsPartial(statusMap, 'hma');
  const exameProtected = sectionIsPresent(statusMap, 'exameFisico') || sectionHasFullScore(statusMap, 'exameFisico');
  const comorbProtected = sectionIsPresent(statusMap, 'comorbidades') || sectionHasFullScore(statusMap, 'comorbidades');
  const examesProtected = sectionIsPresent(statusMap, 'exames') || sectionHasFullScore(statusMap, 'exames');

  if (hmaProtected) {
    output = output.replace(/(?:a\s+)?(?:aus[eê]ncia|falta|omiss[aã]o)\s+d[ae]\s+(?:hist[oó]ria\s+da\s+mol[eé]stia\s+atual|hist[oó]ria\s+da\s+doen[cç]a\s+atual|hma|hda)[^.\n]*[.\n]?/gi, '');
    output = output.replace(/(?:hma|hda|hist[oó]ria\s+da\s+mol[eé]stia\s+atual|hist[oó]ria\s+da\s+doen[cç]a\s+atual)[^.\n]*(?:ausente|pouco detalhada|pouco detalhado|incompleta|parcial|insuficiente)[^.\n]*[.\n]?/gi, '');
    output = output.replace(/-\s*(?:documente|detalhe|registre|inclua)[^.\n]*(?:hma|hda|hist[oó]ria\s+da\s+mol[eé]stia\s+atual|hist[oó]ria\s+da\s+doen[cç]a\s+atual)[^.\n]*[.\n]?/gi, '');
  }

  if (hmaPartial) {
    output = output.replace(/(?:hma|hda|hist[oó]ria\s+da\s+mol[eé]stia\s+atual|hist[oó]ria\s+da\s+doen[cç]a\s+atual)\s+ausente/gi, 'HMA/HDA pouco detalhada');
    output = output.replace(/(?:aus[eê]ncia|falta|omiss[aã]o)\s+d[ae]\s+(?:hma|hda|hist[oó]ria\s+da\s+mol[eé]stia\s+atual|hist[oó]ria\s+da\s+doen[cç]a\s+atual)/gi, 'HMA/HDA pouco detalhada');
  }

  if (exameProtected) {
    output = output.replace(/(?:a\s+)?(?:aus[eê]ncia|falta|omiss[aã]o)\s+d[eo]\s+exame\s+f[ií]sico[^.\n]*[.\n]?/gi, '');
    output = output.replace(/exame\s+f[ií]sico[^.\n]*(?:ausente|faltante|n[aã]o documentado)[^.\n]*[.\n]?/gi, '');
    output = output.replace(/-\s*(?:documente|inclua|registre)\s+(?:um\s+)?exame\s+f[ií]sico[^.\n]*[.\n]?/gi, '');
  }

  if (comorbProtected) {
    output = output.replace(/-\s*(?:registre|inclua|documente)[^.\n]*(?:comorbidades|antecedentes|hist[oó]ria pregressa|doen[cç]as de base)[^.\n]*[.\n]?/gi, '');
    output = output.replace(/(?:falta|aus[eê]ncia|omiss[aã]o)[^.\n]*(?:comorbidades|antecedentes|hist[oó]ria pregressa|doen[cç]as de base)[^.\n]*[.\n]?/gi, '');
  }

  if (examesProtected) {
    output = output.replace(/-\s*(?:registre|inclua|documente)[^.\n]*(?:exames complementares|exames)[^.\n]*[.\n]?/gi, '');
    output = output.replace(/(?:falta|aus[eê]ncia|omiss[aã]o)[^.\n]*(?:exames complementares|exames)[^.\n]*[.\n]?/gi, '');
  }

  return output
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function sanitizeParsedInsightResponse(parsed, statusMap) {
  const analise = sanitizeInsightText(parsed?.analise, statusMap);
  const scoreText = sanitizeInsightText(parsed?.scoreText, statusMap);
  const insight = sanitizeInsightText(parsed?.insight, statusMap);
  const outrosList = Array.isArray(parsed?.outrosList)
    ? parsed.outrosList
      .map((item) => sanitizeInsightText(item, statusMap))
      .filter(Boolean)
    : [];

  return {
    ...parsed,
    analise,
    scoreText,
    insight,
    outrosList,
    outros: outrosList.map((item) => `- ${item}`).join('\n'),
  };
}

module.exports = {
  buildInsightGuardrailContext,
  canonicalizeSectionName,
  extractSectionStatuses,
  sanitizeInsightText,
  sanitizeParsedInsightResponse,
};

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const { processAnamnesis } = require('../services/processAnamnesis');
const { generateInsights } = require('../services/generateInsights');
const { getTemplateById } = require('../services/templates');
const { calculateAnamnesisQualityScore } = require('../utils/anamnesisQualityScore');
const { sanitizeText } = require('../utils/textSanitization');

const EVAL_USER_ID = 'anamnese-evals-local';
const OUTPUT_DIR = path.resolve(__dirname, '../../test-results');
const DEFAULT_CASES_PATH = path.resolve(__dirname, '../../tests/anamnese-evals/cases.json');
const MISSING_MARKERS = [
  '',
  '[DADO AUSENTE]',
  '[INFORMACAO INSUFICIENTE]',
  '[INFORMAÇÃO INSUFICIENTE]',
  'Nao informado',
  'Não informado',
];
const DIAGNOSTIC_TERMS = [
  'pneumonia',
  'sepse',
  'infarto',
  'sindrome coronariana',
  'síndrome coronariana',
  'acidente vascular cerebral',
  'avc',
  'ait',
  'apendicite',
  'pielonefrite',
  'cetoacidose',
  'insuficiencia cardiaca',
  'insuficiência cardíaca',
  'edema agudo de pulmao',
  'edema agudo de pulmão',
  'tromboembolismo',
  'tromboembolismo pulmonar',
  'embolia pulmonar',
  'asma exacerbada',
  'bronquiolite',
  'otite media aguda',
  'otite média aguda',
  'trabalho de parto',
  'pre-eclampsia',
  'pré-eclâmpsia',
  'ameaça de aborto',
  'ameaca de aborto',
  'choque',
];

function normalizeText(value) {
  return sanitizeText(String(value || ''))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeMarkerValue(value) {
  return normalizeText(value).replace(/[.\s]+$/g, '').trim();
}

function timestampSlug(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function readCasesFile(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath || DEFAULT_CASES_PATH);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Arquivo de casos não encontrado: ${resolvedPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const cases = Array.isArray(parsed) ? parsed : parsed?.cases;

  if (!Array.isArray(cases) || !cases.length) {
    throw new Error('O arquivo de casos precisa conter uma lista não vazia.');
  }

  return {
    cases,
    resolvedPath,
  };
}

function isMeaningfulValue(value) {
  const text = sanitizeText(String(value || '')).trim();

  if (!text) {
    return false;
  }

  const normalized = normalizeMarkerValue(text);
  return !MISSING_MARKERS.some((marker) => normalizeMarkerValue(marker) === normalized);
}

function parseStructuredSections(structuredText, templateConfig) {
  const text = sanitizeText(structuredText).replace(/\r/g, '');
  const labels = Array.isArray(templateConfig?.secoes) ? templateConfig.secoes : [];
  const cleaned = text.replace(/^ANAMNESE ESTRUTURADA:\s*/i, '').trim();
  const sections = {};

  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index];
    const nextLabel = labels[index + 1];
    const pattern = nextLabel
      ? new RegExp(`(?:^|\\n)${escapeRegex(label)}:\\s*([\\s\\S]*?)(?=\\n${escapeRegex(nextLabel)}:|$)`, 'i')
      : new RegExp(`(?:^|\\n)${escapeRegex(label)}:\\s*([\\s\\S]*)$`, 'i');
    const match = cleaned.match(pattern);
    sections[label] = sanitizeText(match?.[1] || '').trim();
  }

  return sections;
}

function getInterpretiveSections(structuredSections) {
  return Object.entries(structuredSections).filter(([label]) => {
    const normalized = normalizeText(label);
    return normalized.includes('hipotese') || normalized.includes('problemas ativos') || normalized.includes('impressao clinica') || normalized === 'hd';
  });
}

function detectSuspiciousInvention(rawText, structuredSections) {
  const normalizedRaw = normalizeText(rawText);
  const findings = [];

  for (const [label, content] of getInterpretiveSections(structuredSections)) {
    if (!isMeaningfulValue(content)) {
      continue;
    }

    const normalizedContent = normalizeText(content);
    const introducedTerms = DIAGNOSTIC_TERMS.filter((term) => (
      normalizedContent.includes(normalizeText(term)) && !normalizedRaw.includes(normalizeText(term))
    ));

    if (introducedTerms.length) {
      findings.push({
        section: label,
        terms: Array.from(new Set(introducedTerms)),
      });
    }
  }

  return findings;
}

function buildAutoFlags({
  rawText,
  templateConfig,
  organizationText,
  structuredSections,
  score,
  structuredAnalysis,
  insightPayload,
  errors,
}) {
  const sectionCount = (templateConfig?.secoes || []).length;
  const meaningfulSections = Object.values(structuredSections).filter(isMeaningfulValue).length;
  const placeholderSections = Object.values(structuredSections).filter((value) => !isMeaningfulValue(value)).length;
  const tokenCount = normalizeText(rawText).split(/[^a-z0-9]+/).filter(Boolean).length;
  const coverageValues = Object.values(structuredAnalysis?.coverageBySection || {});
  const presentOrPartialCoverage = coverageValues.filter((value) => value === 'presente' || value === 'parcial').length;
  const inventionFindings = detectSuspiciousInvention(rawText, structuredSections);
  const titlePresent = /ANAMNESE ESTRUTURADA/i.test(organizationText);
  const parsingError = Boolean(errors.organization || errors.insights || !insightPayload?.justification || !insightPayload?.criticalInsight);
  const emptyOrIncomplete = !organizationText || meaningfulSections === 0 || (sectionCount > 0 && placeholderSections >= Math.ceil(sectionCount * 0.75));
  const scorePossiblyInflated = typeof score === 'number' && (
    (score >= 86 && ((structuredAnalysis?.lacunasEssenciais || []).length > 0 || (structuredAnalysis?.fatoresGravidadeEstrutural || []).length > 0)) ||
    (score >= 76 && (structuredAnalysis?.lacunasEssenciais || []).length >= 2)
  );
  const scorePossiblyLow = typeof score === 'number'
    && score <= 50
    && tokenCount >= 60
    && coverageValues.length > 0
    && presentOrPartialCoverage / coverageValues.length >= 0.7;

  const allFlags = [
    titlePresent ? 'titulo_estruturado_presente' : null,
    inventionFindings.length ? 'suspeita_inventou_diagnostico' : null,
    emptyOrIncomplete ? 'output_vazio_ou_muito_incompleto' : null,
    parsingError ? 'erro_de_parsing_ou_execucao' : null,
    scorePossiblyInflated ? 'score_possivelmente_inflado' : null,
    scorePossiblyLow ? 'score_possivelmente_baixo' : null,
  ].filter(Boolean);

  return {
    titlePresent,
    inventionFindings,
    emptyOrIncomplete,
    parsingError,
    scorePossiblyInflated,
    scorePossiblyLow,
    allFlags,
    metrics: {
      meaningfulSections,
      placeholderSections,
      tokenCount,
    },
  };
}

function buildStatus(errors, autoFlags) {
  if (errors.organization || errors.insights) {
    return 'ERRO';
  }

  if (
    autoFlags.inventionFindings.length ||
    autoFlags.emptyOrIncomplete ||
    autoFlags.parsingError ||
    autoFlags.scorePossiblyInflated ||
    autoFlags.scorePossiblyLow
  ) {
    return 'REVISAR';
  }

  return 'OK';
}

function average(numbers) {
  const valid = numbers.filter((value) => typeof value === 'number' && !Number.isNaN(value));
  if (!valid.length) {
    return null;
  }
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1));
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toPrettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function buildMarkdownReport(run) {
  const lines = [
    '# Avaliação em lote - Minha Anamnese',
    '',
    `- Gerado em: ${run.generatedAt}`,
    `- Arquivo de casos: ${run.sourceFile}`,
    `- Total de casos: ${run.summary.totalCases}`,
    '',
  ];

  for (const result of run.results) {
    lines.push(`## Caso ${result.id} — ${result.titulo}`);
    lines.push('');
    lines.push(`- template: ${result.template.nome} (\`${result.template.id}\`)`);
    lines.push(`- score: ${result.score ?? 'n/a'}`);
    lines.push(`- flags automáticas: ${result.autoFlags.allFlags.length ? result.autoFlags.allFlags.join(', ') : 'nenhuma'}`);
    lines.push(`- status geral: ${result.status}`);
    if (result.observacoes) {
      lines.push(`- observações do caso: ${result.observacoes}`);
    }
    if (Array.isArray(result.expectedFlags) && result.expectedFlags.length) {
      lines.push(`- expectedFlags: ${result.expectedFlags.join(', ')}`);
    }
    lines.push('');
    lines.push('### Texto bruto');
    lines.push('');
    lines.push('```text');
    lines.push(result.rawText || '');
    lines.push('```');
    lines.push('');
    lines.push('### Organização');
    lines.push('');
    lines.push('```text');
    lines.push(result.organization.resultado || '');
    lines.push('```');
    lines.push('');
    lines.push('### Insights');
    lines.push('');
    lines.push(`- Nota: ${result.score ?? 'n/a'}`);
    lines.push(`- O que mais enfraqueceu: ${result.insights.interpretation.justification || 'n/a'}`);
    lines.push(`- Outras lacunas: ${result.insights.interpretation.otherGaps.length ? result.insights.interpretation.otherGaps.join('; ') : 'n/a'}`);
    lines.push(`- Próximo passo: ${result.insights.interpretation.criticalInsight || 'n/a'}`);
    lines.push(`- Evolução do usuário: ${result.organization.comparison?.trend || 'n/a'}`);
    lines.push('');
    lines.push('### Observações automáticas');
    lines.push('');
    lines.push(`- suspeita de invenção: ${result.autoFlags.inventionFindings.length ? result.autoFlags.inventionFindings.map((item) => `${item.section} -> ${item.terms.join(', ')}`).join(' | ') : 'não'}`);
    lines.push(`- score possivelmente inflado/baixo: ${result.autoFlags.scorePossiblyInflated ? 'inflado' : result.autoFlags.scorePossiblyLow ? 'baixo' : 'não'}`);
    lines.push(`- título redundante presente: ${result.autoFlags.titlePresent ? 'sim' : 'não'}`);
    lines.push(`- erro de parsing: ${result.autoFlags.parsingError ? 'sim' : 'não'}`);
    if (result.errorMessages.length) {
      lines.push(`- erros: ${result.errorMessages.join(' | ')}`);
    }
    lines.push('');
  }

  lines.push('## Resumo geral');
  lines.push('');
  lines.push(`- total de casos: ${run.summary.totalCases}`);
  lines.push(`- quantos com suspeita de invenção: ${run.summary.suspectedInventionCount}`);
  lines.push(`- quantos com score possivelmente estranho: ${run.summary.weirdScoreCount}`);
  lines.push(`- quantos com erro: ${run.summary.errorCount}`);
  lines.push('- média de score por template:');

  for (const [templateId, value] of Object.entries(run.summary.averageScoreByTemplate)) {
    lines.push(`  - ${templateId}: ${value}`);
  }

  return `${lines.join('\n')}\n`;
}

function buildCsvReport(run) {
  const rows = [
    [
      'id',
      'titulo',
      'templateId',
      'templateNome',
      'status',
      'score',
      'flagsAutomaticas',
      'suspeitaInvencao',
      'scoreEstranho',
      'erro',
      'justification',
      'criticalInsight',
      'otherGaps',
      'observacoes',
    ],
  ];

  for (const result of run.results) {
    rows.push([
      result.id,
      result.titulo,
      result.template.id,
      result.template.nome,
      result.status,
      result.score ?? '',
      result.autoFlags.allFlags.join('; '),
      result.autoFlags.inventionFindings.length ? 'sim' : 'nao',
      result.autoFlags.scorePossiblyInflated || result.autoFlags.scorePossiblyLow ? 'sim' : 'nao',
      result.errorMessages.length ? 'sim' : 'nao',
      result.insights.interpretation.justification || '',
      result.insights.interpretation.criticalInsight || '',
      result.insights.interpretation.otherGaps.join(' | '),
      result.observacoes || '',
    ]);
  }

  return `${rows.map((row) => row.map(csvEscape).join(',')).join('\n')}\n`;
}

function buildSummary(results) {
  const scoresByTemplate = results.reduce((accumulator, result) => {
    if (!accumulator[result.template.id]) {
      accumulator[result.template.id] = [];
    }

    if (typeof result.score === 'number') {
      accumulator[result.template.id].push(result.score);
    }

    return accumulator;
  }, {});

  const averageScoreByTemplate = Object.fromEntries(
    Object.entries(scoresByTemplate).map(([templateId, scores]) => [templateId, average(scores)]),
  );

  return {
    totalCases: results.length,
    suspectedInventionCount: results.filter((result) => result.autoFlags.inventionFindings.length > 0).length,
    weirdScoreCount: results.filter((result) => result.autoFlags.scorePossiblyInflated || result.autoFlags.scorePossiblyLow).length,
    errorCount: results.filter((result) => result.errorMessages.length > 0).length,
    averageScoreByTemplate,
  };
}

async function runCase(testCase) {
  const errors = {};
  const templateConfig = getTemplateById(testCase.templateId);

  if (!templateConfig) {
    return {
      id: testCase.id,
      titulo: testCase.titulo,
      rawText: sanitizeText(testCase.rawText),
      observacoes: sanitizeText(testCase.observacoes),
      expectedFlags: Array.isArray(testCase.expectedFlags) ? testCase.expectedFlags : [],
      template: {
        id: testCase.templateId,
        nome: 'Template inválido',
      },
      organization: {
        resultado: '',
        comparison: null,
      },
      insights: {
        interpretation: {
          message: '',
          justification: '',
          criticalInsight: '',
          otherGaps: [],
        },
      },
      score: null,
      structuredAnalysis: null,
      autoFlags: {
        titlePresent: false,
        inventionFindings: [],
        emptyOrIncomplete: true,
        parsingError: true,
        scorePossiblyInflated: false,
        scorePossiblyLow: false,
        allFlags: ['template_invalido'],
        metrics: {
          meaningfulSections: 0,
          placeholderSections: 0,
          tokenCount: 0,
        },
      },
      status: 'ERRO',
      errorMessages: ['Template inválido'],
    };
  }

  const rawText = sanitizeText(testCase.rawText);
  const qualityScore = calculateAnamnesisQualityScore(rawText, testCase.templateId, templateConfig);

  let organization = { resultado: '', comparison: null };
  let insights = {
    score: qualityScore.score,
    interpretation: {
      message: '',
      justification: '',
      criticalInsight: '',
      otherGaps: [],
    },
  };

  try {
    organization = await processAnamnesis({
      template: testCase.templateId,
      texto: rawText,
      userId: EVAL_USER_ID,
    });
  } catch (error) {
    errors.organization = error;
  }

  try {
    insights = await generateInsights({
      texto: rawText,
      templateId: testCase.templateId,
      userId: EVAL_USER_ID,
    });
  } catch (error) {
    errors.insights = error;
  }

  const structuredSections = parseStructuredSections(organization.resultado, templateConfig);
  const autoFlags = buildAutoFlags({
    rawText,
    templateConfig,
    organizationText: organization.resultado,
    structuredSections,
    score: insights.score ?? qualityScore.score,
    structuredAnalysis: qualityScore.structuredAnalysis,
    insightPayload: insights.interpretation,
    errors,
  });
  const errorMessages = Object.values(errors).map((error) => sanitizeText(error?.message || 'Erro desconhecido'));

  return {
    id: sanitizeText(testCase.id),
    titulo: sanitizeText(testCase.titulo),
    rawText,
    observacoes: sanitizeText(testCase.observacoes),
    expectedFlags: Array.isArray(testCase.expectedFlags) ? testCase.expectedFlags : [],
    template: {
      id: testCase.templateId,
      nome: templateConfig.nome,
    },
    organization,
    insights: {
      ...insights,
      interpretation: {
        message: sanitizeText(insights?.interpretation?.message),
        justification: sanitizeText(insights?.interpretation?.justification),
        criticalInsight: sanitizeText(insights?.interpretation?.criticalInsight),
        otherGaps: Array.isArray(insights?.interpretation?.otherGaps)
          ? insights.interpretation.otherGaps.map((item) => sanitizeText(item))
          : [],
      },
    },
    score: typeof insights?.score === 'number' ? insights.score : qualityScore.score,
    structuredAnalysis: qualityScore.structuredAnalysis,
    structuredSections,
    autoFlags,
    status: buildStatus(errors, autoFlags),
    errorMessages,
  };
}

async function main() {
  const casesPath = process.argv[2] || DEFAULT_CASES_PATH;
  const { cases, resolvedPath } = readCasesFile(casesPath);
  const timestamp = timestampSlug();
  const results = [];

  console.log(`Executando ${cases.length} casos de avaliação...`);

  for (const testCase of cases) {
    const safeLabel = sanitizeText(testCase?.id || testCase?.titulo || 'sem-id');
    console.log(`- ${safeLabel}`);
    results.push(await runCase(testCase));
  }

  const run = {
    generatedAt: new Date().toISOString(),
    sourceFile: resolvedPath,
    results,
    summary: buildSummary(results),
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const baseName = `anamnese-evals-${timestamp}`;
  const jsonPath = path.join(OUTPUT_DIR, `${baseName}.json`);
  const csvPath = path.join(OUTPUT_DIR, `${baseName}.csv`);
  const mdPath = path.join(OUTPUT_DIR, `${baseName}.md`);

  fs.writeFileSync(jsonPath, toPrettyJson(run), 'utf8');
  fs.writeFileSync(csvPath, buildCsvReport(run), 'utf8');
  fs.writeFileSync(mdPath, buildMarkdownReport(run), 'utf8');

  console.log('');
  console.log('Arquivos gerados:');
  console.log(`- ${jsonPath}`);
  console.log(`- ${csvPath}`);
  console.log(`- ${mdPath}`);
}

main().catch((error) => {
  console.error('Falha ao executar avaliações:', error?.message || error);
  process.exitCode = 1;
});

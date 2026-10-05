#!/usr/bin/env node
// Mede a frequência de defeitos de fidelidade (queixa afirmada virando
// negativa, marcador de ausência fora do padrão, remédio preso na comorbidade,
// dado descartado, qualificador inventado nas hipóteses). A saída do modelo
// não é determinística, então cada caso roda N vezes e o relatório mostra
// "falhou X de N" por verificação — é essa taxa que se compara antes e depois
// de mexer em prompt.
//
// Uso (na raiz do repositório):
//   node backend/scripts/run-fidelity-evals.js [--runs 5] [--only id1,id2]
//     [--label antes] [--override slug=caminho.txt ...] [casos.json]
//
// --override troca o corpo de um prompt do CMS por um arquivo local, para medir
// uma edição do Notion antes de publicá-la.
//
// Hipóteses: chama o modelo pelo mesmo caminho de generateDiagnosticHypotheses,
// mas sem gravar o backlog editorial (record_unmatched_*): rodar avaliação em
// lote inflaria as contagens que orientam o que escrever no Notion.
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const officialPrompts = require('../services/officialPrompts');

const DEFAULT_CASES_PATH = path.resolve(__dirname, '../../tests/anamnese-evals/cases.fidelity-regressions.json');
const OUTPUT_DIR = path.resolve(__dirname, '../../test-results');
const EVAL_USER_ID = 'anamnese-evals-local';
const STANDARD_MISSING_MARKER = '[Não relatado]';

function parseArgs(argv) {
  const options = { runs: 5, only: null, label: '', overrides: {}, casesPath: DEFAULT_CASES_PATH };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--runs') {
      options.runs = Math.max(1, Number(argv[++index]) || 1);
    } else if (arg === '--only') {
      options.only = new Set(String(argv[++index] || '').split(',').map((item) => item.trim()).filter(Boolean));
    } else if (arg === '--label') {
      options.label = String(argv[++index] || '').replace(/[^\w-]/g, '');
    } else if (arg === '--reeval') {
      options.reeval = path.resolve(process.cwd(), argv[++index]);
    } else if (arg === '--override') {
      const [slug, filePath] = String(argv[++index] || '').split('=');
      options.overrides[slug] = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8');
    } else {
      options.casesPath = path.resolve(process.cwd(), arg);
    }
  }

  return options;
}

// Precisa acontecer antes de carregar processAnamnesis, que desestrutura estas
// funções no require.
function installPromptOverrides(overrides) {
  const slugs = Object.keys(overrides);

  if (!slugs.length) {
    return;
  }

  const wrap = (original) => async (...args) => {
    const prompt = await original(...args);
    return prompt && overrides[prompt.slug] ? { ...prompt, promptBody: overrides[prompt.slug] } : prompt;
  };

  for (const name of ['getPublishedPromptByCategoryAndType', 'getPublishedDefaultPromptByType', 'getSyncedOfficialPrompt']) {
    officialPrompts[name] = wrap(officialPrompts[name]);
  }
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseSections(text, labels) {
  const sorted = [...labels].sort((a, b) => b.length - a.length);
  const sections = {};
  let current = null;

  for (const line of String(text || '').split('\n')) {
    const label = sorted.find((item) => new RegExp(`^${escapeRegex(item)}\\s*:`, 'i').test(line.trim()));

    if (label) {
      current = label;
      sections[current] = line.trim().slice(line.trim().indexOf(':') + 1).trim();
    } else if (current) {
      sections[current] = `${sections[current]}\n${line}`.trim();
    }
  }

  return sections;
}

function findNonStandardMarkers(text) {
  return (String(text || '').match(/\[[^\]\n]{1,40}\]/g) || [])
    .filter((token) => token !== STANDARD_MISSING_MARKER);
}

// Cada item de cada frase "Nega ..." precisa tratar de algo que o texto
// original negou. Pega negativa inventada ("Nega alteração de humor" sem que o
// paciente tenha falado de humor) e queixa afirmada virando negativa.
function findUnsupportedNegations(output, allowedPattern) {
  const allowed = new RegExp(allowedPattern, 'i');
  const unsupported = [];

  for (const segment of String(output || '').matchAll(/\bnega\b([^.\n]*)/gi)) {
    const items = segment[1].split(/,|\s+e\s+|\s+ou\s+|\s+nem\s+/i).map((item) => item.trim()).filter(Boolean);

    if (items.some((item) => !allowed.test(item))) {
      unsupported.push(segment[0].trim());
    }
  }

  return unsupported;
}

function evaluateStructureCheck(check, output, sections) {
  const target = check.section ? (sections[check.section] ?? '') : output;

  if (check.type === 'negationsOnlyAbout') {
    const unsupported = findUnsupportedNegations(target, check.pattern);
    return { failed: unsupported.length > 0, evidence: unsupported.join(' | ') || null };
  }

  if (check.type === 'sectionIsMarker') {
    const failed = !/^\[[^\]\n]+\]\.?$/.test(target.trim());
    return { failed, evidence: failed ? `${check.section}: ${target || '(seção ausente)'}` : null };
  }

  const regex = new RegExp(check.pattern, 'i');
  const matched = regex.exec(target);

  if (check.type === 'mustMatch') {
    return { failed: !matched, evidence: matched ? null : (check.section ? `${check.section}: ${target || '(seção ausente)'}` : null) };
  }

  if (check.type === 'mustNotMatch') {
    return { failed: Boolean(matched), evidence: matched ? matched[0] : null };
  }

  throw new Error(`Tipo de verificação desconhecido: ${check.type}`);
}

function evaluateStructure(testCase, output, labels) {
  const sections = parseSections(output, labels);
  const markers = findNonStandardMarkers(output);

  return [
    {
      id: 'marcador-padrao',
      label: `Marcador de ausência diferente de ${STANDARD_MISSING_MARKER}`,
      failed: markers.length > 0,
      evidence: markers.length ? Array.from(new Set(markers)).join(' ') : null,
    },
    ...testCase.checks.map((check) => ({ id: check.id, label: check.label, ...evaluateStructureCheck(check, output, sections) })),
  ];
}

function evaluateHypotheses(testCase, parsed) {
  return testCase.checks.map((check) => ({ id: check.id, label: check.label, ...evaluateHypothesesCheck(check, parsed) }));
}

function evaluateHypothesesCheck(check, result) {
  const regex = new RegExp(check.pattern, 'i');
  const items = Array.isArray(result?.hypotheses) ? result.hypotheses : [];

  if (check.type === 'namesNotMatch') {
    const hits = items.filter((item) => regex.test(item.name || '')).map((item) => item.name);
    return { failed: hits.length > 0, evidence: hits.join(' | ') || null };
  }

  if (check.type === 'maxItemsMatching') {
    const hits = items.filter((item) => regex.test(item.name || '')).map((item) => item.name);
    return { failed: hits.length > check.max, evidence: hits.length > check.max ? hits.join(' | ') : null };
  }

  if (check.type === 'textNotMatch') {
    for (const item of items) {
      const text = [item.rationale, ...(item.supportingEvidence || [])].join(' ');
      const matched = regex.exec(text);

      if (matched) {
        return { failed: true, evidence: `${item.name}: "${matched[0]}"` };
      }
    }

    return { failed: false, evidence: null };
  }

  throw new Error(`Tipo de verificação desconhecido: ${check.type}`);
}

async function runStructure(testCase, deps) {
  const templateConfig = await deps.resolveTemplateById(testCase.templateId, EVAL_USER_ID);
  const { resultado } = await deps.processAnamnesis({
    template: testCase.templateId,
    texto: testCase.rawText,
    userId: EVAL_USER_ID,
  });

  return { output: resultado, checks: evaluateStructure(testCase, resultado, templateConfig?.secoes || []) };
}

async function runHypotheses(testCase, deps) {
  const templateConfig = await deps.resolveTemplateById(testCase.templateId, EVAL_USER_ID);
  const syncedPrompt = await officialPrompts.getSyncedOfficialPrompt('diagnostic_hypotheses_system').catch(() => null);
  const model = deps.resolveDiagnosticModel(syncedPrompt?.model);
  const [maneuverNames, examNames] = await Promise.all([
    deps.listManeuverNamesForPrompt().catch(() => []),
    deps.listExamNamesForPrompt().catch(() => []),
  ]);
  const { parsed } = await deps.createStructuredDiagnosticResponse({
    openai: deps.openai,
    model,
    instructions: deps.buildDiagnosticHypothesesInstructions(syncedPrompt?.promptBody),
    input: deps.buildDiagnosticHypothesesInput({
      structuredHistory: testCase.structuredText,
      templateName: templateConfig?.nome,
      clinicalCategory: templateConfig?.categoryKey || templateConfig?.clinicalCategoryKey || '',
      maneuverNames,
      examNames,
    }),
    safetyIdentifier: deps.createSafetyIdentifier(EVAL_USER_ID),
    promptVersion: syncedPrompt?.version || 0,
  });
  const output = (parsed.hypotheses || [])
    .map((item, index) => `${index + 1} | ${item.priority} | ${item.name}\n    ${item.rationale}`)
    .join('\n');

  return { output: `status: ${parsed.status} | modelo: ${model}\n${output}`, parsed, checks: evaluateHypotheses(testCase, parsed) };
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function withRateLimitRetry(task, attempts = 4) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (error?.status !== 429 || attempt >= attempts) {
        throw error;
      }
      const waitSeconds = Number(String(error.message).match(/try again in ([\d.]+)s/)?.[1]) || 10;
      await sleep((waitSeconds + 1) * 1000);
    }
  }
}

async function runSequentially(count, task) {
  const results = [];
  for (let index = 0; index < count; index += 1) {
    results.push(await task());
  }
  return results;
}

function summarize(caseResult) {
  const counts = new Map();

  for (const run of caseResult.runs) {
    for (const check of run.checks || []) {
      const entry = counts.get(check.id) || { id: check.id, label: check.label, failed: 0, total: 0 };
      entry.total += 1;
      entry.failed += check.failed ? 1 : 0;
      counts.set(check.id, entry);
    }
  }

  return Array.from(counts.values());
}

function printCaseSummary(caseResult) {
  console.log(`\n${caseResult.id}${caseResult.errors ? ` (${caseResult.errors} com erro)` : ''}`);
  for (const entry of caseResult.summary) {
    console.log(`  ${String(entry.failed).padStart(2)}/${entry.total}  ${entry.label}`);
  }
}

function buildMarkdown(report) {
  const lines = [
    `# Avaliação de fidelidade${report.label ? ` — ${report.label}` : ''}`,
    '',
    `- Gerado em: ${report.generatedAt}`,
    `- Rodadas por caso: ${report.runs}`,
    `- Prompts substituídos localmente: ${report.overrides.length ? report.overrides.join(', ') : 'nenhum'}`,
    '',
    '## Resumo (falhas / rodadas)',
    '',
    '| Caso | Verificação | Falhas |',
    '| --- | --- | --- |',
  ];

  for (const caseResult of report.cases) {
    for (const entry of caseResult.summary) {
      lines.push(`| ${caseResult.id} | ${entry.label} | ${entry.failed}/${entry.total} |`);
    }
    if (caseResult.errors) {
      lines.push(`| ${caseResult.id} | erro de execução | ${caseResult.errors}/${report.runs} |`);
    }
  }

  for (const caseResult of report.cases) {
    lines.push('', `## ${caseResult.id} — ${caseResult.titulo}`, '');
    caseResult.runs.forEach((run, index) => {
      lines.push(`### Rodada ${index + 1}`, '');
      if (run.error) {
        lines.push(`Erro: ${run.error}`, '');
        return;
      }
      const failed = run.checks.filter((check) => check.failed);
      lines.push(`Falhas: ${failed.length ? failed.map((check) => `${check.id}${check.evidence ? ` (${check.evidence})` : ''}`).join('; ') : 'nenhuma'}`, '');
      lines.push('```text', run.output, '```', '');
    });
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  installPromptOverrides(options.overrides);

  const OpenAI = require('openai');
  const { processAnamnesis } = require('../services/processAnamnesis');
  const { resolveTemplateById } = require('../services/templates');
  const {
    createSafetyIdentifier,
    createStructuredDiagnosticResponse,
    resolveDiagnosticModel,
  } = require('../services/generateDiagnosticHypotheses');
  const {
    buildDiagnosticHypothesesInput,
    buildDiagnosticHypothesesInstructions,
  } = require('../prompts/diagnosticHypothesesPrompt');
  const { listExamNamesForPrompt } = require('../services/diagnosticExams');
  const { listManeuverNamesForPrompt } = require('../services/physicalExamManeuvers');
  const deps = {
    buildDiagnosticHypothesesInput,
    buildDiagnosticHypothesesInstructions,
    createSafetyIdentifier,
    createStructuredDiagnosticResponse,
    listExamNamesForPrompt,
    listManeuverNamesForPrompt,
    openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    processAnamnesis,
    resolveDiagnosticModel,
    resolveTemplateById,
  };

  const cases = JSON.parse(fs.readFileSync(options.casesPath, 'utf8'))
    .filter((testCase) => !options.only || options.only.has(testCase.id));
  const previous = options.reeval ? JSON.parse(fs.readFileSync(options.reeval, 'utf8')) : null;
  const report = {
    generatedAt: new Date().toISOString(),
    label: options.label,
    runs: previous ? previous.runs : options.runs,
    overrides: previous ? previous.overrides : Object.keys(options.overrides),
    reevaluatedFrom: options.reeval ? path.basename(options.reeval) : undefined,
    cases: [],
  };

  for (const testCase of cases) {
    if (previous) {
      // Reavalia saídas já geradas com as verificações atuais do arquivo de
      // casos, sem chamar o modelo de novo.
      const previousCase = previous.cases.find((item) => item.id === testCase.id);

      if (!previousCase) {
        continue;
      }

      const labels = testCase.kind === 'structure'
        ? (await resolveTemplateById(testCase.templateId, EVAL_USER_ID))?.secoes || []
        : [];
      const runs = previousCase.runs.map((run) => {
        if (run.error) {
          return run;
        }
        if (testCase.kind === 'structure') {
          return { ...run, checks: evaluateStructure(testCase, run.output, labels) };
        }
        return run.parsed ? { ...run, checks: evaluateHypotheses(testCase, run.parsed) } : run;
      });
      const caseResult = { ...previousCase, titulo: testCase.titulo, runs, errors: runs.filter((run) => run.error).length };
      caseResult.summary = summarize(caseResult);
      report.cases.push(caseResult);
      printCaseSummary(caseResult);
      continue;
    }

    const runner = testCase.kind === 'hypotheses' ? runHypotheses : runStructure;
    const runOnce = () => withRateLimitRetry(() => runner(testCase, deps))
      .catch((error) => ({ error: error.message, checks: [] }));
    // Hipóteses rodam no gpt-4o, cujo limite da conta (30 mil tokens/min) não
    // comporta várias chamadas de ~6 mil tokens ao mesmo tempo.
    const runs = testCase.kind === 'hypotheses'
      ? await runSequentially(options.runs, runOnce)
      : await Promise.all(Array.from({ length: options.runs }, runOnce));
    const caseResult = {
      id: testCase.id,
      titulo: testCase.titulo,
      kind: testCase.kind,
      templateId: testCase.templateId,
      runs,
      errors: runs.filter((run) => run.error).length,
    };
    caseResult.summary = summarize(caseResult);
    report.cases.push(caseResult);

    printCaseSummary(caseResult);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, '-');
  const baseName = `fidelity-evals-${options.label ? `${options.label}-` : ''}${stamp}`;
  fs.writeFileSync(path.join(OUTPUT_DIR, `${baseName}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUTPUT_DIR, `${baseName}.md`), buildMarkdown(report), 'utf8');
  console.log(`\nRelatório: test-results/${baseName}.md`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

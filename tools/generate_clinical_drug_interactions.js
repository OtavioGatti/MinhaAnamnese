#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SOURCE_DIR = 'C:\\dev\\Robo PatoPrescrições\\outputs\\bulario_clinico_revisado';
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), 'data', 'generated', 'clinical_drug_interactions');
const STRUCTURED_INTERACTIONS_KEY = 'Interações Estruturadas';

const PHARMACEUTICAL_SUFFIX_WORDS = new Set([
  'acido',
  'acetato',
  'anhidro',
  'base',
  'besilato',
  'brometo',
  'bromidrato',
  'calcio',
  'cloridrato',
  'cloreto',
  'de',
  'di',
  'dihidratado',
  'dissodico',
  'fosfato',
  'hemihidratado',
  'hidrobrometo',
  'hidrocloreto',
  'magnesio',
  'maleato',
  'mesilato',
  'monoidratado',
  'nitrato',
  'potassico',
  'sodico',
  'succinato',
  'sulfato',
]);

const ALIAS_STOPWORDS = new Set([
  'adulto',
  'analgesico',
  'analgesicos',
  'analgesico opioide',
  'anti inflamatorio',
  'antiinflamatorio',
  'antiinflamatorios',
  'antibiotico',
  'antibioticos',
  'antidepressivo',
  'antidepressivos',
  'antitermico',
  'antitermicos',
  'antiviral',
  'antivirais',
  'capsula',
  'comprimido',
  'comprimidos',
  'crianca',
  'dor',
  'fraco',
  'generico',
  'genericos',
  'grave',
  'moderada',
  'opioide',
  'opioides',
  'pediatrico',
  'solucao',
  'suspensao',
  'uso',
  'xarope',
]);

const SEVERITY_RANK = {
  info: 1,
  warning: 2,
  danger: 3,
};

function parseArgs(argv) {
  const args = {
    sourceDir: process.env.CLINICAL_DRUG_JSON_DIR || DEFAULT_SOURCE_DIR,
    outDir: process.env.CLINICAL_DRUG_INTERACTIONS_OUT_DIR || DEFAULT_OUT_DIR,
    writeJson: false,
    includeRuleCandidates: true,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--source-dir' && next) {
      args.sourceDir = next;
      index += 1;
    } else if (arg === '--out-dir' && next) {
      args.outDir = next;
      index += 1;
    } else if (arg === '--write-json') {
      args.writeJson = true;
    } else if (arg === '--no-rule-candidates') {
      args.includeRuleCandidates = false;
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log([
    'Usage: node tools/generate_clinical_drug_interactions.js [options]',
    '',
    'Options:',
    '  --source-dir <path>       Directory with reviewed clinical-drug JSON files.',
    '  --out-dir <path>          Directory for preview/report/payload outputs.',
    '  --write-json              Write "Interações Estruturadas" back to source JSON files.',
    '  --no-rule-candidates      Skip class/mechanism candidates that need human review.',
    '  --help                    Show this help.',
  ].join('\n'));
}

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeText(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSlug(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeDisplayText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function getField(item, names) {
  const keys = Array.isArray(names) ? names : [names];

  for (const key of keys) {
    if (item[key] != null) {
      return item[key];
    }
  }

  return '';
}

function getTextField(item, names) {
  const value = getField(item, names);

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  return String(value || '').trim();
}

function splitAliasCandidates(value) {
  const text = String(value || '').trim();

  if (!text) {
    return [];
  }

  return [
    text,
    ...text.split(/\r?\n|;|,|\s+\+\s+|\s+\/\s+/),
  ];
}

function removePharmaceuticalSuffixes(alias) {
  return normalizeText(alias)
    .split(' ')
    .filter((part) => part && !PHARMACEUTICAL_SUFFIX_WORDS.has(part))
    .join(' ')
    .trim();
}

function isUsefulAlias(alias) {
  return alias.length >= 3 &&
    /[a-z]/.test(alias) &&
    !ALIAS_STOPWORDS.has(alias);
}

function buildAliases(drug) {
  const rawAliases = [
    drug.slug,
    drug.slug.replace(/-/g, ' '),
    drug.activeIngredient,
    drug.commercialNamesAnvisa,
    drug.commercialNamesOpenai,
  ].flatMap(splitAliasCandidates);

  const aliases = rawAliases.flatMap((alias) => [
    normalizeText(alias),
    removePharmaceuticalSuffixes(alias),
  ]);

  return unique(aliases.filter(isUsefulAlias));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textMentionsAlias(normalizedText, alias) {
  if (!normalizedText || !alias) {
    return false;
  }

  return new RegExp(`(^|\\s)${escapeRegExp(alias)}($|\\s)`).test(normalizedText);
}

function findMentionedAlias(interactions, aliases) {
  const normalizedInteractions = normalizeText(interactions);
  return aliases.find((alias) => textMentionsAlias(normalizedInteractions, alias)) || '';
}

function splitInteractionEvidence(interactions) {
  return String(interactions || '')
    .split(/\n{2,}|(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findEvidenceSnippet(interactions, alias) {
  const normalizedAlias = normalizeText(alias);

  if (!normalizedAlias) {
    return '';
  }

  const snippet = splitInteractionEvidence(interactions).find((item) => {
    return textMentionsAlias(normalizeText(item), normalizedAlias);
  }) || '';

  return normalizeDisplayText(snippet).slice(0, 480);
}

function inferInteractionDetails(evidence) {
  const normalized = normalizeText(evidence);
  let severity = 'warning';
  let mechanism = 'Interação medicamentosa documentada no Bulário';

  if (/contraind|nao usar|nao associar|evitar|coma|morte|depressao respiratoria/.test(normalized)) {
    severity = 'danger';
  }

  if (/serotonin/.test(normalized)) {
    mechanism = 'Risco de síndrome serotoninérgica';
  } else if (/convuls|limiar convulsivo/.test(normalized)) {
    mechanism = 'Risco de convulsão ou redução do limiar convulsivo';
  } else if (/cyp2d6|conversao|morfina|analgesia/.test(normalized)) {
    mechanism = 'Interferência em CYP2D6 e resposta analgésica';
  } else if (/depressao respiratoria|sedacao|snc|coma/.test(normalized)) {
    mechanism = 'Sedação e depressão respiratória';
  } else if (/sangramento|hemorrag|inr|anticoagul|antiagreg|plaquet/.test(normalized)) {
    mechanism = 'Aumento de risco de sangramento';
  } else if (/qt|arritm/.test(normalized)) {
    mechanism = 'Risco de prolongamento de QT ou arritmia';
  } else if (/hepatotoxic|hepatic/.test(normalized)) {
    mechanism = 'Risco de toxicidade hepática';
  } else if (/hipercalem|potass/.test(normalized)) {
    mechanism = 'Risco de hipercalemia';
  }

  return { severity, mechanism };
}

function classifyDrug(drug) {
  const text = normalizeText([
    drug.slug,
    drug.activeIngredient,
    drug.classCategory,
    drug.searchTags,
    drug.summaryText,
  ].join(' '));

  return {
    serotonergic: /seroton|isrs|isrn|tramadol|venlafaxina|duloxetina|amitriptilina|clomipramina/.test(text),
    opioid: /opioide|codeina|tramadol|morfina|fentanil|oxicodona|metadona|buprenorfina/.test(text),
    benzodiazepineOrSedative: /benzodiazep|diazepam|clonazepam|alprazolam|lorazepam|midazolam|zolpidem|zopiclona/.test(text),
    cyp2d6Inhibitor: /bupropiona|fluoxetina|paroxetina|quinidina|duloxetina|terbinafina|mirabegrona/.test(text),
    codeineLike: /codeina/.test(text),
    tramadolLike: /tramadol/.test(text),
    anticoagulantOrAntiplatelet: /varfarina|rivaroxabana|apixabana|dabigatrana|edoxabana|heparina|enoxaparina|aas|acido acetilsalicilico|clopidogrel|prasugrel|ticagrelor/.test(text),
    nsaid: /aine|ibuprofeno|diclofenaco|naproxeno|cetoprofeno|nimesulida|meloxicam|celecoxibe|etoricoxibe/.test(text),
    aceArb: /enalapril|captopril|lisinopril|ramipril|losartana|valsartana|candesartana|olmesartana|telmisartana|ieca|bra/.test(text),
    potassiumSparingOrPotassium: /espironolactona|eplerenona|amilorida|triantereno|cloreto de potassio|potassio/.test(text),
  };
}

function makeInteractionPair({
  sourceDrug,
  targetDrug,
  severity,
  mechanism,
  source,
  confidence,
  needsReview,
  evidence,
}) {
  const sourceName = sourceDrug.activeIngredient || sourceDrug.slug;
  const targetName = targetDrug.activeIngredient || targetDrug.slug;

  return {
    target_slug: targetDrug.slug,
    target_name: targetName,
    severity,
    mechanism,
    message: `${sourceName} + ${targetName}: ${mechanism}. Revise antes de prescrever.`,
    source,
    confidence,
    needs_review: Boolean(needsReview),
    evidence: evidence || '',
  };
}

function getRuleCandidate(sourceDrug, targetDrug) {
  const source = sourceDrug.flags;
  const target = targetDrug.flags;

  if ((source.serotonergic && target.tramadolLike) || (source.tramadolLike && target.serotonergic)) {
    return {
      severity: 'warning',
      mechanism: 'Risco de síndrome serotoninérgica e convulsões',
      evidence: 'Regra por classe: serotoninérgico + tramadol.',
    };
  }

  if ((source.cyp2d6Inhibitor && (target.codeineLike || target.tramadolLike)) ||
    (target.cyp2d6Inhibitor && (source.codeineLike || source.tramadolLike))) {
    return {
      severity: 'warning',
      mechanism: 'Interferência em CYP2D6 e resposta analgésica',
      evidence: 'Regra por classe: inibidor de CYP2D6 + codeína/tramadol.',
    };
  }

  if ((source.opioid && target.benzodiazepineOrSedative) || (target.opioid && source.benzodiazepineOrSedative)) {
    return {
      severity: 'danger',
      mechanism: 'Sedação e depressão respiratória',
      evidence: 'Regra por classe: opioide + benzodiazepínico/sedativo.',
    };
  }

  if ((source.anticoagulantOrAntiplatelet && target.nsaid) || (target.anticoagulantOrAntiplatelet && source.nsaid)) {
    return {
      severity: 'warning',
      mechanism: 'Aumento de risco de sangramento',
      evidence: 'Regra por classe: anticoagulante/antiagregante + AINE.',
    };
  }

  if ((source.aceArb && target.potassiumSparingOrPotassium) || (target.aceArb && source.potassiumSparingOrPotassium)) {
    return {
      severity: 'warning',
      mechanism: 'Risco de hipercalemia',
      evidence: 'Regra por classe: IECA/BRA + poupador de potássio/potássio.',
    };
  }

  return null;
}

function shouldReplacePair(current, candidate) {
  if (!current) {
    return true;
  }

  const currentRank = SEVERITY_RANK[current.severity] || 0;
  const candidateRank = SEVERITY_RANK[candidate.severity] || 0;

  if (candidateRank !== currentRank) {
    return candidateRank > currentRank;
  }

  if (current.needs_review !== candidate.needs_review) {
    return current.needs_review && !candidate.needs_review;
  }

  return current.confidence !== 'high' && candidate.confidence === 'high';
}

function addPair(pairMap, pair) {
  const current = pairMap.get(pair.target_slug);

  if (shouldReplacePair(current, pair)) {
    pairMap.set(pair.target_slug, pair);
  }
}

function loadDrugs(sourceDir) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  return fs.readdirSync(sourceDir)
    .filter((file) => {
      const normalizedFile = file.toLowerCase();

      return normalizedFile.endsWith('.json') &&
        !normalizedFile.startsWith('.') &&
        !normalizedFile.includes('manifest') &&
        !normalizedFile.includes('relatorio');
    })
    .map((file) => {
      const filePath = path.join(sourceDir, file);
      const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const slug = normalizeSlug(getTextField(json, 'Slug') || path.basename(file, '.json'));

      return {
        file,
        filePath,
        json,
        slug,
        notionPageId: json?._notion?.page_id || '',
        notionUrl: json?._notion?.url || '',
        activeIngredient: getTextField(json, 'Princípio Ativo') || slug.replace(/-/g, ' '),
        classCategory: getTextField(json, 'Classe / Categoria'),
        interactions: getTextField(json, 'Interações'),
        commercialNamesAnvisa: getTextField(json, 'Nomes Comerciais / Produtos ANVISA'),
        commercialNamesOpenai: getTextField(json, 'Nomes Comerciais OpenAI'),
        presentations: getTextField(json, [
          'Apresentações / nomes comerciais',
          'Apresentações / Nomes Comerciais',
        ]),
        searchTags: getTextField(json, 'Tags Busca'),
        summaryText: getTextField(json, 'Texto Resumo'),
      };
    })
    .filter((drug) => drug.slug && drug.activeIngredient);
}

function enrichDrugs(drugs) {
  drugs.forEach((drug) => {
    drug.aliases = buildAliases(drug);
    drug.flags = classifyDrug(drug);
  });
}

function generatePairs(drugs, { includeRuleCandidates }) {
  const pairMaps = new Map(drugs.map((drug) => [drug.slug, new Map()]));

  for (const sourceDrug of drugs) {
    if (!sourceDrug.interactions) {
      continue;
    }

    for (const targetDrug of drugs) {
      if (sourceDrug.slug === targetDrug.slug) {
        continue;
      }

      const alias = findMentionedAlias(sourceDrug.interactions, targetDrug.aliases);

      if (!alias) {
        continue;
      }

      const evidence = findEvidenceSnippet(sourceDrug.interactions, alias);
      const details = inferInteractionDetails(evidence || sourceDrug.interactions);

      addPair(pairMaps.get(sourceDrug.slug), makeInteractionPair({
        sourceDrug,
        targetDrug,
        severity: details.severity,
        mechanism: details.mechanism,
        source: 'interactions_text',
        confidence: 'high',
        needsReview: false,
        evidence,
      }));
    }
  }

  if (includeRuleCandidates) {
    for (let index = 0; index < drugs.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < drugs.length; nextIndex += 1) {
        const first = drugs[index];
        const second = drugs[nextIndex];
        const rule = getRuleCandidate(first, second);

        if (!rule) {
          continue;
        }

        addPair(pairMaps.get(first.slug), makeInteractionPair({
          sourceDrug: first,
          targetDrug: second,
          severity: rule.severity,
          mechanism: rule.mechanism,
          source: 'class_rule',
          confidence: 'medium',
          needsReview: true,
          evidence: rule.evidence,
        }));

        addPair(pairMaps.get(second.slug), makeInteractionPair({
          sourceDrug: second,
          targetDrug: first,
          severity: rule.severity,
          mechanism: rule.mechanism,
          source: 'class_rule',
          confidence: 'medium',
          needsReview: true,
          evidence: rule.evidence,
        }));
      }
    }
  }

  for (const drug of drugs) {
    drug.interactionPairs = [...pairMaps.get(drug.slug).values()]
      .sort((first, second) => {
        const severityDiff = (SEVERITY_RANK[second.severity] || 0) - (SEVERITY_RANK[first.severity] || 0);
        if (severityDiff !== 0) return severityDiff;
        if (first.needs_review !== second.needs_review) return first.needs_review ? 1 : -1;
        return first.target_slug.localeCompare(second.target_slug);
      });
  }
}

function csvEscape(value) {
  const text = String(value || '');
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsvReport(drugs) {
  const rows = [[
    'source_slug',
    'source_name',
    'target_slug',
    'target_name',
    'severity',
    'mechanism',
    'source',
    'confidence',
    'needs_review',
    'evidence',
  ]];

  for (const drug of drugs) {
    for (const pair of drug.interactionPairs) {
      rows.push([
        drug.slug,
        drug.activeIngredient,
        pair.target_slug,
        pair.target_name,
        pair.severity,
        pair.mechanism,
        pair.source,
        pair.confidence,
        pair.needs_review ? 'true' : 'false',
        pair.evidence,
      ]);
    }
  }

  return `${rows.map((row) => row.map(csvEscape).join(',')).join('\n')}\n`;
}

function buildPreview(drugs, sourceDir) {
  const totalPairs = drugs.reduce((sum, drug) => sum + drug.interactionPairs.length, 0);
  const approvedPairs = drugs.reduce(
    (sum, drug) => sum + drug.interactionPairs.filter((pair) => !pair.needs_review).length,
    0,
  );
  const reviewPairs = totalPairs - approvedPairs;

  return {
    generated_at: new Date().toISOString(),
    source_dir: sourceDir,
    total_drugs: drugs.length,
    total_pairs: totalPairs,
    approved_pairs: approvedPairs,
    review_pairs: reviewPairs,
    drugs: drugs.map((drug) => ({
      slug: drug.slug,
      active_ingredient: drug.activeIngredient,
      notion_page_id: drug.notionPageId || null,
      interaction_pairs: drug.interactionPairs,
    })),
  };
}

function buildNotionPayload(drugs) {
  return {
    generated_at: new Date().toISOString(),
    property_name: STRUCTURED_INTERACTIONS_KEY,
    rows: drugs.map((drug) => ({
      page_id: drug.notionPageId || null,
      slug: drug.slug,
      active_ingredient: drug.activeIngredient,
      value: JSON.stringify(drug.interactionPairs, null, 2),
    })),
  };
}

function buildSupabasePatchSql(drugs) {
  const lines = [
    '-- Generated clinical-drug interaction pairs.',
    '-- Run after supabase/clinical_drugs.sql has added interaction_pairs.',
    '',
  ];

  for (const drug of drugs) {
    const pairs = JSON.stringify(drug.interactionPairs).replace(/'/g, "''");
    lines.push(`update public.clinical_drugs set interaction_pairs = '${pairs}'::jsonb where slug = '${drug.slug.replace(/'/g, "''")}';`);
  }

  lines.push('');
  return lines.join('\n');
}

function writeOutputs({ drugs, sourceDir, outDir }) {
  fs.mkdirSync(outDir, { recursive: true });

  const preview = buildPreview(drugs, sourceDir);
  fs.writeFileSync(
    path.join(outDir, 'interaction_pairs_preview.json'),
    `${JSON.stringify(preview, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(outDir, 'interaction_pairs_report.csv'),
    buildCsvReport(drugs),
    'utf8',
  );
  fs.writeFileSync(
    path.join(outDir, 'notion_interaction_pairs_payload.json'),
    `${JSON.stringify(buildNotionPayload(drugs), null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(outDir, 'supabase_interaction_pairs_patch.sql'),
    buildSupabasePatchSql(drugs),
    'utf8',
  );

  return preview;
}

function writeJsonFiles(drugs) {
  for (const drug of drugs) {
    drug.json[STRUCTURED_INTERACTIONS_KEY] = JSON.stringify(drug.interactionPairs, null, 2);
    fs.writeFileSync(drug.filePath, `${JSON.stringify(drug.json, null, 2)}\n`, 'utf8');
  }
}

function main() {
  const args = parseArgs(process.argv);
  const drugs = loadDrugs(args.sourceDir);

  enrichDrugs(drugs);
  generatePairs(drugs, { includeRuleCandidates: args.includeRuleCandidates });

  if (args.writeJson) {
    writeJsonFiles(drugs);
  }

  const preview = writeOutputs({
    drugs,
    sourceDir: args.sourceDir,
    outDir: args.outDir,
  });

  console.log(JSON.stringify({
    total_drugs: preview.total_drugs,
    total_pairs: preview.total_pairs,
    approved_pairs: preview.approved_pairs,
    review_pairs: preview.review_pairs,
    wrote_json: args.writeJson,
    out_dir: args.outDir,
  }, null, 2));
}

main();

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { collectTargets, extractInterfaceModel } = require('./lib/extractors');
const { runAudit } = require('./lib/rules');
const { renderMarkdownReport } = require('./lib/report');

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    target: args[0],
    output: null
  };

  for (let index = 1; index < args.length; index += 1) {
    const current = args[index];
    if ((current === '--output' || current === '-o') && args[index + 1]) {
      options.output = args[index + 1];
      index += 1;
    }
  }

  return options;
}

function printUsage() {
  console.log(`
UX Copy & Interface Auditor

Usage:
  node plugins/ux-copy-interface-auditor/scripts/audit.js <file-or-folder> [--output report.md]

Examples:
  node plugins/ux-copy-interface-auditor/scripts/audit.js frontend/src/App.jsx
  node plugins/ux-copy-interface-auditor/scripts/audit.js frontend/src/components --output ux-audit.md
`);
}

function main() {
  const options = parseArgs(process.argv);

  if (!options.target || options.target === '--help' || options.target === '-h') {
    printUsage();
    process.exit(options.target ? 0 : 1);
  }

  const root = process.cwd();
  const targetPath = path.resolve(root, options.target);

  if (!fs.existsSync(targetPath)) {
    console.error(`Target not found: ${targetPath}`);
    process.exit(1);
  }

  const files = collectTargets(targetPath);

  if (files.length === 0) {
    console.error('No auditable UI files found. Supported: .html, .jsx, .tsx, .js, .ts, .css, .scss');
    process.exit(1);
  }

  const model = extractInterfaceModel(files, root);
  const audit = runAudit(model);
  const report = renderMarkdownReport(audit);

  if (options.output) {
    const outputPath = path.resolve(root, options.output);
    fs.writeFileSync(outputPath, report, 'utf8');
    console.log(`Report written to ${outputPath}`);
  } else {
    console.log(report);
  }
}

main();

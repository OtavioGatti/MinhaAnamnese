# UX Copy & Interface Auditor

A repo-local Codex plugin and CLI tool for auditing screens, components, pages and flows with a strict UX, copywriting and product-design lens.

## What It Checks

- Screen clarity: page purpose, primary action, distractions and text load.
- Copy: weak CTAs, vague labels, robotic language, long text, missing benefit and ambiguity.
- Visual hierarchy: heading structure, competing emphasis, primary vs secondary action clarity.
- Consistency: spacing, sizing, colors, typography, cards and alignment signals.
- Organization: scattered information, overloaded blocks, missing grouping and poor reading order.
- Professionalism and conversion: trust signals, confidence, persuasive specificity and avoidable doubt.
- Basic accessibility: missing alt text, unlabeled inputs, icon-only buttons and weak semantic cues.

## Usage

Run from the repository root:

```bash
node plugins/ux-copy-interface-auditor/scripts/audit.js frontend/src/App.jsx
```

Audit a folder:

```bash
node plugins/ux-copy-interface-auditor/scripts/audit.js frontend/src/components
```

Save a report:

```bash
node plugins/ux-copy-interface-auditor/scripts/audit.js frontend/src/components --output ux-audit.md
```

## Output

The report includes:

- Summary diagnosis.
- Main problems with impact, reason, fix and improved example.
- Scores from 0 to 10.
- Priority corrections.
- Suggested screen structure.

## Architecture

- `scripts/audit.js`: command-line entrypoint.
- `scripts/lib/extractors.js`: extracts UI text, attributes, classes and structure signals.
- `scripts/lib/rules.js`: applies audit rules and scoring.
- `scripts/lib/report.js`: renders a Markdown report.
- `skills/ux-copy-interface-auditor/SKILL.md`: Codex instructions for using the plugin.

The first version uses static heuristics so it can run without project-specific builds. Future versions can add AST parsing, screenshot analysis and browser-based measurement without changing the public report format.

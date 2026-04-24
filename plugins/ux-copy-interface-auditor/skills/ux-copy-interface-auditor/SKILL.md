---
name: ux-copy-interface-auditor
description: Audit UI files, React components, HTML, Tailwind/CSS classes and interface copy for UX clarity, copy quality, hierarchy, consistency, professionalism and conversion risks.
---

# UX Copy & Interface Auditor

Use this skill when the user asks to review a screen, component, page, flow, interface copy, CTA, hierarchy, layout polish, conversion quality, or professional perception.

## Workflow

1. Identify the target file or folder. Prefer concrete files such as `frontend/src/App.jsx`, `frontend/src/components/ProfilePage.jsx`, or a components folder.
2. Run the local CLI from the repository root:

```bash
node plugins/ux-copy-interface-auditor/scripts/audit.js <target>
```

3. Read the generated Markdown report in the terminal output.
4. If the user wants implementation, edit the affected UI files and re-run the auditor.
5. For visual issues that require rendered proof, combine this with browser verification or screenshot review.

## Review Standard

Be direct, critical and useful. Avoid generic advice. Every finding should explain:

- What is wrong.
- Why it hurts clarity, trust, hierarchy, conversion or perceived quality.
- How to fix it.
- A better example when copy is involved.

## Output Shape

Use this structure in the answer when summarizing results:

- Resumo geral
- Principais problemas
- Notas
- Correcoes prioritarias
- Sugestao de nova estrutura

## Current Limits

The CLI is static and heuristic. It reads code, text and class patterns; it does not yet inspect rendered screenshots or computed CSS. Treat visual findings as strong signals that should be confirmed in-browser for high-stakes UI changes.

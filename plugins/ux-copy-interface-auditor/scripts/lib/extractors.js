const fs = require('fs');
const path = require('path');

const AUDITABLE_EXTENSIONS = new Set(['.html', '.jsx', '.tsx', '.js', '.ts', '.css', '.scss']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'test-results']);

function collectTargets(targetPath) {
  const stat = fs.statSync(targetPath);

  if (stat.isFile()) {
    return AUDITABLE_EXTENSIONS.has(path.extname(targetPath)) ? [targetPath] : [];
  }

  const files = [];
  const entries = fs.readdirSync(targetPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const nextPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTargets(nextPath));
    } else if (AUDITABLE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(nextPath);
    }
  }

  return files.sort();
}

function stripCodeNoise(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, ' ')
    .replace(/export\s+default\s+/g, ' ');
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractStringLiterals(source) {
  const matches = [];
  const regex = /(['"`])((?:\\.|(?!\1)[\s\S]){2,}?)\1/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const raw = normalizeText(match[2]);
    if (raw.length < 2 || /^[./#?&=_:;{}()[\],\w-]+$/.test(raw)) {
      continue;
    }
    matches.push(raw);
  }

  return matches;
}

function extractJsxText(source) {
  const matches = [];
  const regex = />\s*([^<>{}][^<>{}]*)\s*</g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const text = normalizeText(match[1]);
    if (text.length >= 2) {
      matches.push(text);
    }
  }

  return matches;
}

function extractAttributes(source, attributeName) {
  const values = [];
  const regex = new RegExp(`${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|{\\s*['"\`]([^'"\`]+)['"\`]\\s*})`, 'g');
  let match;

  while ((match = regex.exec(source)) !== null) {
    values.push(normalizeText(match[1] || match[2] || match[3] || ''));
  }

  return values.filter(Boolean);
}

function extractTagText(source, tagName) {
  const values = [];
  const regex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  let match;

  while ((match = regex.exec(source)) !== null) {
    const text = normalizeText(match[1].replace(/<[^>]+>/g, ' '));
    if (text) {
      values.push(text);
    }
  }

  return values;
}

function extractClassTokens(classValues) {
  return unique(classValues.flatMap((value) => value.split(/\s+/).map((token) => token.trim())));
}

function countPattern(source, regex) {
  return (source.match(regex) || []).length;
}

function readFileModel(filePath, root) {
  const source = fs.readFileSync(filePath, 'utf8');
  const cleanSource = stripCodeNoise(source);
  const relativePath = path.relative(root, filePath);
  const classValues = [
    ...extractAttributes(source, 'class'),
    ...extractAttributes(source, 'className')
  ];
  const buttons = [
    ...extractTagText(source, 'button'),
    ...extractAttributes(source, 'aria-label').filter((label) => /button|btn|cta|enviar|salvar|gerar|criar|continuar/i.test(label)),
    ...extractAttributes(source, 'title').filter((label) => /enviar|salvar|gerar|criar|continuar/i.test(label))
  ];
  const headings = ['h1', 'h2', 'h3', 'h4'].flatMap((tag) =>
    extractTagText(source, tag).map((text) => ({ level: Number(tag.slice(1)), text }))
  );
  const inputLabels = [
    ...extractTagText(source, 'label'),
    ...extractAttributes(source, 'aria-label'),
    ...extractAttributes(source, 'placeholder')
  ];
  const imagesWithoutAlt = countPattern(source, /<img\b(?![^>]*\balt=)[^>]*>/gi);
  const iconOnlyButtons = countPattern(source, /<button\b[^>]*>\s*(?:<[^>]+>\s*){1,3}<\/button>/gi);

  return {
    path: relativePath,
    source,
    text: unique([
      ...extractJsxText(cleanSource),
      ...extractStringLiterals(cleanSource),
      ...extractAttributes(source, 'placeholder'),
      ...extractAttributes(source, 'aria-label')
    ]),
    headings,
    buttons: unique(buttons),
    labels: unique(inputLabels),
    placeholders: unique(extractAttributes(source, 'placeholder')),
    classValues,
    classTokens: extractClassTokens(classValues),
    counts: {
      buttons: countPattern(source, /<button\b/gi),
      links: countPattern(source, /<a\b/gi),
      inputs: countPattern(source, /<(input|textarea|select)\b/gi),
      cards: countPattern(source, /card|rounded|shadow|border|panel/gi),
      conditionals: countPattern(source, /\?\s*[\(<]|&&\s*[\(<]/g),
      imagesWithoutAlt,
      iconOnlyButtons
    }
  };
}

function extractInterfaceModel(files, root) {
  const fileModels = files.map((filePath) => readFileModel(filePath, root));
  const allText = unique(fileModels.flatMap((file) => file.text));
  const allButtons = unique(fileModels.flatMap((file) => file.buttons));
  const allHeadings = fileModels.flatMap((file) => file.headings.map((heading) => ({ ...heading, file: file.path })));
  const allClassTokens = unique(fileModels.flatMap((file) => file.classTokens));

  return {
    root,
    files: fileModels,
    text: allText,
    buttons: allButtons,
    headings: allHeadings,
    classTokens: allClassTokens,
    counts: fileModels.reduce(
      (total, file) => {
        for (const [key, value] of Object.entries(file.counts)) {
          total[key] = (total[key] || 0) + value;
        }
        return total;
      },
      {}
    )
  };
}

module.exports = {
  collectTargets,
  extractInterfaceModel
};

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const analyticsHandler = require('../apiHandlers/analytics');

const { ALLOWED_EVENTS, sanitizeMetadata } = analyticsHandler;
const APP_JSX = path.join(__dirname, '..', '..', 'frontend', 'src', 'App.jsx');

// Lê os nomes de evento disparados pelo frontend. Nome dinâmico (a variável
// eventName do onboarding) não aparece aqui e é conferido à parte.
function readFrontendEventNames() {
  const source = fs.readFileSync(APP_JSX, 'utf8');
  const names = new Set();
  const pattern = /trackEvent\(\s*'([a-z0-9_]+)'/g;
  let match = pattern.exec(source);

  while (match) {
    names.add(match[1]);
    match = pattern.exec(source);
  }

  return names;
}

// Este é o teste que importa: o frontend engole o 400, então um evento fora da
// allowlist some sem erro visível e a métrica simplesmente nunca existe. Foi
// assim que cartas, hipóteses e onboarding ficaram invisíveis.
test('todo evento disparado pelo frontend é aceito pelo backend', () => {
  const emitidos = readFrontendEventNames();

  assert.ok(emitidos.size > 0, 'não consegui ler os eventos do App.jsx');

  const recusados = [...emitidos].filter((name) => !ALLOWED_EVENTS.has(name));

  assert.deepEqual(
    recusados,
    [],
    `eventos que o frontend dispara e o backend descartaria: ${recusados.join(', ')}`,
  );
});

// markWelcomeOnboardingSeen passa o nome por variável, então o regex acima não
// pega — ficam travados explicitamente.
test('os eventos de onboarding com nome dinâmico estão na allowlist', () => {
  for (const name of ['onboarding_fechado', 'onboarding_cta_click']) {
    assert.ok(ALLOWED_EVENTS.has(name), `${name} deveria ser aceito`);
  }
});

test('evento desconhecido continua sendo recusado', () => {
  assert.equal(ALLOWED_EVENTS.has('evento_que_nao_existe'), false);
});

test('sanitizeMetadata preserva as chaves de métrica que o frontend envia', () => {
  const resultado = sanitizeMetadata({
    letter_type: 'laudo',
    used_custom_model: true,
    hypothesis_count: 3,
    plan_key: 'monthly',
    is_trial: false,
    slug: 'fluidoterapia-pediatrica-manutencao',
    origin: 'hipotese',
  });

  assert.deepEqual(resultado, {
    letter_type: 'laudo',
    used_custom_model: true,
    hypothesis_count: 3,
    plan_key: 'monthly',
    is_trial: false,
    slug: 'fluidoterapia-pediatrica-manutencao',
    origin: 'hipotese',
  });
});

// Fronteira de privacidade: o nome da hipótese é gerado a partir da anamnese do
// paciente. Fica fora de propósito — has_exact_guide já dá o sinal útil.
test('sanitizeMetadata descarta o nome da hipótese e qualquer chave não listada', () => {
  const resultado = sanitizeMetadata({
    hypothesis: 'Pneumonia adquirida na comunidade',
    has_exact_guide: true,
    texto_da_anamnese: 'paciente relata...',
  });

  assert.deepEqual(resultado, { has_exact_guide: true });
});

test('sanitizeMetadata devolve null quando nada sobrevive', () => {
  assert.equal(sanitizeMetadata({ campo_qualquer: 'x' }), null);
  assert.equal(sanitizeMetadata(null), null);
  assert.equal(sanitizeMetadata([1, 2]), null);
});

test('sanitizeMetadata trunca string longa em 120 caracteres', () => {
  const resultado = sanitizeMetadata({ template: 'x'.repeat(500) });
  assert.equal(resultado.template.length, 120);
});

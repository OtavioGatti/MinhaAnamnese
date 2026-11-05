const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Dicas contextuais do frontend (ESM puro), testadas daqui porque o frontend
// não tem suíte própria.
const MODULO = pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'productTips.js')).href;

const contextoHomeVazia = {
  page: 'home',
  textoVazio: true,
  textoLength: 0,
  textoTemArroba: false,
  resultado: false,
  hypothesesCount: 0,
  canRunAnalysis: false,
  linkedToolsCount: 0,
  anamnesesCount: 0,
  templateTemCalculadora: false,
  drugMentionsEnabled: true,
};

test('?dicas=1 liga só neste navegador e ignora as já vistas; ?dicas=0 desliga', async () => {
  const { resolveProductTipsEnabled } = await import(MODULO);

  assert.deepEqual(resolveProductTipsEnabled({ flag: '', search: '' }), { enabled: false, preview: false, stored: null });
  assert.deepEqual(resolveProductTipsEnabled({ flag: 'on', search: '' }), { enabled: true, preview: false, stored: null });
  assert.deepEqual(resolveProductTipsEnabled({ flag: '', search: '?dicas=1' }), { enabled: true, preview: true, stored: '1' });
  assert.deepEqual(resolveProductTipsEnabled({ flag: '', search: '', stored: '1' }), { enabled: true, preview: true, stored: '1' });
  assert.deepEqual(resolveProductTipsEnabled({ flag: '', search: '?dicas=0', stored: '1' }), { enabled: false, preview: false, stored: null });
});

test('na home vazia a primeira dica é frases prontas; vista, passa adiante', async () => {
  const { pickNextTip } = await import(MODULO);

  assert.equal(pickNextTip({ context: contextoHomeVazia })?.id, 'frases_prontas');
  assert.equal(pickNextTip({ context: contextoHomeVazia, seen: ['frases_prontas'] }), null);
  assert.equal(
    pickNextTip({ context: { ...contextoHomeVazia, anamnesesCount: 2 }, seen: ['frases_prontas'] })?.id,
    'meus_modelos',
  );
});

test('quem já usou a função não recebe a dica dela', async () => {
  const { pickNextTip } = await import(MODULO);
  const contexto = { ...contextoHomeVazia, textoVazio: false, textoLength: 10, resultado: true };

  assert.equal(pickNextTip({ context: contexto })?.id, 'hipoteses');
  assert.equal(pickNextTip({ context: contexto, usedFeatures: { diagnosticHypotheses: 2 } }), null);
});

test('o @ só é sugerido com texto longo, sem menção e com o bulário em linha ligado', async () => {
  const { pickNextTip } = await import(MODULO);
  const base = { ...contextoHomeVazia, textoVazio: false, textoLength: 250 };

  assert.equal(pickNextTip({ context: base })?.id, 'arroba');
  assert.equal(pickNextTip({ context: { ...base, textoTemArroba: true } }), null);
  assert.equal(pickNextTip({ context: { ...base, drugMentionsEnabled: false } }), null);
  assert.equal(pickNextTip({ context: { ...base, textoLength: 50 } }), null);
});

test('dica sem alvo na tela é pulada e nada aparece fora da home', async () => {
  const { pickNextTip } = await import(MODULO);

  assert.equal(pickNextTip({ context: contextoHomeVazia, isTargetPresent: () => false }), null);
  assert.equal(pickNextTip({ context: { ...contextoHomeVazia, page: 'templates', anamnesesCount: 5 } }), null);
});

test('ids das dicas são curtos e únicos, como o perfil exige', async () => {
  const { PRODUCT_TIP_IDS, PRODUCT_TIPS } = await import(MODULO);

  assert.equal(PRODUCT_TIPS.length, 11);
  assert.equal(new Set(PRODUCT_TIP_IDS).size, PRODUCT_TIP_IDS.length);
  for (const id of PRODUCT_TIP_IDS) {
    assert.match(id, /^[a-z0-9_]{1,40}$/);
  }
});

test('countDrugMentions conta só menções @ de medicamento', async () => {
  const { countDrugMentions } = await import(MODULO);

  assert.equal(countDrugMentions('em uso de @losartana e @metformina-xr'), 2);
  assert.equal(countDrugMentions('email a@b.com'), 0);
  assert.equal(countDrugMentions(''), 0);
});

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const servidor = require('../utils/phone');

// O formulário (frontend, ESM) e o servidor validam o celular com a mesma
// regra. Os mesmos casos passam pelos dois: se divergirem, o site aceitaria um
// número que o servidor recusa (ou o contrário).
const MODULO = pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'phone.js')).href;

const CASOS = [
  ['(11) 98765-4321', '11987654321'],
  ['11987654321', '11987654321'],
  ['+55 11 98765-4321', '11987654321'],
  ['5511987654321', '11987654321'],
  ['(21)99876-5432', '21998765432'],
  [11987654321, '11987654321'],
  // fixo (8 dígitos depois do DDD)
  ['(11) 3456-7890', null],
  // celular sem o 9
  ['(11) 88765-4321', null],
  // DDD que não existe
  ['(10) 98765-4321', null],
  ['(20) 98765-4321', null],
  // repetido
  ['(11) 99999-9999', null],
  ['(11) 90000-0000', null],
  // tamanho errado
  ['1198765432', null],
  ['119876543210', null],
  ['', null],
  [null, null],
  [undefined, null],
  [{}, null],
];

test('celular: servidor e site aceitam e recusam exatamente os mesmos números', async () => {
  const site = await import(MODULO);

  for (const [entrada, esperado] of CASOS) {
    assert.equal(servidor.normalizeBrazilianMobile(entrada), esperado, `servidor: ${String(entrada)}`);
    assert.equal(site.normalizeBrazilianMobile(entrada), esperado, `site: ${String(entrada)}`);
  }
});

test('celular: as duas listas de DDD são iguais', async () => {
  const site = await import(MODULO);
  const aceitosNoSite = [];

  for (let ddd = 10; ddd <= 99; ddd += 1) {
    if (site.normalizeBrazilianMobile(`${ddd}987654321`)) {
      aceitosNoSite.push(ddd);
    }
  }

  assert.deepEqual(aceitosNoSite, [...servidor.VALID_DDDS].sort((a, b) => a - b));
});

test('máscara do campo acompanha a digitação e descarta +55 colado', async () => {
  const { formatBrazilianMobileInput } = await import(MODULO);

  assert.equal(formatBrazilianMobileInput(''), '');
  assert.equal(formatBrazilianMobileInput('1'), '(1');
  assert.equal(formatBrazilianMobileInput('11'), '(11');
  assert.equal(formatBrazilianMobileInput('1198'), '(11) 98');
  assert.equal(formatBrazilianMobileInput('1198765'), '(11) 98765');
  assert.equal(formatBrazilianMobileInput('11987654321'), '(11) 98765-4321');
  assert.equal(formatBrazilianMobileInput('119876543219999'), '(11) 98765-4321');
  assert.equal(formatBrazilianMobileInput('+55 (11) 98765-4321'), '(11) 98765-4321');
});

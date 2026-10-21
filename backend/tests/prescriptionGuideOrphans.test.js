const assert = require('node:assert/strict');
const test = require('node:test');
const { findOrphanGuides } = require('../services/notionPrescriptionGuideSync');

// Caso real de 21/10/2026: páginas refeitas com outro slug em maio deixaram a
// linha antiga publicada no site, sem página no Notion para editar.
test('linha publicada sem página no Notion é órfã; as que vieram do Notion ficam', () => {
  const banco = [
    { slug: 'pneumonia-adquirida-na-comunidade-adulto', title: 'PAC antiga' },
    { slug: 'pneumonia-adquirida-comunidade-pac-adulto', title: 'PAC' },
    { slug: 'otite-aguda', title: 'OTITE AGUDA' },
  ];

  assert.deepEqual(
    findOrphanGuides(banco, ['pneumonia-adquirida-comunidade-pac-adulto']).map((row) => row.slug),
    ['pneumonia-adquirida-na-comunidade-adulto', 'otite-aguda'],
  );
});

// Campo mal preenchido no CMS não pode tirar o protocolo do ar.
test('página que falhou na validação não conta como sumida', () => {
  const banco = [{ slug: 'asma-adulto' }, { slug: 'dengue-adulto' }];

  assert.deepEqual(findOrphanGuides(banco, ['asma-adulto', 'dengue-adulto', null]), []);
  assert.deepEqual(findOrphanGuides(null, ['asma-adulto']), []);
});

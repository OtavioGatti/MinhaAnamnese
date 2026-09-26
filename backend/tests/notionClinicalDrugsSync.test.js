const assert = require('node:assert/strict');
const test = require('node:test');
const { mapNotionPageToClinicalDrug } = require('../services/notionClinicalDrugsSync');

function buildPage({ activeIngredient = 'Amoxicilina', publicationStatus } = {}) {
  const properties = {
    'Princípio Ativo': { title: [{ plain_text: activeIngredient, text: { content: activeIngredient } }] },
  };

  if (publicationStatus !== undefined) {
    properties['Status Publicação'] = { type: 'select', select: { name: publicationStatus } };
  }

  return { id: 'page-id', properties };
}

function mapDrug(options) {
  const mapped = mapNotionPageToClinicalDrug(buildPage(options));
  assert.equal(mapped.error, null, `mapeamento falhou: ${JSON.stringify(mapped.error)}`);
  return mapped.payload;
}

test('publication_status é PUBLICADO por padrão quando a propriedade não existe (caso real hoje)', () => {
  assert.equal(mapDrug({}).publication_status, 'published'); // sem 'Status Publicação' nas properties
});

test('publication_status é PUBLICADO por padrão quando a propriedade está vazia', () => {
  assert.equal(mapDrug({ publicationStatus: '' }).publication_status, 'published');
});

test('publication_status vira draft só quando explicitamente "Draft"/"Rascunho"', () => {
  assert.equal(mapDrug({ publicationStatus: 'Draft' }).publication_status, 'draft');
  assert.equal(mapDrug({ publicationStatus: 'Rascunho' }).publication_status, 'draft');
});

test('publication_status vira archived quando explicitamente "Archived"/"Arquivado"', () => {
  assert.equal(mapDrug({ publicationStatus: 'Archived' }).publication_status, 'archived');
  assert.equal(mapDrug({ publicationStatus: 'Arquivado' }).publication_status, 'archived');
});

test('publication_status continua published quando explicitamente "Publicado"', () => {
  assert.equal(mapDrug({ publicationStatus: 'Publicado' }).publication_status, 'published');
});

// --- bula completa (monograph) e gestação --------------------------------

function richText(value) {
  return { type: 'rich_text', rich_text: [{ plain_text: value, text: { content: value } }] };
}

function mapWithProperties(extra) {
  const page = buildPage({ activeIngredient: 'Ácido Acetilsalicílico' });
  Object.assign(page.properties, extra);
  const mapped = mapNotionPageToClinicalDrug(page);
  assert.equal(mapped.error, null);
  return mapped.payload;
}

// Bug real: o Notion usa opções compostas e o sync só aceitava a letra exata,
// então "C; D no 3º trimestre" virava null e o AAS aparecia sem gestação.
test('risco gestacional composto guarda a letra e o texto completo', () => {
  const drug = mapWithProperties({
    'Risco Gestacional': { type: 'select', select: { name: 'C; D no 3º trimestre' } },
  });

  assert.equal(drug.pregnancy_risk, 'C');
  assert.equal(drug.monograph.pregnancyRiskLabel, 'C; D no 3º trimestre');
});

test('risco gestacional sem letra inicial não inventa categoria', () => {
  const semLetra = mapWithProperties({
    'Risco Gestacional': { type: 'select', select: { name: 'Uso obstétrico específico em ameaça de parto prematuro' } },
  });
  const indefinido = mapWithProperties({
    'Risco Gestacional': { type: 'select', select: { name: 'Indefinido; não recomendado na gestação' } },
  });
  const naoSeAplica = mapWithProperties({
    'Risco Gestacional': { type: 'select', select: { name: 'Não se aplica' } },
  });

  assert.equal(semLetra.pregnancy_risk, null);
  assert.equal(indefinido.pregnancy_risk, 'Indefinido');
  assert.equal(naoSeAplica.pregnancy_risk, null, '"Não" começa com N, não pode virar categoria');
  assert.equal(semLetra.monograph.pregnancyRiskLabel, 'Uso obstétrico específico em ameaça de parto prematuro');
});

test('monograph reúne as seções novas e ignora as vazias', () => {
  const drug = mapWithProperties({
    'Indicações': richText('Dor leve a moderada\nFebre'),
    'Ajuste Renal': richText('ClCr < 10: evitar.'),
    'Lactação': richText(''),
    'Referências': richText('FDA label'),
    'Rede SUS (RENAME)': { type: 'checkbox', checkbox: true },
    'Tipo de Receituário': { type: 'select', select: { name: 'Receita simples' } },
    'Status Revisão Clínica': { type: 'select', select: { name: 'Rascunho com fontes — aguardando revisão médica' } },
    'Data da Revisão': { type: 'date', date: { start: '2026-09-25' } },
    'Classes Farmacológicas': { type: 'multi_select', multi_select: [{ name: 'AINE' }, { name: 'Antiagregante plaquetário' }] },
  });

  assert.deepEqual(drug.monograph, {
    indications: 'Dor leve a moderada\nFebre',
    renalAdjustment: 'ClCr < 10: evitar.',
    references: 'FDA label',
    prescriptionType: 'Receita simples',
    clinicalReviewStatus: 'Rascunho com fontes — aguardando revisão médica',
    reviewedAt: '2026-09-25',
    pharmacologicClasses: ['AINE', 'Antiagregante plaquetário'],
    susAvailable: true,
  });
});

test('medicamento antigo sem nenhum campo novo gera monograph vazio', () => {
  assert.deepEqual(mapDrug({}).monograph, {});
});

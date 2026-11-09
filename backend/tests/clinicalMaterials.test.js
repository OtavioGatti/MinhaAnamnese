const assert = require('node:assert/strict');
const test = require('node:test');

const { canAccessMaterial, isFreeMaterialType } = require('../config/materialsAccess');
const {
  mapMaterialRow,
  materialMatchesQuery,
  buildMaterialSearchTerms,
  normalizeMaterialType,
  isSafeExternalUrl,
} = require('../services/clinicalMaterials');
const {
  findOrphanPageIds,
  isPdfBuffer,
  mapNotionPageToMaterial,
  needsFileCopy,
} = require('../services/notionMaterialsSync');
const { apiRoutes } = require('../apiHandlers');
const materialsHandler = require('../apiHandlers/materials');

const text = (value) => ({ rich_text: [{ plain_text: value }] });

function notionPage(overrides = {}) {
  return {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    last_edited_time: '2026-11-09T21:00:00.000Z',
    properties: {
      'Título': { title: [{ plain_text: 'Controle da pressão arterial em casa' }] },
      Slug: text('controle-pressao-arterial'),
      Categoria: { type: 'select', select: { name: 'Cardiologia' } },
      'Descrição': text('Tabela para anotar a pressão em casa.'),
      Tipo: { type: 'select', select: { name: 'Material próprio' } },
      'Crédito': text(''),
      Arquivo: { files: [{ name: 'pressao.pdf', type: 'file', file: { url: 'https://files.notion.example/pressao.pdf' } }] },
      'Link oficial': { type: 'url', url: null },
      'Status Publicação': { type: 'select', select: { name: 'published' } },
      Ordem: { type: 'number', number: 10 },
      ...overrides,
    },
  };
}

// A regra é receita: só o material próprio sai sem assinatura.
test('material próprio é livre; escala e link oficial exigem o plano profissional', () => {
  assert.equal(isFreeMaterialType('proprio'), true);
  assert.equal(canAccessMaterial({ hasProAccess: false, materialType: 'proprio' }), true);
  assert.equal(canAccessMaterial({ hasProAccess: false, materialType: 'escala_livre' }), false);
  assert.equal(canAccessMaterial({ hasProAccess: false, materialType: 'link_oficial' }), false);
  assert.equal(canAccessMaterial({ hasProAccess: true, materialType: 'escala_livre' }), true);
  assert.equal(canAccessMaterial({ hasProAccess: true, materialType: 'link_oficial' }), true);
  // Tipo que não existe nunca é tratado como gratuito.
  assert.equal(canAccessMaterial({ hasProAccess: false, materialType: 'qualquer' }), false);
  assert.equal(canAccessMaterial({ hasProAccess: false }), false);
});

test('item bloqueado aparece no catálogo sem o link oficial', () => {
  const row = {
    slug: 'moca',
    title: 'MoCA',
    material_type: 'link_oficial',
    external_url: 'https://mocacognition.com/',
    status: 'published',
  };

  const semPro = mapMaterialRow(row, { hasProAccess: false });
  assert.equal(semPro.locked, true);
  assert.equal(semPro.externalUrl, '');

  const comPro = mapMaterialRow(row, { hasProAccess: true });
  assert.equal(comPro.locked, false);
  assert.equal(comPro.externalUrl, 'https://mocacognition.com/');
});

test('a tela nunca recebe o caminho do arquivo no Storage', () => {
  const item = mapMaterialRow({
    slug: 'controle-glicemia',
    title: 'Controle da glicemia',
    material_type: 'proprio',
    storage_path: 'controle-glicemia.pdf',
    file_size: 61000,
  }, { hasProAccess: false });

  assert.equal(item.locked, false);
  assert.equal(item.hasFile, true);
  assert.equal(item.fileSize, 61000);
  assert.equal('storage_path' in item, false);
  assert.equal(JSON.stringify(item).includes('controle-glicemia.pdf'), false);
});

test('linha com tipo desconhecido não é exibida', () => {
  assert.equal(mapMaterialRow({ slug: 'x', title: 'X', material_type: 'outro' }), null);
});

test('a busca ignora acento e maiúsculas dos dois lados', () => {
  const row = { title: 'Controle da pressão arterial', category: 'Cardiologia', description: 'Diário de Fagerström' };
  row.search_terms = buildMaterialSearchTerms(row);

  assert.equal(materialMatchesQuery(row, 'pressao'), true);
  assert.equal(materialMatchesQuery(row, 'PRESSÃO arterial'), true);
  assert.equal(materialMatchesQuery(row, 'fagerstrom'), true);
  assert.equal(materialMatchesQuery(row, 'glicemia'), false);
  assert.equal(materialMatchesQuery(row, ''), true);
});

test('tipos do Notion viram os tipos internos; desconhecido fica vazio', () => {
  assert.equal(normalizeMaterialType('Material próprio'), 'proprio');
  assert.equal(normalizeMaterialType('Escala livre'), 'escala_livre');
  assert.equal(normalizeMaterialType('Link oficial'), 'link_oficial');
  assert.equal(normalizeMaterialType('Outra coisa'), '');
});

test('link oficial só é aceito com https', () => {
  assert.equal(isSafeExternalUrl('https://mocacognition.com/'), true);
  assert.equal(isSafeExternalUrl('http://exemplo.com'), false);
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false);
  assert.equal(isSafeExternalUrl(''), false);
});

test('página publicada com PDF vira linha pronta para gravar', () => {
  const { payload, file, error } = mapNotionPageToMaterial(notionPage());

  assert.equal(error, null);
  assert.equal(payload.slug, 'controle-pressao-arterial');
  assert.equal(payload.material_type, 'proprio');
  assert.equal(payload.status, 'published');
  assert.equal(payload.category, 'Cardiologia');
  assert.equal(payload.display_order, 10);
  assert.equal(payload.external_url, null);
  assert.ok(payload.search_terms.includes('pressao'));
  assert.equal(file.url, 'https://files.notion.example/pressao.pdf');
});

test('publicação é recusada sem PDF, com tipo desconhecido ou escala sem crédito', () => {
  const semPdf = mapNotionPageToMaterial(notionPage({ Arquivo: { files: [] } }));
  assert.equal(semPdf.payload, null);
  assert.ok(semPdf.error.reasons.includes('PDF não anexado'));

  const tipoErrado = mapNotionPageToMaterial(notionPage({ Tipo: { type: 'select', select: { name: 'Grátis' } } }));
  assert.equal(tipoErrado.payload, null);
  assert.ok(tipoErrado.error.reasons.some((reason) => reason.startsWith('tipo desconhecido')));

  const escalaSemCredito = mapNotionPageToMaterial(notionPage({ Tipo: { type: 'select', select: { name: 'Escala livre' } } }));
  assert.equal(escalaSemCredito.payload, null);
  assert.ok(escalaSemCredito.error.reasons.includes('escala livre sem crédito'));
});

test('link oficial exige endereço https e não copia arquivo', () => {
  const semLink = mapNotionPageToMaterial(notionPage({ Tipo: { type: 'select', select: { name: 'Link oficial' } } }));
  assert.equal(semLink.payload, null);

  const comLink = mapNotionPageToMaterial(notionPage({
    Tipo: { type: 'select', select: { name: 'Link oficial' } },
    'Link oficial': { type: 'url', url: 'https://mocacognition.com/' },
  }));
  assert.equal(comLink.error, null);
  assert.equal(comLink.payload.external_url, 'https://mocacognition.com/');
  assert.equal(comLink.file, null);
});

test('rascunho é gravado mesmo sem PDF', () => {
  const rascunho = mapNotionPageToMaterial(notionPage({
    Arquivo: { files: [] },
    'Status Publicação': { type: 'select', select: { name: 'draft' } },
  }));

  assert.equal(rascunho.error, null);
  assert.equal(rascunho.payload.status, 'draft');
});

test('o PDF só é copiado de novo quando a página mudou no Notion', () => {
  const payload = { slug: 'controle-glicemia', source_updated_at: '2026-11-09T21:00:00.000Z' };

  assert.equal(needsFileCopy(null, payload), true);
  assert.equal(needsFileCopy({ storage_path: null }, payload), true);
  // O banco devolve a mesma data em outro formato de texto.
  assert.equal(needsFileCopy({ storage_path: 'controle-glicemia.pdf', source_updated_at: '2026-11-09T21:00:00+00:00' }, payload), false);
  assert.equal(needsFileCopy({ storage_path: 'controle-glicemia.pdf', source_updated_at: '2026-11-08T10:00:00+00:00' }, payload), true);
  assert.equal(needsFileCopy({ storage_path: 'nome-antigo.pdf', source_updated_at: '2026-11-09T21:00:00+00:00' }, payload), true);
});

test('linha sem página no Notion é órfã; arquivada ou viva fica de fora', () => {
  const existentes = [
    { notion_page_id: 'aaaa-1', status: 'published' },
    { notion_page_id: 'bbbb-2', status: 'published' },
    { notion_page_id: 'cccc-3', status: 'archived' },
  ];

  assert.deepEqual(findOrphanPageIds(existentes, ['aaaa1']), ['bbbb-2']);
});

test('só PDF de verdade é aceito', () => {
  assert.equal(isPdfBuffer(Buffer.from('%PDF-1.7 resto')), true);
  assert.equal(isPdfBuffer(Buffer.from('<html>erro</html>')), false);
  assert.equal(isPdfBuffer(Buffer.alloc(0)), false);
});

test('rotas de materiais registradas e download reconhecido pelo caminho', () => {
  assert.equal(typeof apiRoutes['/api/materials'], 'function');
  assert.equal(apiRoutes['/api/materials/download'], apiRoutes['/api/materials']);
  assert.equal(typeof apiRoutes['/api/admin/materials/sync'], 'function');
  assert.equal(materialsHandler.isDownloadRequest({ url: '/api/materials/download?slug=x' }), true);
  assert.equal(materialsHandler.isDownloadRequest({ url: '/api/materials?q=download' }), false);
  assert.equal(materialsHandler.buildDownloadFileName({ slug: 'a', file_name: 'meu arquivo (1).pdf' }), 'meu-arquivo-1-.pdf');
});

test('sem conta a lista de materiais devolve 401', async () => {
  let statusCode = 0;
  let body = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };

  await materialsHandler({ method: 'GET', url: '/api/materials', headers: {} }, res);

  assert.equal(statusCode, 401);
  assert.equal(body.success, false);
});

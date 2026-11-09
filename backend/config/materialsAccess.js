// Fronteira comercial da aba Materiais.
//
// Fica no código, e não no Notion, pelo mesmo motivo de freeClinicalTools.js:
// o CMS informa o TIPO do arquivo (conteúdo), mas quem decide quem baixa é este
// arquivo. Mudar o que é gratuito aparece no diff e no PR.
//
// Todo acesso exige conta (o handler devolve 401 sem token); o que varia é a
// exigência de assinatura.

const MATERIAL_TYPES = ['proprio', 'escala_livre', 'link_oficial'];

// Material próprio (tabelas de controle e diários com a nossa marca) é livre
// para qualquer conta. Escalas hospedadas e links oficiais ficam no plano
// profissional.
const FREE_MATERIAL_TYPES = ['proprio'];

const FREE_TYPE_SET = new Set(FREE_MATERIAL_TYPES);

function isFreeMaterialType(type) {
  return FREE_TYPE_SET.has(String(type || '').trim().toLowerCase());
}

function canAccessMaterial({ hasProAccess, materialType } = {}) {
  return Boolean(hasProAccess) || isFreeMaterialType(materialType);
}

module.exports = {
  FREE_MATERIAL_TYPES,
  MATERIAL_TYPES,
  canAccessMaterial,
  isFreeMaterialType,
};

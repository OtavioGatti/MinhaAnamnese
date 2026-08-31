// Ferramentas Clínicas liberadas fora do plano profissional.
//
// Fica no código, e não como campo no Notion, de propósito: isto é fronteira
// comercial, não conteúdo. Um checkbox no CMS deixaria qualquer edição
// editorial liberar conteúdo pago sem passar por revisão — inclusive por
// engano. Aqui a mudança aparece no diff e no PR.
//
// O acesso continua exigindo conta (o handler segue devolvendo 401 sem token);
// o que cai é só a exigência de assinatura.

const FREE_CLINICAL_TOOL_SLUGS = [
  // Divulgação aberta: calculadora de fluidoterapia pediátrica.
  'fluidoterapia-pediatrica-manutencao',
];

const FREE_SLUG_SET = new Set(FREE_CLINICAL_TOOL_SLUGS);

function normalizeSlugForComparison(value) {
  return String(value || '').trim().toLowerCase();
}

function isFreeClinicalToolSlug(slug) {
  return FREE_SLUG_SET.has(normalizeSlugForComparison(slug));
}

/**
 * Decide o que uma requisição pode ver, dado o plano e o que ela pediu.
 * Exportado para dar teste ao corte sem precisar simular sessão — é receita
 * que está em jogo, então a regra tem de ficar travada por teste.
 *
 * @returns {{ mode: 'full' | 'denied' | 'slugs', slugs?: string[] }}
 *  - full   → segue o fluxo normal (assinante)
 *  - denied → 402, nada do que foi pedido é gratuito
 *  - slugs  → responder apenas com estes slugs
 */
function resolveClinicalToolsAccess({ hasProAccess, slug, slugs } = {}) {
  if (hasProAccess) {
    return { mode: 'full' };
  }

  if (Array.isArray(slugs) && slugs.length > 0) {
    const allowed = slugs.filter(isFreeClinicalToolSlug);
    return allowed.length > 0 ? { mode: 'slugs', slugs: allowed } : { mode: 'denied' };
  }

  if (slug) {
    return isFreeClinicalToolSlug(slug) ? { mode: 'slugs', slugs: [slug] } : { mode: 'denied' };
  }

  // Listagem sem Pro: só as liberadas.
  return { mode: 'slugs', slugs: [...FREE_CLINICAL_TOOL_SLUGS] };
}

module.exports = {
  FREE_CLINICAL_TOOL_SLUGS,
  isFreeClinicalToolSlug,
  normalizeSlugForComparison,
  resolveClinicalToolsAccess,
};

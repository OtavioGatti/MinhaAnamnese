// Painel de métricas do dono. Somente leitura.
//
// Duas formas de autenticar, ambas já usadas no projeto:
//  - bearer ADMIN_SYNC_SECRET, para chamar de script/n8n;
//  - link assinado (?exp=&sig=), para abrir no navegador sem colar o segredo
//    na URL — mesmo padrão do link de baixa de repasse.
//
// `?format=html` devolve a página; o padrão é JSON.

const { getOwnerMetrics } = require('../../services/ownerMetrics');
const { isAuthorizedAdminRequest, hasAdminSecretConfigured } = require('../../utils/adminAuth');
const { verifyOwnerMetricsToken } = require('../../utils/ownerMetricsToken');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const RATE_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 };

function getQueryParam(req, name) {
  if (typeof req.query?.[name] === 'string') {
    return req.query[name];
  }

  const url = new URL(req.url || '/api/admin/metrics', 'http://localhost');
  return url.searchParams.get(name) || '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(value) {
  return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
}

function tile(label, value, hint = '') {
  return `<div class="tile"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${
    hint ? `<small>${escapeHtml(hint)}</small>` : ''
  }</div>`;
}

function renderHtml(m) {
  // Alcance vem primeiro de propósito: é a leitura que não depende da ordem
  // declarada do funil, e portanto a que não mente quando o uso real diverge.
  const alcance = (m.alcance?.etapas || [])
    .map((etapa) => `<tr><td>${escapeHtml(etapa.nome)}</td><td class="num">${etapa.sessoes}</td><td class="num">${etapa.percentual}%</td></tr>`)
    .join('');

  const funil = (m.funil?.etapas || [])
    .map((etapa) => `<tr><td>${escapeHtml(etapa.nome)}</td><td class="num">${etapa.total}</td><td class="num">${etapa.taxa_conversao}%</td></tr>`)
    .join('');

  const eventos = m.eventos
    .map((e) => `<tr><td>${escapeHtml(e.evento)}</td><td class="num">${e.total}</td><td class="num">${e.usuarios}</td><td>${escapeHtml(e.ultimo || '-')}</td></tr>`)
    .join('');

  const afiliados = m.afiliados
    .map((a) => `<tr>
      <td>${escapeHtml(a.codigo)}</td>
      <td class="num">${a.visitas}</td>
      <td class="num">${a.checkoutsIniciados}</td>
      <td class="num">${a.compradoresDistintos}</td>
      <td class="num">${a.conversoes}</td>
      <td class="num">${a.taxaVisitaParaPago == null ? '<span class="muted">sem dado</span>' : `${a.taxaVisitaParaPago}%`}</td>
      <td class="num">${a.taxaCheckoutParaPago == null ? '<span class="muted">sem dado</span>' : `${a.taxaCheckoutParaPago}%`}</td>
      <td class="num">${money(a.receitaGerada)}</td>
    </tr>`)
    .join('') || '<tr><td colspan="8" class="muted">Nenhum afiliado com movimento.</td></tr>';

  const avisos = m.avisos.map((a) => `<li>${escapeHtml(a)}</li>`).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>Métricas — Minha Anamnese</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #f1f5f9; color: #0f172a; margin: 0; padding: 16px; }
  .wrap { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 1.2rem; margin: 0 0 4px; }
  h2 { font-size: 1rem; margin: 24px 0 8px; }
  .card { background: #fff; border-radius: 14px; padding: 16px; box-shadow: 0 10px 24px rgba(15,23,42,0.06); margin-bottom: 16px; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
  .tile { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; display: grid; gap: 2px; }
  .tile span { font-size: 0.78rem; color: #64748b; }
  .tile strong { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
  .tile small { font-size: 0.72rem; color: #94a3b8; }
  table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  th, td { text-align: left; padding: 7px 6px; border-bottom: 1px solid #eef2f7; }
  th { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .muted { color: #94a3b8; }
  .avisos { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 12px 12px 12px 28px; margin: 0; font-size: 0.82rem; line-height: 1.5; }
  .scroll { overflow-x: auto; }
</style>
</head>
<body><div class="wrap">
  <div class="card">
    <h1>Métricas do site</h1>
    <p class="muted" style="margin:0;font-size:.8rem">Gerado em ${escapeHtml(new Date(m.geradoEm).toLocaleString('pt-BR'))}</p>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Contas e receita</h2>
    <div class="tiles">
      ${tile('Contas', m.contas.total)}
      ${tile('Iniciaram trial', m.contas.comTrial)}
      ${tile('Pro vigente', m.contas.proVigente)}
      ${tile('Afiliado cortesia', m.contas.afiliadoCortesia)}
      ${tile('Pagamentos aprovados', m.pagamentos.aprovados)}
      ${tile('Receita bruta', money(m.pagamentos.receitaBruta), m.pagamentos.reembolsados ? `${m.pagamentos.reembolsados} estorno(s)` : '')}
      ${tile('Compradores únicos', m.pagamentos.compradoresUnicos)}
      ${tile('Anamneses', m.anamneses.total, `${m.anamneses.usuariosDistintos} usuários`)}
    </div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Retenção</h2>
    <div class="tiles">
      ${tile('Com evento', m.retencao.usuariosComEvento)}
      ${tile('1 dia só', m.retencao.umDiaSo)}
      ${tile('2 a 3 dias', m.retencao.doisATresDias)}
      ${tile('4+ dias', m.retencao.quatroOuMais)}
      ${tile('Média de dias', m.retencao.mediaDiasAtivos)}
    </div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Alcance por etapa (${m.alcance.totalSessoes} sessões)</h2>
    <p class="muted" style="margin:0 0 8px;font-size:.8rem">Sessões que passaram por cada etapa, em qualquer ordem.</p>
    <div class="scroll"><table>
      <thead><tr><th>Etapa</th><th class="num">Sessões</th><th class="num">% das sessões</th></tr></thead>
      <tbody>${alcance || '<tr><td colspan="3" class="muted">Sem dados.</td></tr>'}</tbody>
    </table></div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Funil em sequência (${m.funil.total_sessoes} sessões)</h2>
    <p class="muted" style="margin:0 0 8px;font-size:.8rem">Só conta quem seguiu a ordem exata. Se divergir muito do alcance acima, a ordem declarada não reflete o uso real.</p>
    <div class="scroll"><table>
      <thead><tr><th>Etapa</th><th class="num">Sessões</th><th class="num">Conversão</th></tr></thead>
      <tbody>${funil || '<tr><td colspan="3" class="muted">Sem dados.</td></tr>'}</tbody>
    </table></div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Afiliados</h2>
    <p class="muted" style="margin:0 0 8px;font-size:.8rem">Visitas só passaram a ser medidas a partir da instrumentação do link — zero no histórico antigo é ausência de medição, não queda.</p>
    <div class="scroll"><table>
      <thead><tr><th>Código</th><th class="num">Visitas</th><th class="num">Checkouts</th><th class="num">Pessoas</th><th class="num">Pagos</th><th class="num">Visita→pago</th><th class="num">Checkout→pago</th><th class="num">Receita</th></tr></thead>
      <tbody>${afiliados}</tbody>
    </table></div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Uso por evento</h2>
    <div class="scroll"><table>
      <thead><tr><th>Evento</th><th class="num">Total</th><th class="num">Usuários</th><th>Último</th></tr></thead>
      <tbody>${eventos || '<tr><td colspan="4" class="muted">Sem eventos.</td></tr>'}</tbody>
    </table></div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Como ler estes números</h2>
    <ul class="avisos">${avisos}</ul>
  </div>
</div></body>
</html>`;
}

function isAuthorized(req) {
  if (isAuthorizedAdminRequest(req)) {
    return true;
  }

  return verifyOwnerMetricsToken({
    exp: getQueryParam(req, 'exp'),
    sig: getQueryParam(req, 'sig'),
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const rateLimit = await consumeRateLimit({ req, scope: 'owner_metrics', ...RATE_LIMIT });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!hasAdminSecretConfigured()) {
    return res.status(503).json({ success: false, error: 'Métricas não configuradas.' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Acesso não autorizado.' });
  }

  try {
    const metrics = await getOwnerMetrics();

    if (getQueryParam(req, 'format') === 'html') {
      res.status(200);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      // Painel é sempre ao vivo: cache aqui só serviria para mostrar número velho.
      res.setHeader('Cache-Control', 'no-store');
      return res.end(renderHtml(metrics));
    }

    return res.status(200).json({ success: true, data: metrics });
  } catch (error) {
    return res.status(error.statusCode || 503).json({
      success: false,
      error: 'Não foi possível carregar as métricas agora.',
    });
  }
};

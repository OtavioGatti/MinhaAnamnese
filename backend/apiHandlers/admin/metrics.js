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

// O painel é lido no Brasil, mas o servidor roda em UTC: sem o fuso explícito
// o "Gerado em" e as datas das barras saíam com 3 horas de diferença.
const FUSO = 'America/Sao_Paulo';

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

// Número, seta com a diferença e, embaixo, o valor comparado — empilhados para
// caber no celular:  322 / ▲ +296 / ontem 26 · +1.138%.
// Sem base anterior, "novo" em vez de uma porcentagem que não existe.
function changeCell(atual, anterior, variacao, rotuloAnterior) {
  const { delta, percentual, direcao } = variacao;
  const classe = direcao === 'sobe' ? 'up' : direcao === 'desce' ? 'down' : 'flat';
  const seta = direcao === 'sobe' ? '▲' : direcao === 'desce' ? '▼' : '=';
  const sinal = delta > 0 ? '+' : delta < 0 ? '−' : '';
  const diferenca = direcao === 'igual' ? 'igual' : `${sinal}${formatNumber(Math.abs(delta))}`;
  const porcentagem = percentual === null
    ? (direcao === 'sobe' ? ' · novo' : '')
    : ` · ${sinal}${formatNumber(Math.abs(percentual))}%`;

  return `<strong>${formatNumber(atual)}</strong><span class="chg ${classe}">${seta} ${diferenca}</span>`
    + `<small>${rotuloAnterior} ${formatNumber(anterior)}${porcentagem}</small>`;
}

// Barras dos últimos 14 dias em SVG inline — sem JavaScript, como o resto do
// painel. A barra de hoje em destaque; passar o dedo/mouse mostra dia e valor.
function sparkline(serie) {
  const largura = 98;
  const altura = 28;
  const espaco = 1;
  const barra = (largura - espaco * (serie.length - 1)) / serie.length;
  const maximo = Math.max(1, ...serie.map((ponto) => ponto.valor));

  const barras = serie.map((ponto, indice) => {
    const h = ponto.valor === 0 ? 1 : Math.max(2, Math.round((ponto.valor / maximo) * (altura - 2)));
    const classe = indice === serie.length - 1 ? 'bar-hoje' : ponto.valor === 0 ? 'bar-zero' : 'bar';
    const dia = new Date(ponto.dia).toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });

    return `<rect x="${(indice * (barra + espaco)).toFixed(1)}" y="${altura - h}" width="${barra.toFixed(1)}" height="${h}" rx="1" class="${classe}"><title>${dia}: ${formatNumber(ponto.valor)}</title></rect>`;
  }).join('');

  return `<svg class="spark" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img" aria-label="Últimos 14 dias">${barras}</svg>`;
}

function pctCell(value) {
  return value === null || value === undefined ? '<span class="muted">sem dado</span>' : `${formatNumber(value)}%`;
}

// Variação compacta para os tiles do resumo: "▲ +3 · +60%" ou "= igual".
function changeInline(variacao, anterior, dinheiro = false) {
  const { delta, percentual, direcao } = variacao;
  const classe = direcao === 'sobe' ? 'up' : direcao === 'desce' ? 'down' : 'flat';
  const seta = direcao === 'sobe' ? '▲' : direcao === 'desce' ? '▼' : '=';
  const sinal = delta > 0 ? '+' : delta < 0 ? '−' : '';
  const diferenca = direcao === 'igual' ? 'igual' : `${sinal}${formatNumber(Math.abs(delta))}`;
  const porcentagem = percentual === null
    ? (direcao === 'sobe' ? ' · novo' : '')
    : ` · ${sinal}${formatNumber(Math.abs(percentual))}%`;

  return `<span class="chg ${classe}">${seta} ${diferenca}${porcentagem}</span><small>antes ${dinheiro ? money(anterior) : formatNumber(anterior)}</small>`;
}

function formatSeconds(ms) {
  return ms === null || ms === undefined ? 'sem dado' : `${(Number(ms) / 1000).toFixed(1).replace('.', ',')} s`;
}

function renderHtml(m) {
  const horaAgora = new Date(m.geradoEm).toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });

  // --- resumo da semana ------------------------------------------------------
  const resumo = (m.resumoSemana || [])
    .map((r) => `<div class="tile tile-resumo"><span>${escapeHtml(r.rotulo)}</span><strong>${r.dinheiro ? money(r.atual) : formatNumber(r.atual)}</strong>${changeInline(r.variacao, r.anterior, r.dinheiro)}</div>`)
    .join('');

  // --- crescimento: 7 e 30 dias (sem "hoje", que ao meio-dia é só zero) -------
  const crescimento = (m.crescimento || [])
    .map((c) => `<tr>
      <td>${escapeHtml(c.rotulo)}${c.dica ? `<small>${escapeHtml(c.dica)}</small>` : ''}${sparkline(c.serie)}</td>
      <td class="num">${changeCell(c.ultimos7, c.anteriores7, c.variacaoSemana, 'antes')}</td>
      <td class="num">${changeCell(c.ultimos30 ?? 0, c.anteriores30 ?? 0, c.variacaoMes || { delta: 0, percentual: null, direcao: 'igual' }, 'antes')}</td>
    </tr>`)
    .join('');

  // --- teste Pro por mês -----------------------------------------------------
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const nomeDoMes = (chave) => {
    const [ano, mes] = String(chave).split('-').map(Number);
    return `${MESES[(mes || 1) - 1]}/${String(ano || '').slice(2)}`;
  };
  const testePro = (m.testePro || [])
    .map((t) => `<tr>
      <td>${escapeHtml(nomeDoMes(t.mes))}</td>
      <td class="num">${formatNumber(t.entraram)}</td>
      <td class="num">${formatNumber(t.usaram)}<small>${pctCell(t.taxaUso)}</small></td>
      <td class="num">${formatNumber(t.usaramPro)}</td>
      <td class="num">${formatNumber(t.emTeste)}</td>
      <td class="num">${formatNumber(t.expiraramSemPagar)}</td>
      <td class="num"><strong>${formatNumber(t.pagaram)}</strong><small>${pctCell(t.taxaPagamento)}</small></td>
    </tr>`)
    .join('');

  // --- adoção por função -----------------------------------------------------
  const adocao = m.adocao || { contasAtivas: 0, funcoes: [] };
  const funcoes = adocao.funcoes
    .map((f) => `<tr>
      <td>${escapeHtml(f.rotulo)}<small>${f.fonte === 'servidor' ? 'registro do servidor' : 'eventos (quem aceitou cookies)'}</small></td>
      <td class="num">${formatNumber(f.contas)}</td>
      <td class="num">${pctCell(f.pctDasAtivas)}</td>
      <td class="num">${formatNumber(f.contas7d)}</td>
    </tr>`)
    .join('');
  const templates = m.templatesMaisUsados || { total: 0, dias: 30, templates: [] };
  const templatesLinhas = templates.templates
    .map((t) => `<tr><td>${escapeHtml(t.template)}</td><td class="num">${formatNumber(t.vezes)}</td><td class="num">${pctCell(t.pct)}</td></tr>`)
    .join('');

  // --- dicas contextuais -----------------------------------------------------
  const dicas = (m.dicas || [])
    .map((d) => `<tr>
      <td>${escapeHtml(d.rotulo)}<small>${escapeHtml(d.id)}</small></td>
      <td class="num">${formatNumber(d.exibidas)}<small>${formatNumber(d.pessoasExibidas)} pessoas</small></td>
      <td class="num">${formatNumber(d.concluidas)}<small>${formatNumber(d.pessoasConcluidas)} pessoas</small></td>
      <td class="num">${formatNumber(d.usaramDepois)}<small>${pctCell(d.taxaUsoDepois)}</small></td>
    </tr>`)
    .join('');
  const dicasTotal = (m.dicas || []).reduce((t, d) => t + d.exibidas, 0);

  // --- latência da IA --------------------------------------------------------
  const lat = m.latenciaIa?.hipoteses || null;
  const latTexto = (janela, rotulo) => (janela && janela.amostras
    ? `<strong>${rotulo}:</strong> mediana ${formatSeconds(janela.p50Ms)}, 9 em 10 em até ${formatSeconds(janela.p90Ms)} (${formatNumber(janela.amostras)} análises${janela.acimaDe20s ? `, ${formatNumber(janela.acimaDe20s)} acima de 20 s` : ''}).`
    : `<strong>${rotulo}:</strong> sem análise com tempo registrado.`);

  // --- checkout (recolhido) --------------------------------------------------
  const checkout = m.checkout || null;
  const GRUPOS_CHECKOUT = {
    geral: null,
    cartao: 'Mensal — cartão na nossa página (desde 23/09/2026)',
    semestral_pagina: 'Semestral — cartão à vista ou Pix na nossa página',
    mercado_pago: 'Página do Mercado Pago — quando o pagamento na página está desligado ou não abre',
    banco: 'Resultado no banco de dados (os dois caminhos)',
  };
  let grupoAnterior = 'geral';
  const etapasCheckout = (checkout?.etapas || [])
    .map((etapa) => {
      const grupo = etapa.grupo || 'geral';
      const titulo = grupo !== grupoAnterior && GRUPOS_CHECKOUT[grupo]
        ? `<tr class="grupo"><td colspan="3">${escapeHtml(GRUPOS_CHECKOUT[grupo])}</td></tr>`
        : '';
      grupoAnterior = grupo;
      return `${titulo}<tr><td>${escapeHtml(etapa.rotulo)}<small>${etapa.fonte === 'banco' ? 'banco de dados' : 'eventos (quem aceitou cookies)'}</small></td><td class="num">${formatNumber(etapa.vezes)}</td><td class="num">${formatNumber(etapa.pessoas)}</td></tr>`;
    })
    .join('');
  const cliquesNoPeriodo = checkout?.etapas?.[0]?.vezes || 0;
  const esperaCartao = checkout?.esperaCartao
    ? `Tempo para confirmar o cartão: <strong>${formatSeconds(checkout.esperaCartao.medianaMs)}</strong> na mediana; 9 em cada 10 em até <strong>${formatSeconds(checkout.esperaCartao.p90Ms)}</strong> (${formatNumber(checkout.esperaCartao.amostras)} envios).`
    : 'Tempo para confirmar o cartão: ainda sem envios.';
  const problemasCartao = (checkout?.problemasCartao || [])
    .map((item) => `<tr><td>${escapeHtml(item.rotulo)}</td><td class="num">${formatNumber(item.vezes)}</td></tr>`)
    .join('');
  const recusasPagamento = (checkout?.recusasPagamento || [])
    .map((item) => `<tr><td>${escapeHtml(item.rotulo)}</td><td class="num">${formatNumber(item.vezes)}</td></tr>`)
    .join('');
  const esperaCheckout = checkout?.espera
    ? `Tempo até abrir o Mercado Pago: <strong>${formatSeconds(checkout.espera.medianaMs)}</strong> na mediana; 9 em cada 10 em até <strong>${formatSeconds(checkout.espera.p90Ms)}</strong> (${formatNumber(checkout.espera.amostras)} aberturas).${checkout.espera.p90Ms > 10000 ? ' Acima de 10 s costuma ser o servidor acordando da hibernação.' : ''}`
    : 'Tempo até abrir o Mercado Pago: ainda sem medição.';
  const errosCheckout = (checkout?.erros || [])
    .map((erro) => `<tr><td>${escapeHtml(erro.rotulo)}</td><td class="num">${formatNumber(erro.vezes)}</td></tr>`)
    .join('');
  const retornosCheckout = checkout
    ? `Voltaram do Mercado Pago: <strong>${formatNumber(checkout.retornos.success)}</strong> com sucesso · ${formatNumber(checkout.retornos.pending)} pendentes · ${formatNumber(checkout.retornos.failure)} com falha. Quem desiste no meio do pagamento não volta, e por isso não aparece aqui.`
    : '';
  const recusas = (m.pagamentos?.recusasPorMotivo || [])
    .map((r) => `<tr><td>${escapeHtml(r.rotulo)}</td><td class="num">${formatNumber(r.total)}</td><td class="num">${formatNumber(r.pessoas)}</td></tr>`)
    .join('');

  // --- resto -----------------------------------------------------------------
  const alcance = (m.alcance?.etapas || [])
    .map((etapa) => `<tr><td>${escapeHtml(etapa.rotulo || etapa.nome)}</td><td class="num">${etapa.sessoes}</td><td class="num">${etapa.percentual}%</td></tr>`)
    .join('');
  const eventos = m.eventos
    .map((e) => `<tr><td>${escapeHtml(e.evento)}</td><td class="num">${e.total}</td><td class="num">${e.usuarios}</td><td>${escapeHtml(e.ultimo || '-')}</td></tr>`)
    .join('');
  const afiliados = m.afiliados
    .map((a) => `<tr>
      <td>${escapeHtml(a.codigo)}</td>
      <td class="num"><strong>${a.contasVinculadas}</strong></td>
      <td class="num">${a.visitas}</td>
      <td class="num">${a.checkoutsIniciados}</td>
      <td class="num">${a.compradoresDistintos}</td>
      <td class="num">${a.conversoes}</td>
      <td class="num">${pctCell(a.taxaVisitaParaPago)}</td>
      <td class="num">${pctCell(a.taxaCheckoutParaPago)}</td>
      <td class="num">${money(a.receitaGerada)}</td>
    </tr>`)
    .join('') || '<tr><td colspan="9" class="muted">Nenhum afiliado com movimento.</td></tr>';
  const recursos = (m.usoDeRecursos || [])
    .map((r) => `<tr><td>${escapeHtml(r.rotulo)}</td><td class="num">${formatNumber(r.usos)}</td><td class="num">${formatNumber(r.contas)}</td></tr>`)
    .join('');
  const avisos = m.avisos.map((a) => `<li>${escapeHtml(a)}</li>`).join('');

  // No topo, e não na lista de ressalvas do fim: pode ser dinheiro de alguém
  // que ficou sem o Pro.
  const semVinculo = m.pagamentos?.semVinculo || [];
  const alertaPagamentos = semVinculo.length
    ? `<div class="card alerta">
    <strong>${semVinculo.length} pagamento(s) aprovado(s) no Mercado Pago sem conta ligada</strong>
    <p>Nº ${escapeHtml(semVinculo.join(', '))}. Confira no painel do Mercado Pago se entrou dinheiro: se entrou, a pessoa não recebeu o Pro e o afiliado não recebeu comissão. Não contam como venda neste painel. O alerta some sozinho em 7 dias.</p>
  </div>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
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
  .tile-resumo { background: #eff6ff; border-color: #bfdbfe; }
  .tile-resumo strong { font-size: 1.5rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  th, td { text-align: left; padding: 7px 6px; border-bottom: 1px solid #eef2f7; }
  th { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
  th.num { text-align: right; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td small { display: block; color: #94a3b8; font-size: .72rem; }
  .muted { color: #94a3b8; }
  .avisos { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 12px 12px 12px 28px; margin: 0; font-size: 0.82rem; line-height: 1.5; }
  .scroll { overflow-x: auto; }
  .alerta { background: #fef2f2; border: 1px solid #fecaca; color: #7f1d1d; }
  .alerta p { margin: 6px 0 0; font-size: .85rem; line-height: 1.45; }
  .funil tr.grupo td { padding-top: 14px; font-size: .72rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
  .note { margin: 0 0 8px; font-size: .8rem; }
  .growth td { vertical-align: top; padding: 8px 4px; }
  .growth td.num strong, .growth td.num .chg { display: block; }
  .growth td.num strong { font-size: 1.05rem; }
  .growth td.num small { white-space: nowrap; }
  .growth th small { display: block; text-transform: none; letter-spacing: 0; font-weight: 400; }
  .growth .spark { margin-top: 5px; }
  .chg { font-weight: 700; font-variant-numeric: tabular-nums; font-size: .82rem; }
  .chg.up { color: #15803d; }
  .chg.down { color: #b91c1c; }
  .chg.flat { color: #94a3b8; font-weight: 600; }
  .spark { display: block; }
  .spark .bar { fill: #cbd5e1; }
  .spark .bar-zero { fill: #e2e8f0; }
  .spark .bar-hoje { fill: #16a34a; }
  details.card > summary { cursor: pointer; font-weight: 700; font-size: 1rem; list-style: none; display: flex; justify-content: space-between; align-items: center; }
  details.card > summary::-webkit-details-marker { display: none; }
  details.card > summary::after { content: "abrir"; font-size: .75rem; font-weight: 600; color: #2563eb; }
  details.card[open] > summary::after { content: "recolher"; }
  details.card > summary small { font-weight: 400; color: #94a3b8; font-size: .8rem; margin-left: 8px; }
  details.card > summary + * { margin-top: 12px; }
</style>
</head>
<body><div class="wrap">
  <div class="card">
    <h1>Métricas do site</h1>
    <p class="muted" style="margin:0;font-size:.8rem">Gerado em ${escapeHtml(new Date(m.geradoEm).toLocaleString('pt-BR', { timeZone: FUSO }))} (horário de Brasília)</p>
  </div>

  ${alertaPagamentos}

  <div class="card">
    <h2 style="margin-top:0">A semana em 6 números</h2>
    <p class="muted note">Últimos 7 dias contra os 7 anteriores. Cadastros, pagamentos e receita vêm do banco; o resto, dos eventos (só quem aceitou cookies).</p>
    <div class="tiles">${resumo}</div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Teste Pro: quem entra vira pagante?</h2>
    <p class="muted note">Por mês de cadastro, até 6 meses. <strong>Usaram</strong> = organizou ou abriu algum recurso; <strong>usaram Pro</strong> = hipóteses, prescrição, bulário, carta, análise ou modelo próprio. <strong>Em teste</strong> ainda está nos 7 dias grátis; <strong>expiraram</strong> deixaram o teste acabar sem pagar. Pagou = pagamento aprovado ou conta com Pro comprado.</p>
    <div class="scroll"><table>
      <thead><tr><th>Mês</th><th class="num">Entraram</th><th class="num">Usaram</th><th class="num">Usaram Pro</th><th class="num">Em teste</th><th class="num">Expiraram</th><th class="num">Pagaram</th></tr></thead>
      <tbody>${testePro || '<tr><td colspan="7" class="muted">Sem contas.</td></tr>'}</tbody>
    </table></div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Adoção por função</h2>
    <p class="muted note">De ${formatNumber(adocao.contasAtivas)} contas que usaram alguma coisa, quantas já usaram cada função, e quantas nos últimos 7 dias. Frases prontas e o @ só existem como evento no navegador: são piso.</p>
    <div class="scroll"><table>
      <thead><tr><th>Função</th><th class="num">Contas</th><th class="num">% das ativas</th><th class="num">Últimos 7 dias</th></tr></thead>
      <tbody>${funcoes || '<tr><td colspan="4" class="muted">Sem registro ainda.</td></tr>'}</tbody>
    </table></div>
    <h2>Modelos mais usados (${templates.dias} dias, ${formatNumber(templates.total)} anamneses)</h2>
    <div class="scroll"><table>
      <thead><tr><th>Modelo</th><th class="num">Anamneses</th><th class="num">%</th></tr></thead>
      <tbody>${templatesLinhas || '<tr><td colspan="3" class="muted">Sem anamneses no período.</td></tr>'}</tbody>
    </table></div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Dicas contextuais</h2>
    <p class="muted note">Balões ligados em 05/11/2026. <strong>Usaram depois</strong> = pessoas que fecharam a dica com "Entendi" e usaram a função nos 7 dias seguintes. Eventos só de quem aceitou cookies.</p>
    <div class="scroll"><table>
      <thead><tr><th>Dica</th><th class="num">Exibida</th><th class="num">Entendi</th><th class="num">Usaram depois</th></tr></thead>
      <tbody>${dicasTotal ? dicas : '<tr><td colspan="4" class="muted">Nenhuma dica exibida ainda.</td></tr>'}</tbody>
    </table></div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Crescimento</h2>
    <p class="muted note"><strong>7 dias</strong> contra os 7 anteriores e <strong>30 dias</strong> contra os 30 anteriores, em janelas corridas. As barras são os últimos 14 dias; a verde é hoje até ${horaAgora} (passe o dedo para ver o dia).</p>
    <div class="scroll"><table class="growth">
      <thead><tr><th>Métrica<small>14 dias</small></th><th class="num">7 dias<small>vs 7 anteriores</small></th><th class="num">30 dias<small>vs 30 anteriores</small></th></tr></thead>
      <tbody>${crescimento || '<tr><td colspan="3" class="muted">Sem dados.</td></tr>'}</tbody>
    </table></div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Contas e receita</h2>
    <div class="tiles">
      ${tile('Contas', m.contas.total)}
      ${tile('Em teste agora', m.contas.emTesteAgora ?? 0, 'nos 7 dias grátis')}
      ${tile('Pro pago vigente', m.contas.proPago ?? 0, 'comprado ou concedido')}
      ${tile('Afiliado cortesia', m.contas.afiliadoCortesia)}
      ${tile('Pagamentos aprovados', m.pagamentos.aprovados, 'liberaram o acesso')}
      ${tile('Receita bruta', money(m.pagamentos.receitaBruta), m.pagamentos.reembolsados ? `${m.pagamentos.reembolsados} estorno(s), ${money(m.pagamentos.receitaEstornada)}` : '')}
      ${tile('Compradores únicos', m.pagamentos.compradoresUnicos)}
      ${tile('Anamneses organizadas', formatNumber(m.organizacoes.total), `${m.organizacoes.contas} contas`)}
    </div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">IA: tempo de resposta</h2>
    <p class="note">${latTexto(lat?.ultimos7, 'Hipóteses, 7 dias')}</p>
    <p class="note">${latTexto(lat?.ultimos30, 'Hipóteses, 30 dias')}</p>
    <p class="muted note">Só as hipóteses gravam o tempo no registro do servidor; o organizar ainda não. Custo por chamada não é medido: a OpenAI não devolve o valor e o registro não guarda tokens.</p>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Ativação — as contas chegam a usar?</h2>
    <p class="muted note">Junta as duas fontes: os eventos de organização (dependem de cookie) e o registro de uso no servidor (não depende). Conta quem organizou anamnese ou abriu hipóteses, prescrição, bulário, calculadora, carta, avaliação ou template próprio.</p>
    <div class="tiles">
      ${tile('Contas', m.ativacao.contas)}
      ${tile('Nunca usaram', m.ativacao.semUso, 'criaram conta e não usaram nada')}
      ${tile('Usaram 1 a 4 vezes', m.ativacao.usoLeve)}
      ${tile('Usaram 5+ vezes', m.ativacao.usoForte)}
      ${tile('Usaram em 30 dias', m.ativacao.ativos30d)}
      ${tile('Pararam', m.ativacao.dormentes, 'usaram antes, nada em 30 dias')}
      ${tile('Taxa de ativação', m.ativacao.taxaAtivacao == null ? 'sem dado' : `${m.ativacao.taxaAtivacao}%`, 'das contas chegaram a usar')}
    </div>
    <h2>Movimento e retenção</h2>
    <div class="tiles">
      ${tile('Voltaram em 7 dias', m.retorno.sete, 'pelo carimbo do servidor')}
      ${tile('Voltaram em 30 dias', m.retorno.trinta)}
      ${tile('Sessões em 7 dias', m.sessoesPorPeriodo.sete, 'com alguma ação')}
      ${tile('Sessões em 30 dias', m.sessoesPorPeriodo.trinta, 'com alguma ação')}
      ${tile('1 dia só', m.retencao.umDiaSo, 'contas com evento em 1 dia')}
      ${tile('2 a 3 dias', m.retencao.doisATresDias)}
      ${tile('4+ dias', m.retencao.quatroOuMais)}
      ${tile('Média de dias', m.retencao.mediaDiasAtivos)}
    </div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Alcance por etapa (${m.alcance.totalSessoes} sessões)</h2>
    <p class="muted note">Sessões que passaram por cada etapa, em qualquer ordem.</p>
    <div class="scroll"><table>
      <thead><tr><th>Etapa</th><th class="num">Sessões</th><th class="num">% das sessões</th></tr></thead>
      <tbody>${alcance || '<tr><td colspan="3" class="muted">Sem dados.</td></tr>'}</tbody>
    </table></div>
  </div>

  ${checkout ? `<details class="card"${cliquesNoPeriodo ? ' open' : ''}>
    <summary>Checkout (últimos ${checkout.janelaDias} dias)<small>${formatNumber(cliquesNoPeriodo)} clique(s) em assinar</small></summary>
    <p class="muted note">Do clique em assinar ao pagamento. "Pessoas" conta cada conta uma vez, porque a mesma pessoa costuma clicar e tentar mais de uma vez. Desde 23/09/2026 o mensal é pago com cartão aqui mesmo, sem ir ao Mercado Pago.</p>
    <div class="scroll"><table class="funil">
      <thead><tr><th>Etapa</th><th class="num">Vezes</th><th class="num">Pessoas</th></tr></thead>
      <tbody>${etapasCheckout}</tbody>
    </table></div>
    <p class="note" style="margin-top:12px">${esperaCartao}</p>
    ${problemasCartao
      ? `<div class="scroll"><table><thead><tr><th>Cartão não passou — motivo</th><th class="num">Vezes</th></tr></thead><tbody>${problemasCartao}</tbody></table></div>`
      : '<p class="muted note">Nenhum cartão recusado ou com problema no período.</p>'}
    ${recusasPagamento
      ? `<div class="scroll"><table><thead><tr><th>Pagamentos recusados — motivo (Mercado Pago)</th><th class="num">Vezes</th></tr></thead><tbody>${recusasPagamento}</tbody></table></div>`
      : ''}
    <p class="note" style="margin-top:12px">${esperaCheckout}</p>
    <p class="note">${retornosCheckout}</p>
    ${errosCheckout
      ? `<div class="scroll"><table><thead><tr><th>Erro ao abrir o checkout</th><th class="num">Vezes</th></tr></thead><tbody>${errosCheckout}</tbody></table></div>`
      : '<p class="muted note">Nenhum erro ao abrir o checkout.</p>'}
    <h2>Pagamentos recusados por motivo (todo o histórico)</h2>
    <div class="scroll"><table>
      <thead><tr><th>Motivo</th><th class="num">Recusas</th><th class="num">Pessoas</th></tr></thead>
      <tbody>${recusas || '<tr><td colspan="3" class="muted">Nenhuma recusa.</td></tr>'}</tbody>
    </table></div>
  </details>` : ''}

  <details class="card">
    <summary>Afiliados<small>${m.afiliados.length} código(s)</small></summary>
    <p class="muted note"><strong>Contas vinculadas</strong> conta quem o afiliado trouxe — por link, código digitado ou vínculo manual — e existe antes de qualquer pagamento. Pagos e receita não contam comissão cancelada (estorno ou teste). Visitas só passaram a ser medidas em 31/08/2026.</p>
    <div class="scroll"><table>
      <thead><tr><th>Código</th><th class="num">Contas vinculadas</th><th class="num">Visitas</th><th class="num">Checkouts</th><th class="num">Pessoas</th><th class="num">Pagos</th><th class="num">Visita→pago</th><th class="num">Checkout→pago</th><th class="num">Receita</th></tr></thead>
      <tbody>${afiliados}</tbody>
    </table></div>
  </details>

  <details class="card">
    <summary>Uso bruto<small>registro do servidor e eventos</small></summary>
    <h2 style="margin-top:0">Uso por recurso (registro do servidor)</h2>
    <div class="scroll"><table>
      <thead><tr><th>Recurso</th><th class="num">Usos</th><th class="num">Contas</th></tr></thead>
      <tbody>${recursos || '<tr><td colspan="3" class="muted">Sem registro ainda.</td></tr>'}</tbody>
    </table></div>
    <h2>Uso por evento</h2>
    <div class="scroll"><table>
      <thead><tr><th>Evento</th><th class="num">Total</th><th class="num">Usuários</th><th>Último</th></tr></thead>
      <tbody>${eventos || '<tr><td colspan="4" class="muted">Sem eventos.</td></tr>'}</tbody>
    </table></div>
  </details>

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

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
      <td class="num"><strong>${a.contasVinculadas}</strong></td>
      <td class="num">${a.visitas}</td>
      <td class="num">${a.checkoutsIniciados}</td>
      <td class="num">${a.compradoresDistintos}</td>
      <td class="num">${a.conversoes}</td>
      <td class="num">${a.taxaVisitaParaPago == null ? '<span class="muted">sem dado</span>' : `${a.taxaVisitaParaPago}%`}</td>
      <td class="num">${a.taxaCheckoutParaPago == null ? '<span class="muted">sem dado</span>' : `${a.taxaCheckoutParaPago}%`}</td>
      <td class="num">${money(a.receitaGerada)}</td>
    </tr>`)
    .join('') || '<tr><td colspan="9" class="muted">Nenhum afiliado com movimento.</td></tr>';

  const horaAgora = new Date(m.geradoEm).toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });

  const crescimento = (m.crescimento || [])
    .map((c) => `<tr>
      <td>${escapeHtml(c.rotulo)}${c.dica ? `<small>${escapeHtml(c.dica)}</small>` : ''}${sparkline(c.serie)}</td>
      <td class="num">${changeCell(c.hoje, c.ontemAteAgora, c.variacaoDia, 'ontem')}</td>
      <td class="num">${changeCell(c.ultimos7, c.anteriores7, c.variacaoSemana, 'antes')}</td>
    </tr>`)
    .join('');

  const avisos = m.avisos.map((a) => `<li>${escapeHtml(a)}</li>`).join('');

  const recursos = (m.usoDeRecursos || [])
    .map((r) => `<tr><td>${escapeHtml(r.rotulo)}</td><td class="num">${formatNumber(r.usos)}</td><td class="num">${formatNumber(r.contas)}</td></tr>`)
    .join('');

  const checkout = m.checkout || null;
  const formatSeconds = (ms) => `${(Number(ms) / 1000).toFixed(1).replace('.', ',')} s`;
  // Dois caminhos convivem desde 23/09/2026: o mensal com cartão na nossa
  // página e o semestral na página do Mercado Pago.
  const GRUPOS_CHECKOUT = {
    geral: null,
    cartao: 'Mensal — cartão na nossa página (desde 23/09/2026)',
    mercado_pago: 'Página do Mercado Pago — semestral (e o mensal, se o formulário do cartão não abrir)',
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
  const esperaCartao = checkout?.esperaCartao
    ? `Tempo para confirmar o cartão: <strong>${formatSeconds(checkout.esperaCartao.medianaMs)}</strong> na mediana; 9 em cada 10 em até <strong>${formatSeconds(checkout.esperaCartao.p90Ms)}</strong> (${formatNumber(checkout.esperaCartao.amostras)} envios).`
    : 'Tempo para confirmar o cartão: ainda sem envios.';
  const problemasCartao = (checkout?.problemasCartao || [])
    .map((item) => `<tr><td>${escapeHtml(item.rotulo)}</td><td class="num">${formatNumber(item.vezes)}</td></tr>`)
    .join('');
  // Acima de 10 s, quase sempre é o servidor gratuito acordando da hibernação.
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
  .alerta { background: #fef2f2; border: 1px solid #fecaca; color: #7f1d1d; }
  .alerta p { margin: 6px 0 0; font-size: .85rem; line-height: 1.45; }
  .funil td small { display: block; color: #94a3b8; font-size: .72rem; }
  .funil tr.grupo td { padding-top: 14px; font-size: .72rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
  .note { margin: 0 0 8px; font-size: .8rem; }
  .growth td { vertical-align: top; padding: 8px 4px; }
  .growth td small { display: block; color: #94a3b8; font-size: .72rem; }
  .growth td.num strong, .growth td.num .chg { display: block; }
  .growth td.num strong { font-size: 1.05rem; }
  .growth td.num small { white-space: nowrap; }
  .growth th small { display: block; text-transform: none; letter-spacing: 0; font-weight: 400; }
  .growth th.num { text-align: right; }
  .growth .spark { margin-top: 5px; }
  .chg { font-weight: 700; font-variant-numeric: tabular-nums; }
  .chg.up { color: #15803d; }
  .chg.down { color: #b91c1c; }
  .chg.flat { color: #94a3b8; font-weight: 600; }
  .spark { display: block; }
  .spark .bar { fill: #cbd5e1; }
  .spark .bar-zero { fill: #e2e8f0; }
  .spark .bar-hoje { fill: #16a34a; }
</style>
</head>
<body><div class="wrap">
  <div class="card">
    <h1>Métricas do site</h1>
    <p class="muted" style="margin:0;font-size:.8rem">Gerado em ${escapeHtml(new Date(m.geradoEm).toLocaleString('pt-BR', { timeZone: FUSO }))} (horário de Brasília)</p>
  </div>

  ${alertaPagamentos}

  <div class="card">
    <h2 style="margin-top:0">Crescimento</h2>
    <p class="muted note">Cada número vem com a diferença para o período anterior. <strong>Hoje</strong> é comparado com ontem <strong>até ${horaAgora}</strong>, não com o ontem inteiro — senão toda tarde pareceria queda. <strong>7 dias</strong> é comparado com os 7 anteriores. As barras são os últimos 14 dias; a verde é hoje (passe o dedo para ver o dia).</p>
    <div class="scroll"><table class="growth">
      <thead><tr><th>Métrica<small>14 dias</small></th><th class="num">Hoje<small>vs ontem até ${horaAgora}</small></th><th class="num">7 dias<small>vs 7 anteriores</small></th></tr></thead>
      <tbody>${crescimento || '<tr><td colspan="3" class="muted">Sem dados.</td></tr>'}</tbody>
    </table></div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Contas e receita</h2>
    <div class="tiles">
      ${tile('Contas', m.contas.total)}
      ${tile('Iniciaram trial', m.contas.comTrial)}
      ${tile('Pro vigente', m.contas.proVigente)}
      ${tile('Afiliado cortesia', m.contas.afiliadoCortesia)}
      ${tile('Pagamentos aprovados', m.pagamentos.aprovados, 'liberaram o acesso')}
      ${tile('Receita bruta', money(m.pagamentos.receitaBruta), m.pagamentos.reembolsados ? `${m.pagamentos.reembolsados} estorno(s)` : '')}
      ${tile('Compradores únicos', m.pagamentos.compradoresUnicos)}
      ${tile('Anamneses organizadas', formatNumber(m.organizacoes.total), `${m.organizacoes.contas} contas`)}
      ${tile('Avaliações pedidas', formatNumber(m.anamneses.total), 'anamneses com nota e análise')}
    </div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Pagamentos recusados por motivo</h2>
    <p class="muted note">Motivo informado pelo Mercado Pago. Cada tentativa recusada conta uma vez em "Recusas"; "Pessoas" conta cada conta uma vez. Recusas gravadas antes de o motivo passar a ser registrado aparecem como "Motivo não registrado".</p>
    <div class="scroll"><table>
      <thead><tr><th>Motivo</th><th class="num">Recusas</th><th class="num">Pessoas</th></tr></thead>
      <tbody>${recusas || '<tr><td colspan="3" class="muted">Nenhuma recusa.</td></tr>'}</tbody>
    </table></div>
  </div>

  ${checkout ? `<div class="card">
    <h2 style="margin-top:0">Checkout (últimos ${checkout.janelaDias} dias)</h2>
    <p class="muted note">Do clique em assinar ao pagamento. "Pessoas" conta cada conta uma vez, porque a mesma pessoa costuma clicar e tentar mais de uma vez. Desde 23/09/2026 o mensal é pago com cartão aqui mesmo, sem ir ao Mercado Pago: "Foram à página do Mercado Pago" passou a contar só o semestral, e cair ali não é queda de vendas.</p>
    <div class="scroll"><table class="funil">
      <thead><tr><th>Etapa</th><th class="num">Vezes</th><th class="num">Pessoas</th></tr></thead>
      <tbody>${etapasCheckout}</tbody>
    </table></div>
    <p class="note" style="margin-top:12px">${esperaCartao}</p>
    ${problemasCartao
      ? `<div class="scroll"><table><thead><tr><th>Cartão não passou — motivo</th><th class="num">Vezes</th></tr></thead><tbody>${problemasCartao}</tbody></table></div>`
      : '<p class="muted note">Nenhum cartão recusado ou com problema no período.</p>'}
    <p class="note" style="margin-top:12px">${esperaCheckout}</p>
    <p class="note">${retornosCheckout}</p>
    ${errosCheckout
      ? `<div class="scroll"><table><thead><tr><th>Erro ao abrir o checkout</th><th class="num">Vezes</th></tr></thead><tbody>${errosCheckout}</tbody></table></div>`
      : '<p class="muted note">Nenhum erro ao abrir o checkout.</p>'}
  </div>` : ''}

  <div class="card">
    <h2 style="margin-top:0">Ativação — as contas chegam a usar?</h2>
    <p class="muted note">Junta as duas fontes: os eventos de organização (dependem de cookie) e o registro de uso no servidor (não depende, e vale para conta em teste, paga ou cortesia). Conta quem organizou anamnese ou abriu hipóteses, prescrição, bulário, calculadora, carta, avaliação ou template próprio.</p>
    <div class="tiles">
      ${tile('Contas', m.ativacao.contas)}
      ${tile('Nunca usaram', m.ativacao.semUso, 'criaram conta e não usaram nada')}
      ${tile('Usaram 1 a 4 vezes', m.ativacao.usoLeve)}
      ${tile('Usaram 5+ vezes', m.ativacao.usoForte)}
      ${tile('Usaram em 30 dias', m.ativacao.ativos30d)}
      ${tile('Pararam', m.ativacao.dormentes, 'usaram antes, nada em 30 dias')}
      ${tile('Taxa de ativação', m.ativacao.taxaAtivacao == null ? 'sem dado' : `${m.ativacao.taxaAtivacao}%`, 'das contas chegaram a usar')}
    </div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Uso por recurso (registro do servidor)</h2>
    <p class="muted note">Não depende de cookie e conta toda conta, inclusive Pro e cortesia. Calculadoras entram quando a ferramenta é aberta; frases prontas ainda aparecem só no uso por evento, logo abaixo.</p>
    <div class="scroll"><table>
      <thead><tr><th>Recurso</th><th class="num">Usos</th><th class="num">Contas</th></tr></thead>
      <tbody>${recursos || '<tr><td colspan="3" class="muted">Sem registro ainda.</td></tr>'}</tbody>
    </table></div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Movimento recente</h2>
    <p class="muted" style="margin:0 0 8px;font-size:.8rem">Retorno vem do servidor e começou a ser medido agora. Sessões com atividade vem dos eventos e só conta quem aceitou cookies — e quem entra sem fazer nada não aparece em nenhuma das duas.</p>
    <div class="tiles">
      ${tile('Voltaram hoje', m.retorno.hoje)}
      ${tile('Voltaram em 7 dias', m.retorno.sete)}
      ${tile('Voltaram em 30 dias', m.retorno.trinta)}
      ${tile('Sem registro ainda', m.retorno.semRegistro, 'medição recém-começada')}
      ${tile('Sessões hoje', m.sessoesPorPeriodo.hoje, 'com alguma ação')}
      ${tile('Sessões em 7 dias', m.sessoesPorPeriodo.sete, 'com alguma ação')}
      ${tile('Sessões em 30 dias', m.sessoesPorPeriodo.trinta, 'com alguma ação')}
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
    <p class="muted" style="margin:0 0 8px;font-size:.8rem"><strong>Contas vinculadas</strong> conta quem o afiliado trouxe — por link, código digitado ou vínculo manual — e existe antes de qualquer pagamento. Visitas só passaram a ser medidas a partir da instrumentação do link: zero no histórico antigo é ausência de medição, não queda.</p>
    <div class="scroll"><table>
      <thead><tr><th>Código</th><th class="num">Contas vinculadas</th><th class="num">Visitas</th><th class="num">Checkouts</th><th class="num">Pessoas</th><th class="num">Pagos</th><th class="num">Visita→pago</th><th class="num">Checkout→pago</th><th class="num">Receita</th></tr></thead>
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

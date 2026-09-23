// Tela de resultado do pagamento feito na nossa página (mensal e semestral):
// confirmado, aguardando confirmação, ou encerrado sem cobrança.
//
// Quem acabou de pagar quer ver, sem ler parágrafo, que deu certo, quanto
// pagou e até quando vale. Por isso o ícone vem antes do texto e o resumo vem
// em lista.

function IconeConfirmado() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  );
}

function IconeAguardando() {
  return <span className="checkout-outcome-spinner" aria-hidden="true" />;
}

function IconeEncerrado() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

const ICONES = {
  sucesso: IconeConfirmado,
  aguardando: IconeAguardando,
  neutro: IconeEncerrado,
};

/**
 * @param {'sucesso'|'aguardando'|'neutro'} tom
 * @param {Array<{rotulo: string, valor: string}>} detalhes linhas do resumo (vazias somem)
 */
function CheckoutOutcome({
  tom,
  plano,
  titulo,
  subtitulo,
  detalhes = [],
  nota,
  acaoPrincipal,
  onAcaoPrincipal,
  acaoSecundaria,
  onAcaoSecundaria,
  onClose,
  tituloId,
}) {
  const Icone = ICONES[tom] || IconeConfirmado;
  const linhas = detalhes.filter((linha) => linha && linha.valor);

  return (
    <div className={`checkout-outcome checkout-outcome-${tom}`}>
      <button type="button" className="checkout-outcome-close" onClick={onClose} aria-label="Fechar">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className="checkout-outcome-icon">
        <Icone />
      </div>

      {plano ? <span className="checkout-outcome-plan">{plano}</span> : null}
      <h2 id={tituloId} className="checkout-outcome-title" role={tom === 'aguardando' ? 'status' : undefined}>{titulo}</h2>
      {subtitulo ? <p className="checkout-outcome-subtitle">{subtitulo}</p> : null}

      {linhas.length ? (
        <dl className="checkout-outcome-details">
          {linhas.map((linha) => (
            <div key={linha.rotulo} className="checkout-outcome-row">
              <dt>{linha.rotulo}</dt>
              <dd>{linha.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {nota ? <p className="checkout-outcome-note">{nota}</p> : null}

      {acaoPrincipal ? (
        <button type="button" className="btn btn-primario checkout-outcome-action" onClick={onAcaoPrincipal}>
          {acaoPrincipal}
        </button>
      ) : null}
      {acaoSecundaria ? (
        <button type="button" className="checkout-outcome-link" onClick={onAcaoSecundaria}>
          {acaoSecundaria}
        </button>
      ) : null}
    </div>
  );
}

export default CheckoutOutcome;

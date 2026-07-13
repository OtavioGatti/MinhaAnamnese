function formatDateBR(value) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('pt-BR');
}

function formatCurrencyBRL(value, currencyId = 'BRL') {
  if (value == null || Number.isNaN(Number(value))) {
    return '';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currencyId || 'BRL',
  }).format(Number(value));
}

function CancelSubscriptionModal({ open, loading, error, accessUntil, refundWindow, onClose, onConfirm }) {
  if (!open) {
    return null;
  }

  const refundEligible = Boolean(refundWindow?.eligible);
  const refundAmountLabel = refundEligible ? formatCurrencyBRL(refundWindow?.amount, refundWindow?.currencyId) : '';
  const formattedAccessUntil = formatDateBR(accessUntil);
  const formattedDeadline = refundEligible ? formatDateBR(refundWindow?.deadline) : '';

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="app-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-subscription-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header">
          <div>
            <span className="workspace-kicker">Assinatura</span>
            {refundEligible ? (
              <>
                <h2 id="cancel-subscription-title">Cancelar e solicitar reembolso?</h2>
                <p>
                  Você está dentro do prazo de arrependimento de 7 dias
                  {formattedDeadline ? ` (até ${formattedDeadline})` : ''}.
                  {refundAmountLabel
                    ? ` Faremos o estorno integral de ${refundAmountLabel} e seu acesso profissional será encerrado imediatamente.`
                    : ' Faremos o estorno integral e seu acesso profissional será encerrado imediatamente.'}
                </p>
              </>
            ) : (
              <>
                <h2 id="cancel-subscription-title">Cancelar assinatura mensal?</h2>
                <p>
                  Você não será cobrado novamente.
                  {formattedAccessUntil
                    ? ` Seu acesso profissional continua até ${formattedAccessUntil}.`
                    : ' Seu acesso profissional continua até o fim do período já pago.'}
                </p>
              </>
            )}
          </div>
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Fechar
          </button>
        </div>

        {error ? <div className="templates-inline-error">{error}</div> : null}

        <div className="app-modal-actions">
          <button type="button" className="btn btn-secundario" onClick={onClose} disabled={loading}>
            Manter assinatura
          </button>
          <button type="button" className="btn btn-primario" onClick={onConfirm} disabled={loading}>
            {loading
              ? 'Processando...'
              : refundEligible
                ? 'Confirmar cancelamento e reembolso'
                : 'Confirmar cancelamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CancelSubscriptionModal;

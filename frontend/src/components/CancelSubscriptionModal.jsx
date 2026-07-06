function formatDateBR(value) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('pt-BR');
}

function CancelSubscriptionModal({ open, loading, error, accessUntil, onClose, onConfirm }) {
  if (!open) {
    return null;
  }

  const formattedAccessUntil = formatDateBR(accessUntil);

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
            <h2 id="cancel-subscription-title">Cancelar assinatura mensal?</h2>
            <p>
              Você não será cobrado novamente.
              {formattedAccessUntil
                ? ` Seu acesso profissional continua até ${formattedAccessUntil}.`
                : ' Seu acesso profissional continua até o fim do período já pago.'}
            </p>
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
            {loading ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CancelSubscriptionModal;

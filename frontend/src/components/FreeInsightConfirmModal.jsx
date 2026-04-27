function FreeInsightConfirmModal({ open, loading, onClose, onConfirm }) {
  if (!open) {
    return null;
  }

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="app-modal-card free-insight-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-insight-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header">
          <div className="free-insight-confirm-copy">
            <span className="workspace-kicker">{'An\u00e1lise gr\u00e1tis'}</span>
            <h2 id="free-insight-title">{'Usar sua an\u00e1lise gr\u00e1tis agora?'}</h2>
            <p>{'Ela libera a leitura completa deste caso, com justificativa da nota, principal lacuna e pr\u00f3ximo passo cl\u00ednico.'}</p>
          </div>
        </div>

        <div className="free-insight-confirm-note">
          {'Esse benef\u00edcio \u00fanico foi pensado para mostrar o valor completo da revis\u00e3o antes do upgrade.'}
        </div>

        <div className="app-modal-actions">
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            {'Ainda n\u00e3o'}
          </button>
          <button type="button" className="btn btn-primario" onClick={onConfirm} disabled={loading}>
            {loading ? 'Liberando an\u00e1lise...' : 'Sim, usar agora'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FreeInsightConfirmModal;

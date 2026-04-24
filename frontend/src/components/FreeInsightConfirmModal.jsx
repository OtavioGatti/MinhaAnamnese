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
            <span className="workspace-kicker">Analise gratis</span>
            <h2 id="free-insight-title">Usar sua analise gratis agora?</h2>
            <p>Ela libera a leitura completa deste caso, com justificativa da nota, principal lacuna e proximo passo clinico.</p>
          </div>
        </div>

        <div className="free-insight-confirm-note">
          Esse beneficio unico foi pensado para mostrar o valor completo da revisao antes do upgrade.
        </div>

        <div className="app-modal-actions">
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Ainda nao
          </button>
          <button type="button" className="btn btn-primario" onClick={onConfirm} disabled={loading}>
            {loading ? 'Liberando analise...' : 'Sim, usar agora'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FreeInsightConfirmModal;

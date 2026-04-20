function QuickActions({
  copiado,
  onCopiar,
  onLimpar,
  loading,
}) {
  return (
    <div className="card section-actions">
      <div className="card-header">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        <h2>Ações rápidas</h2>
      </div>

      <div className="quick-actions-grid">
        <button
          className={`btn btn-primario quick-action-primary ${copiado ? 'copiado' : ''}`}
          type="button"
          onClick={onCopiar}
        >
          {copiado ? 'Copiado para prontuário' : 'Copiar para prontuário'}
        </button>

        <button
          className="btn btn-secundario"
          type="button"
          onClick={onLimpar}
          disabled={loading}
        >
          Nova anamnese
        </button>
      </div>
    </div>
  );
}

export default QuickActions;

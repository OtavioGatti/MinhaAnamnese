// Só aparece quando o texto base E o resultado organizado foram editados desde
// a última organização. Nesse caso não dá para adivinhar qual o médico quer
// reprocessar sem descartar trabalho do outro lado, então perguntamos.
function OrganizeSourceModal({ open, onClose, onSelect }) {
  if (!open) {
    return null;
  }

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="app-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="organize-source-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header">
          <div>
            <span className="workspace-kicker">Reorganizar</span>
            <h2 id="organize-source-title">Qual texto devo reorganizar?</h2>
            <p>
              Você editou o texto base e também o resultado estruturado. Escolha de onde partir —
              nada é apagado, o outro texto continua na tela.
            </p>
          </div>
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="organize-source-options">
          <button
            type="button"
            className="organize-source-option"
            onClick={() => onSelect('resultado_editado')}
          >
            <strong>Usar o resultado estruturado</strong>
            <span>Mantém o que você acrescentou direto no resultado e reorganiza tudo a partir dele.</span>
          </button>

          <button
            type="button"
            className="organize-source-option"
            onClick={() => onSelect('texto_base')}
          >
            <strong>Usar o texto base</strong>
            <span>Reprocessa a coleta original. As edições feitas no resultado não entram.</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default OrganizeSourceModal;

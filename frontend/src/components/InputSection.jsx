function InputSection({
  templates,
  templateSelecionado,
  onTemplateChange,
  loadingTemplates,
  texto,
  onTextoChange,
  inputRef,
  placeholder,
  possuiGuiaSelecionado,
  templateTemCalculadora,
  onOpenCalculadora,
  loading,
  loadingInsights,
  onOrganizar,
  onLimpar,
  erro,
  onDismissErro,
}) {
  return (
    <div className="card section-input workspace-panel workspace-panel-primary">
      <div className="card-header card-header-with-copy">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        <div>
          <h2>Monte sua anamnese</h2>
          <p className="card-subtitle">
            {'Selecione o modelo, escreva como coleta e gere uma vers\u00e3o pronta para revisar e usar no atendimento.'}
          </p>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="template">{'Modelo cl\u00ednico'}</label>
        <div className="input-wrapper">
          <select
            id="template"
            value={templateSelecionado}
            onChange={onTemplateChange}
            disabled={loadingTemplates}
          >
            <option value="">
              {loadingTemplates ? 'Carregando modelos...' : 'Selecione o modelo da anamnese...'}
            </option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="texto">Texto base</label>
        <div className="input-wrapper">
          <textarea
            className="task-textarea"
            ref={inputRef}
            id="texto"
            value={texto}
            onChange={(event) => onTextoChange(event.target.value)}
            placeholder={placeholder}
          />
          {texto.length > 0 && (
            <span className="char-count">{texto.length} caracteres</span>
          )}
        </div>

        {!texto.trim() && (
          <div className="empty-state-hint">
            {possuiGuiaSelecionado
              ? 'Use o apoio contextual ao lado para checar o guia, a estrutura esperada e as calculadoras deste modelo.'
              : 'Cole ou escreva suas anotações e organize tudo em um texto clínico mais claro para o atendimento.'}
          </div>
        )}

        <div className="field-helper input-privacy-copy">
          {'O texto da anamnese n\u00e3o \u00e9 armazenado. M\u00e9tricas agregadas de uso e evolu\u00e7\u00e3o podem ser registradas.'}
        </div>
      </div>

      <div className="painel-acoes">
        {templateTemCalculadora && (
          <button
            className="btn-guia-toggle"
            onClick={onOpenCalculadora}
            title="Abrir calculadoras de apoio"
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <line x1="8" y1="6" x2="16" y2="6" />
              <line x1="8" y1="10" x2="8" y2="10" />
              <line x1="12" y1="10" x2="12" y2="10" />
              <line x1="16" y1="10" x2="16" y2="10" />
              <line x1="8" y1="14" x2="8" y2="14" />
              <line x1="12" y1="14" x2="12" y2="14" />
              <line x1="16" y1="14" x2="16" y2="14" />
              <line x1="8" y1="18" x2="16" y2="18" />
            </svg>
            Abrir calculadoras de apoio
          </button>
        )}
      </div>

      <div className="botoes">
        <button
          className="btn btn-primario"
          onClick={onOrganizar}
          disabled={loading}
          type="button"
        >
          {loading ? (
            <>
              <span className="spinner" />
              {loadingInsights ? 'Gerando análise clínica...' : 'Organizando...'}
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4" />
                <path d="m16.2 7.8 2.9-2.9" />
                <path d="M18 12h4" />
                <path d="m16.2 16.2 2.9 2.9" />
                <path d="M12 18v4" />
                <path d="m4.9 19.1 2.9-2.9" />
                <path d="M2 12h4" />
                <path d="m4.9 4.9 2.9 2.9" />
              </svg>
              Organizar anamnese
            </>
          )}
        </button>
        <button
          className="btn btn-secundario"
          onClick={onLimpar}
          disabled={loading}
          type="button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
          Limpar
        </button>
      </div>

      {erro && (
        <div className="erro">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="erro-copy">
            <strong>Revise antes de continuar</strong>
            <span>{erro}</span>
          </div>
          <button
            className="btn-erro-dismiss"
            onClick={onDismissErro}
            title="Fechar"
            type="button"
          >
            {'\u00d7'}
          </button>
        </div>
      )}
    </div>
  );
}

export default InputSection;

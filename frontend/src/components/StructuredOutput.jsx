const SECTION_LABELS = [
  'Identificação',
  'Queixa principal',
  'QP',
  'HDA',
  'História da doença atual',
  'Historia da doenca atual',
  'Antecedentes',
  'Antecedentes pessoais',
  'Antecedentes familiares',
  'Medicações',
  'Medicacoes',
  'Exame físico',
  'Exame fisico',
  'Hipóteses diagnósticas',
  'Hipoteses diagnosticas',
  'Conduta',
  'Impressão',
  'Impressao',
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildDocumentParts(texto) {
  const headingPattern = new RegExp(
    `^(${SECTION_LABELS.map(escapeRegExp).join('|')})\\s*:?\\s*(.*)$`,
    'i',
  );

  return texto
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(headingPattern);

      if (!match) {
        return {
          id: `paragraph-${index}`,
          type: 'paragraph',
          content: line,
        };
      }

      return {
        id: `section-${index}`,
        type: 'section',
        title: match[1],
        content: match[2]?.trim() ?? '',
      };
    });
}

function StructuredOutput({ displayedResultado, copiado, onCopiar }) {
  const documentParts = buildDocumentParts(displayedResultado || '');

  return (
    <section className="document-block section-result">
      <div className="document-shell">
        <div className="document-toolbar">
          <div className="document-heading">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div>
              <h2>Resultado estruturado</h2>
              <p className="result-guidance">
                {'Revise rapidamente e copie o texto quando estiver pronto para o prontu\u00e1rio.'}
              </p>
            </div>
          </div>

          <div className="document-actions">
            <button
              className={`btn btn-copiar btn-copiar-inline ${copiado ? 'copiado' : ''}`}
              onClick={onCopiar}
              type="button"
            >
              {copiado ? 'Copiado!' : 'Copiar resultado'}
            </button>
            <span className="document-action-hint">1 clique para usar no atendimento</span>
          </div>
        </div>

        <div className="resultado-container">
          <div className="document-meta">
            <span className="document-status-dot" aria-hidden="true" />
            {'Formato pronto para prontu\u00e1rio'}
          </div>

          <div className="resultado resultado-primary">
            <div className="clinical-document">
              {documentParts.map((part) => {
                if (part.type === 'section') {
                  return (
                    <section key={part.id} className="clinical-section">
                      <h3 className="clinical-section-title">{part.title}</h3>
                      {part.content ? <p className="clinical-paragraph">{part.content}</p> : null}
                    </section>
                  );
                }

                return (
                  <p key={part.id} className="clinical-paragraph">
                    {part.content}
                  </p>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default StructuredOutput;

import { useEffect, useRef } from 'react';
import { handleUppercaseCopy } from '../lib/clinicalTextCase';

// Textarea que cresce com o conteúdo — o médico revisa e edita a anamnese aqui
// mesmo antes de copiar. O texto editado é a MESMA fonte usada por "Copiar
// resultado" e por "Sugerir hipóteses", então um ajuste feito aqui já entra na
// próxima análise sem precisar reorganizar a anamnese do zero.
function useAutoSize(value) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value]);

  return ref;
}

function StructuredOutput({
  displayedResultado,
  onResultadoChange,
  copiado,
  onCopiar,
  outputCaseStyle = 'mixed',
  onChangeOutputCaseStyle,
  onSuggestHypotheses,
  diagnosticLoading = false,
  diagnosticEnabled = false,
  diagnosticProAccess = false,
}) {
  const texto = displayedResultado || '';
  const textareaRef = useAutoSize(texto);

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
                {'Edite direto no texto se precisar ajustar algo. A cópia e a análise usam a versão editada.'}
              </p>
            </div>
          </div>

          <div className="document-actions">
            <div
              className="case-style-toggle"
              role="group"
              aria-label="Estilo de escrita da saída"
              title="Escolher entre texto normal (Aa) ou tudo em maiúsculas (AA)"
            >
              <button
                type="button"
                className={`case-style-option ${outputCaseStyle === 'mixed' ? 'active' : ''}`}
                onClick={() => onChangeOutputCaseStyle?.('mixed')}
              >
                Aa
              </button>
              <button
                type="button"
                className={`case-style-option ${outputCaseStyle === 'upper' ? 'active' : ''}`}
                onClick={() => onChangeOutputCaseStyle?.('upper')}
              >
                AA
              </button>
            </div>
            <div className="document-action-buttons">
              <button
                className={`btn btn-copiar btn-copiar-inline ${copiado ? 'copiado' : ''}`}
                onClick={onCopiar}
                type="button"
              >
                {copiado ? 'Copiado!' : 'Copiar resultado'}
              </button>
              {diagnosticEnabled ? (
                <button
                  className="btn btn-diagnostic-hypotheses"
                  onClick={onSuggestHypotheses}
                  disabled={diagnosticLoading}
                  type="button"
                >
                  {diagnosticLoading ? 'Analisando...' : 'Sugerir hipóteses'}
                  {!diagnosticProAccess ? <span>PRO</span> : null}
                </button>
              ) : null}
            </div>
            <span className="document-action-hint">1 clique para usar no atendimento</span>
          </div>
        </div>

        <div className="resultado-container">
          <div className="document-meta">
            <span className="document-status-dot" aria-hidden="true" />
            {'Formato pronto para prontuário'}
          </div>

          <div className="resultado resultado-primary">
            <textarea
              ref={textareaRef}
              className={`clinical-document-editor ${outputCaseStyle === 'upper' ? 'is-upper' : ''}`}
              value={texto}
              onChange={(event) => onResultadoChange?.(event.target.value)}
              onCopy={(event) => handleUppercaseCopy(event, outputCaseStyle === 'upper')}
              spellCheck
              aria-label="Anamnese estruturada (editável)"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default StructuredOutput;

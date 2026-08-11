import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../apiClient';
import { useCid10Search } from '../hooks/useCid10Search';
import { handleUppercaseCopy } from '../lib/clinicalTextCase';
import { LETTER_TYPES, DEFAULT_LETTER_TYPE_KEY, getLetterType } from '../letterTypes';

function getAccessCopy({ user, accessState }) {
  if (!user?.id) {
    return {
      title: 'Entre para gerar cartas e documentos',
      description: 'Crie uma conta para iniciar o teste profissional e gerar encaminhamentos, relatórios e outros documentos com IA.',
      buttonLabel: 'Entrar',
    };
  }

  if (!accessState?.hasActiveProAccess) {
    return {
      title: accessState?.isTrialExpired ? 'Teste profissional encerrado' : 'Recurso do Plano Profissional',
      description: 'Cartas e documentos com IA ficam disponíveis no Profissional.',
      buttonLabel: 'Assinar Pro',
    };
  }

  return null;
}

// Auto-ajusta a altura do textarea da saída ao conteúdo.
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

function LetterGeneratorCard({
  letter,
  onLetterChange,
  loading,
  error,
  checkoutError,
  copied,
  user,
  accessState,
  loadingCheckout,
  defaultCaseStyle = 'mixed',
  cidOptions = [],
  onGenerate,
  onCopy,
  onRequestUpgrade,
  onDismissError,
  onManageModels,
}) {
  const [letterType, setLetterType] = useState(DEFAULT_LETTER_TYPE_KEY);
  const [fields, setFields] = useState({});
  const [modelId, setModelId] = useState('');
  const [myModels, setMyModels] = useState([]);
  const [caseStyle, setCaseStyle] = useState(defaultCaseStyle === 'upper' ? 'upper' : 'mixed');
  // Só abre a busca depois que o médico digita: escolher um código pelos chips
  // ou reabrir o formulário não deve fazer a lista aparecer sozinha.
  const [cidSearchOpen, setCidSearchOpen] = useState(false);

  const accessCopy = getAccessCopy({ user, accessState });
  const shouldUseUpgradeAction = Boolean(accessCopy);
  const currentType = getLetterType(letterType);
  const outputRef = useAutoSize(letter);
  const hasCidField = currentType.fields.some((field) => field.widget === 'cid');
  const cidSearch = useCid10Search(fields.cid10, {
    enabled: hasCidField && cidSearchOpen && !shouldUseUpgradeAction,
    limit: 8,
  });

  // Carrega os modelos do usuário para popular o seletor (por tipo).
  useEffect(() => {
    if (!user?.id) {
      setMyModels([]);
      return undefined;
    }

    let cancelled = false;

    api.get('/letter-models')
      .then((response) => {
        if (!cancelled && response.success) {
          setMyModels(Array.isArray(response.data?.mine) ? response.data.mine : []);
        }
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const modelsForType = useMemo(
    () => myModels.filter((model) => model.letterType === letterType),
    [myModels, letterType],
  );

  // Ao trocar de tipo, seleciona o modelo padrão do usuário daquele tipo (se houver).
  useEffect(() => {
    const preferred = modelsForType.find((model) => model.isDefault);
    setModelId(preferred ? preferred.id : '');
  }, [letterType, modelsForType]);

  const handleFieldChange = (name, value) => {
    setFields((current) => ({ ...current, [name]: value }));
  };

  const handleGenerateClick = () => {
    if (shouldUseUpgradeAction) {
      onRequestUpgrade();
      return;
    }

    onGenerate({ letterType, fields, modelId: modelId || null });
  };

  return (
    <section className="card referral-letter-card section-referral workspace-panel">
      <div className="card-header card-header-with-copy referral-letter-header">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4h16v16H4z" />
          <path d="M4 8h16" />
          <path d="M8 4v16" />
          <path d="M12 12h5" />
          <path d="M12 16h4" />
        </svg>
        <div>
          <h2>Cartas e documentos</h2>
          <p className="card-subtitle">
            {'Gere encaminhamentos, relatórios e outros documentos a partir da história clínica. Escolha o tipo e o modelo de formato.'}
          </p>
        </div>
      </div>

      <div className="form-group referral-field">
        <label htmlFor="letter-type">Tipo de documento</label>
        <div className="input-wrapper">
          <select
            id="letter-type"
            value={letterType}
            onChange={(event) => setLetterType(event.target.value)}
            disabled={loading}
          >
            {LETTER_TYPES.map((type) => (
              <option key={type.key} value={type.key}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="referral-letter-grid">
        {currentType.fields.map((field) => {
          // O CID sugerido vem das hipóteses já geradas — e cada opção carrega o
          // CID do guia de prescrição casado, ou seja, conteúdo revisado.
          const isCidField = field.widget === 'cid';
          const suggestions = isCidField ? cidOptions : [];
          const showCidResults = isCidField && cidSearchOpen && cidSearch.results.length > 0;

          return (
            <div className="form-group referral-field" key={field.name}>
              <label htmlFor={`letter-field-${field.name}`}>{field.label}</label>
              <div className={`input-wrapper ${isCidField ? 'letter-cid-input-wrapper' : ''}`}>
                <input
                  id={`letter-field-${field.name}`}
                  type="text"
                  value={fields[field.name] || ''}
                  onChange={(event) => {
                    handleFieldChange(field.name, event.target.value);
                    if (isCidField) {
                      setCidSearchOpen(true);
                    }
                  }}
                  onBlur={isCidField ? () => setCidSearchOpen(false) : undefined}
                  placeholder={field.placeholder}
                  disabled={loading}
                  autoComplete={isCidField ? 'off' : undefined}
                />

                {showCidResults ? (
                  <ul className="letter-cid-results" role="listbox" aria-label="Códigos CID-10 encontrados">
                    {cidSearch.results.map((result) => (
                      <li key={result.code}>
                        {/* onMouseDown corre antes do blur do input — com onClick a
                            lista já teria fechado antes de o clique chegar. */}
                        <button
                          type="button"
                          className="letter-cid-result"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleFieldChange(field.name, result.code);
                            setCidSearchOpen(false);
                          }}
                        >
                          <strong>{result.code}</strong>
                          <span>{result.description}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {suggestions.length > 0 ? (
                <div className="letter-cid-suggestions">
                  <span className="letter-cid-suggestions-label">Das hipóteses geradas:</span>
                  {suggestions.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      className={`letter-cid-chip ${fields[field.name] === option.code ? 'active' : ''}`}
                      onClick={() => {
                        handleFieldChange(field.name, option.code);
                        setCidSearchOpen(false);
                      }}
                      disabled={loading}
                    >
                      <strong>{option.code}</strong>
                      <span>{option.condition}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {field.hint ? <p className="referral-field-hint">{field.hint}</p> : null}
            </div>
          );
        })}
      </div>

      <div className="form-group referral-field">
        <label htmlFor="letter-model">Modelo de formato</label>
        <div className="input-wrapper referral-model-wrapper">
          <select
            id="letter-model"
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            disabled={loading}
          >
            <option value="">Padrão oficial</option>
            {modelsForType.map((model) => (
              <option key={model.id} value={model.id}>
                {model.title}{model.isDefault ? ' (padrão)' : ''}
              </option>
            ))}
          </select>
          {onManageModels ? (
            <button type="button" className="btn-link referral-manage-link" onClick={onManageModels}>
              Gerenciar modelos
            </button>
          ) : null}
        </div>
      </div>

      {accessCopy ? (
        <div className="paywall-panel">
          <div>
            <strong>{accessCopy.title}</strong>
            <span>{accessCopy.description}</span>
          </div>
          {checkoutError ? <div className="feedback-secondary-error">{checkoutError}</div> : null}
        </div>
      ) : null}

      <div className="referral-actions">
        <button
          type="button"
          className="btn btn-primario referral-generate-button"
          onClick={handleGenerateClick}
          disabled={loading || loadingCheckout}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Gerando documento...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
              {loadingCheckout ? 'Abrindo checkout...' : shouldUseUpgradeAction ? accessCopy.buttonLabel : 'Gerar documento'}
            </>
          )}
        </button>
        <span className="referral-helper">
          {'O documento sai como rascunho a revisar — ajuste o texto antes de usar. Nada é inventado além do que está na história.'}
        </span>
      </div>

      {error && (
        <div className="erro referral-error">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="erro-copy">
            <strong>Revise antes de gerar</strong>
            <span>{error}</span>
          </div>
          <button className="btn-erro-dismiss" onClick={onDismissError} title="Fechar" type="button">
            {'×'}
          </button>
        </div>
      )}

      {letter && (
        <div className="referral-letter-output">
          <div className="referral-letter-output-header">
            <div>
              <strong>Documento pronto para revisar</strong>
              <span>{'Edite livremente abaixo; a cópia leva o texto ajustado.'}</span>
            </div>
            <div className="referral-letter-output-actions">
              <div
                className="case-style-toggle"
                role="group"
                aria-label="Estilo de escrita da carta"
                title="Alternar entre texto normal (Aa) e tudo em maiúsculas (AA)"
              >
                <button
                  type="button"
                  className={`case-style-option ${caseStyle === 'mixed' ? 'active' : ''}`}
                  onClick={() => setCaseStyle('mixed')}
                >
                  Aa
                </button>
                <button
                  type="button"
                  className={`case-style-option ${caseStyle === 'upper' ? 'active' : ''}`}
                  onClick={() => setCaseStyle('upper')}
                >
                  AA
                </button>
              </div>
              <button
                type="button"
                className={`btn btn-copiar btn-copiar-inline ${copied ? 'copiado' : ''}`}
                onClick={() => onCopy(caseStyle === 'upper' ? letter.toLocaleUpperCase('pt-BR') : letter)}
              >
                {copied ? 'Copiado!' : 'Copiar documento'}
              </button>
            </div>
          </div>
          <textarea
            ref={outputRef}
            className={`referral-letter-text referral-letter-editable ${caseStyle === 'upper' ? 'is-upper' : ''}`}
            value={letter}
            onChange={(event) => onLetterChange(event.target.value)}
            onCopy={(event) => handleUppercaseCopy(event, caseStyle === 'upper')}
            spellCheck
          />
        </div>
      )}
    </section>
  );
}

export default LetterGeneratorCard;

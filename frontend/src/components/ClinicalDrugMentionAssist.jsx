import { useEffect } from 'react';

function normalizeDisplayText(value) {
  return String(value || '').trim();
}

function getDrugTitle(drug, slug = '') {
  return drug?.activeIngredient || slug.replace(/-/g, ' ') || 'Medicamento';
}

function getDrugSubtitle(drug) {
  return [
    drug?.classCategory,
    drug?.pregnancyRisk ? `Gestação ${drug.pregnancyRisk}` : '',
  ].filter(Boolean).join(' · ');
}

function getRiskClass(value) {
  const normalized = normalizeDisplayText(value).toUpperCase();

  if (['D', 'X', 'EVITAR'].includes(normalized)) {
    return 'danger';
  }

  if (['A', 'B'].includes(normalized)) {
    return 'success';
  }

  if (['C', 'INDEFINIDO'].includes(normalized)) {
    return 'warning';
  }

  return '';
}

function ClinicalDrugAutocomplete({ mention }) {
  const {
    highlightedIndex,
    insertDrugMention,
    loadingResults,
    results,
    searchError,
    setHighlightedIndex,
    trigger,
  } = mention;

  if (!trigger) {
    return null;
  }

  const query = trigger.query.trim();
  const shouldTypeMore = query.length === 1;

  return (
    <div className="drug-mention-popover" role="listbox" aria-label="Sugestões de medicamentos">
      <div className="drug-mention-popover-header">
        <strong>Inserir medicamento</strong>
        <span>{trigger.type === 'command' ? '/remedio' : '@'} busca no Bulário</span>
      </div>

      {shouldTypeMore ? (
        <div className="drug-mention-empty">Digite mais um caractere para buscar.</div>
      ) : loadingResults ? (
        <div className="drug-mention-empty">Buscando medicamentos...</div>
      ) : searchError ? (
        <div className="drug-mention-empty">{searchError}</div>
      ) : results.length > 0 ? (
        <div className="drug-mention-results">
          {results.map((drug, index) => (
            <button
              key={drug.slug}
              type="button"
              className={`drug-mention-result ${index === highlightedIndex ? 'active' : ''}`}
              onClick={() => insertDrugMention(drug)}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlightedIndex(index)}
              role="option"
              aria-selected={index === highlightedIndex}
            >
              <span>
                <strong>{getDrugTitle(drug)}</strong>
                <small>{getDrugSubtitle(drug) || 'Medicamento publicado'}</small>
              </span>
              {drug.pregnancyRisk ? (
                <em className={`drug-risk-pill ${getRiskClass(drug.pregnancyRisk)}`}>
                  {drug.pregnancyRisk}
                </em>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="drug-mention-empty">Nenhum medicamento encontrado.</div>
      )}
    </div>
  );
}

function DetectedDrugChips({ mention }) {
  const { detectedMentions, loadingActiveDrug, openDrugDetail } = mention;

  if (!detectedMentions.length) {
    return null;
  }

  return (
    <div className="drug-detected-panel">
      <div className="drug-detected-header">
        <span>Medicamentos detectados</span>
        {loadingActiveDrug ? <small>Carregando detalhes...</small> : null}
      </div>
      <div className="drug-detected-list">
        {detectedMentions.map(({ slug, drug }) => (
          <button
            key={slug}
            type="button"
            className="drug-detected-chip"
            onClick={() => openDrugDetail(slug)}
          >
            <strong>{getDrugTitle(drug, slug)}</strong>
            {drug?.pregnancyRisk ? (
              <span className={`drug-risk-dot ${getRiskClass(drug.pregnancyRisk)}`}>
                {drug.pregnancyRisk}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickSection({ title, text, empty = 'Campo ainda não preenchido no Bulário.' }) {
  const content = normalizeDisplayText(text);

  return (
    <details className="clinical-drug-quick-section">
      <summary>{title}</summary>
      <div className="clinical-drug-quick-section-content">
        {content ? <pre>{content}</pre> : <p>{empty}</p>}
      </div>
    </details>
  );
}

function ClinicalDrugQuickModal({ drug, onClose }) {
  const source = normalizeDisplayText(drug?.sourceBula || drug?.pdfFile);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={onClose}>
      <article
        className="app-modal-card clinical-drug-quick-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clinical-drug-quick-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="app-modal-header">
          <div>
            <span className="clinical-drug-eyebrow">Consulta rápida</span>
            <h2 id="clinical-drug-quick-title">{getDrugTitle(drug)}</h2>
            <p>{getDrugSubtitle(drug) || 'Informações essenciais do Bulário Clínico.'}</p>
          </div>
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Fechar
          </button>
        </header>

        <div className="clinical-drug-quick-meta">
          {drug?.pregnancyRisk ? (
            <span className={`protocol-status-badge ${getRiskClass(drug.pregnancyRisk)}`}>
              Risco gestacional {drug.pregnancyRisk}
            </span>
          ) : null}
        </div>

        <div className="clinical-drug-quick-scroll">
          <QuickSection title="Resumo" text={drug?.summaryText} />
          <QuickSection title="Posologia adulto" text={drug?.adultDosage} />
          <QuickSection title="Posologia pediátrica" text={drug?.pediatricDosage} />
          <QuickSection title="Contraindicações" text={drug?.contraindications} />
          <QuickSection title="Advertências" text={drug?.warnings} />
          <QuickSection title="Interações" text={drug?.interactions} />

          {source ? (
            <details className="clinical-drug-quick-source">
              <summary>Fonte</summary>
              {/^https?:\/\//i.test(source) ? (
                <a href={source} target="_blank" rel="noreferrer">{source}</a>
              ) : (
                <span>{source}</span>
              )}
            </details>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function ClinicalDrugMentionAssist({ enabled, mention, onOpenCatalog }) {
  if (!enabled) {
    return null;
  }

  return (
    <>
      <ClinicalDrugAutocomplete mention={mention} />

      <div className="drug-mention-helper-row">
        <span>Digite <strong>@</strong> ou <strong>/remedio</strong> para inserir medicamentos do Bulário.</span>
        {onOpenCatalog ? (
          <button type="button" onClick={onOpenCatalog}>
            Abrir Bulário
          </button>
        ) : null}
      </div>

      <DetectedDrugChips mention={mention} />

      {mention.activeDrug ? (
        <ClinicalDrugQuickModal drug={mention.activeDrug} onClose={mention.closeActiveDrug} />
      ) : null}
    </>
  );
}

export default ClinicalDrugMentionAssist;

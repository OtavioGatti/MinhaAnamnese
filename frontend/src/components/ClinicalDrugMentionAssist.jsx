import { useEffect, useState } from 'react';

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

function getDrugPresentationText(drug) {
  return [
    drug?.presentations,
    drug?.commercialNamesAnvisa,
    drug?.commercialNamesOpenai,
  ]
    .map(normalizeDisplayText)
    .filter(Boolean)
    .join('\n');
}

function getDrugSourceText(drug) {
  return [
    drug?.sourceBula,
    drug?.pdfFile,
  ]
    .map(normalizeDisplayText)
    .filter(Boolean)
    .join('\n');
}

function getShortText(value, maxLength = 180) {
  const text = normalizeDisplayText(value).replace(/\s+/g, ' ');

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function splitDisplayLines(value) {
  return normalizeDisplayText(value)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
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

function normalizeSearchText(value) {
  return normalizeDisplayText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitDrugAliasCandidates(value) {
  const text = normalizeDisplayText(value);

  if (!text) {
    return [];
  }

  return [
    text,
    ...text.split(/\r?\n|;|,|\s+\+\s+|\s+\/\s+/),
  ];
}

function getDrugInteractionAliases(drug, slug = '') {
  const aliases = [
    slug,
    slug.replace(/-/g, ' '),
    drug?.slug,
    drug?.slug?.replace(/-/g, ' '),
    drug?.activeIngredient,
    drug?.commercialNamesAnvisa,
    drug?.commercialNamesOpenai,
  ]
    .flatMap(splitDrugAliasCandidates)
    .map(normalizeSearchText)
    .filter((alias) => alias.length >= 3 && /[a-z]/.test(alias));

  return Array.from(new Set(aliases));
}

function interactionTextMentionsDrug(interactionText, aliases) {
  const normalizedText = normalizeSearchText(interactionText);

  if (!normalizedText || aliases.length === 0) {
    return false;
  }

  return aliases.some((alias) => {
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(alias)}($|\\s)`);
    return pattern.test(normalizedText);
  });
}

function getReadyDrugMentions(detectedMentions) {
  return detectedMentions.filter(({ drug, status }) => status === 'ready' && drug);
}

function buildPregnancyRiskAlerts(readyMentions) {
  return readyMentions.flatMap(({ slug, drug }) => {
    const pregnancyRisk = normalizeDisplayText(drug.pregnancyRisk).toUpperCase();

    if (!['C', 'D', 'X'].includes(pregnancyRisk)) {
      return [];
    }

    const riskClass = pregnancyRisk === 'C' ? 'warning' : 'danger';
    const title = pregnancyRisk === 'C'
      ? 'Risco gestacional a revisar'
      : 'Risco gestacional alto';

    return [{
      id: `${slug}-pregnancy-${pregnancyRisk.toLowerCase()}`,
      slug,
      severity: riskClass,
      title,
      message: `${getDrugTitle(drug, slug)}: risco ${pregnancyRisk}. Revise gestação, bula e alternativa terapêutica antes de usar.`,
    }];
  });
}

function buildInteractionPairAlerts(readyMentions) {
  const alerts = [];

  for (let index = 0; index < readyMentions.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < readyMentions.length; nextIndex += 1) {
      const first = readyMentions[index];
      const second = readyMentions[nextIndex];
      const firstAliases = getDrugInteractionAliases(first.drug, first.slug);
      const secondAliases = getDrugInteractionAliases(second.drug, second.slug);
      const firstMentionsSecond = interactionTextMentionsDrug(
        first.drug?.interactions,
        secondAliases,
      );
      const secondMentionsFirst = interactionTextMentionsDrug(
        second.drug?.interactions,
        firstAliases,
      );

      if (!firstMentionsSecond && !secondMentionsFirst) {
        continue;
      }

      const firstTitle = getDrugTitle(first.drug, first.slug);
      const secondTitle = getDrugTitle(second.drug, second.slug);
      const pairKey = [first.slug, second.slug].sort().join('-');

      alerts.push({
        id: `${pairKey}-interaction`,
        slug: firstMentionsSecond ? first.slug : second.slug,
        severity: 'warning',
        title: 'Possível interação medicamentosa',
        message: `${firstTitle} + ${secondTitle}: há interação cadastrada no Bulário. Revise antes de prescrever.`,
      });
    }
  }

  return alerts;
}

function buildClinicalDrugAlerts(detectedMentions) {
  const readyMentions = getReadyDrugMentions(detectedMentions);

  return [
    ...buildPregnancyRiskAlerts(readyMentions),
    ...buildInteractionPairAlerts(readyMentions),
  ];
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
        <span>@ busca no Bulário</span>
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
                <small>
                  @{drug.slug}{getDrugSubtitle(drug) ? ` · ${getDrugSubtitle(drug)}` : ''}
                </small>
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
        {detectedMentions.map(({ slug, drug, status }) => {
          const isMissing = status === 'missing';
          const isLoading = status === 'loading' || status === 'pending';
          const subtitle = drug
            ? getDrugSubtitle(drug) || 'Medicamento no Bulário'
            : isMissing
              ? 'Não encontrado no Bulário'
              : 'Carregando dados do Bulário';

          return (
            <button
              key={slug}
              type="button"
              className={`drug-detected-chip ${isMissing ? 'missing' : ''} ${isLoading ? 'loading' : ''}`}
              onClick={() => openDrugDetail(slug)}
              disabled={isMissing}
            >
              <span className="drug-detected-chip-copy">
                <strong>{getDrugTitle(drug, slug)}</strong>
                <small>{subtitle}</small>
              </span>
              {drug?.pregnancyRisk ? (
                <span className={`drug-risk-dot ${getRiskClass(drug.pregnancyRisk)}`}>
                  {drug.pregnancyRisk}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ClinicalDrugSafetyAlerts({ mention }) {
  const { detectedMentions, openDrugDetail } = mention;
  const alerts = buildClinicalDrugAlerts(detectedMentions);

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="drug-safety-alert-panel" aria-live="polite">
      <div className="drug-safety-alert-header">
        <span>Atenção clínica</span>
        <small>Alertas informativos, sem bloqueio do fluxo.</small>
      </div>

      <div className="drug-safety-alert-list">
        {alerts.map((alert) => (
          <button
            key={alert.id}
            type="button"
            className={`drug-safety-alert-item ${alert.severity}`}
            onClick={() => openDrugDetail(alert.slug)}
          >
            <span>{alert.title}</span>
            <p>{alert.message}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickHighlight({ title, text, empty }) {
  const content = normalizeDisplayText(text);

  return (
    <div className="clinical-drug-quick-highlight">
      <span>{title}</span>
      <p>{content ? getShortText(content) : empty}</p>
    </div>
  );
}

function QuickSection({
  title,
  text,
  empty = 'Campo ainda não preenchido no Bulário.',
  expanded,
  onToggle,
}) {
  const content = normalizeDisplayText(text);

  return (
    <section className="clinical-drug-quick-section">
      <button
        type="button"
        className="clinical-drug-quick-section-trigger"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="clinical-drug-quick-section-title">
          <span className="protocol-chevron">{expanded ? '▾' : '▸'}</span>
          {title}
        </span>
      </button>

      {expanded ? (
        <div className="clinical-drug-quick-section-content">
          {content ? <pre>{content}</pre> : <p>{empty}</p>}
        </div>
      ) : null}
    </section>
  );
}

function QuickSourceSection({ items, expanded, onToggle }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="clinical-drug-quick-source">
      <button
        type="button"
        className="clinical-drug-quick-section-trigger"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="clinical-drug-quick-section-title">
          <span className="protocol-chevron">{expanded ? '▾' : '▸'}</span>
          Fonte
        </span>
      </button>

      {expanded ? (
        <div className="clinical-drug-quick-section-content clinical-drug-quick-source-content">
          {items.map((item, index) => (
            /^https?:\/\//i.test(item) ? (
              <a href={item} target="_blank" rel="noreferrer" key={`${item}-${index}`}>{item}</a>
            ) : (
              <span key={`${item}-${index}`}>{item}</span>
            )
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ClinicalDrugQuickModal({ drug, onClose, onOpenCatalog }) {
  const source = getDrugSourceText(drug);
  const sourceItems = splitDisplayLines(source);
  const presentations = getDrugPresentationText(drug);
  const hasMeta = Boolean(drug?.pregnancyRisk || drug?.classCategory);
  const [expandedSections, setExpandedSections] = useState({});

  function toggleQuickSection(key) {
    setExpandedSections((currentSections) => ({
      ...currentSections,
      [key]: !currentSections[key],
    }));
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setExpandedSections({});
  }, [drug?.slug]);

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

        <div className="clinical-drug-quick-body">
          <div className="clinical-drug-quick-meta">
            {drug?.classCategory ? (
              <span className="protocol-meta-chip">
                {drug.classCategory}
              </span>
            ) : null}
            {drug?.pregnancyRisk ? (
              <span className={`protocol-status-badge ${getRiskClass(drug.pregnancyRisk)}`}>
                Risco gestacional {drug.pregnancyRisk}
              </span>
            ) : null}
            {!hasMeta ? <span className="protocol-meta-chip">Bulário clínico</span> : null}
          </div>

          <div className="clinical-drug-quick-highlights">
            <QuickHighlight
              title="Posologia adulto"
              text={drug?.adultDosage}
              empty="Sem posologia adulta preenchida."
            />
            <QuickHighlight
              title="Contraindicações"
              text={drug?.contraindications}
              empty="Sem contraindicações preenchidas."
            />
          </div>

          <div className="clinical-drug-quick-sections">
            <QuickSection
              title="Resumo"
              text={drug?.summaryText}
              expanded={Boolean(expandedSections.summary)}
              onToggle={() => toggleQuickSection('summary')}
            />
            <QuickSection
              title="Posologia adulto"
              text={drug?.adultDosage}
              expanded={Boolean(expandedSections.adultDosage)}
              onToggle={() => toggleQuickSection('adultDosage')}
            />
            <QuickSection
              title="Posologia pediátrica"
              text={drug?.pediatricDosage}
              expanded={Boolean(expandedSections.pediatricDosage)}
              onToggle={() => toggleQuickSection('pediatricDosage')}
            />
            <QuickSection
              title="Contraindicações"
              text={drug?.contraindications}
              expanded={Boolean(expandedSections.contraindications)}
              onToggle={() => toggleQuickSection('contraindications')}
            />
            <QuickSection
              title="Advertências"
              text={drug?.warnings}
              expanded={Boolean(expandedSections.warnings)}
              onToggle={() => toggleQuickSection('warnings')}
            />
            <QuickSection
              title="Interações"
              text={drug?.interactions}
              expanded={Boolean(expandedSections.interactions)}
              onToggle={() => toggleQuickSection('interactions')}
            />
            <QuickSection
              title="Apresentações / nomes comerciais"
              text={presentations}
              expanded={Boolean(expandedSections.presentations)}
              onToggle={() => toggleQuickSection('presentations')}
            />
            <QuickSourceSection
              items={sourceItems}
              expanded={Boolean(expandedSections.source)}
              onToggle={() => toggleQuickSection('source')}
            />
          </div>
        </div>

        <footer className="clinical-drug-quick-actions">
          {onOpenCatalog ? (
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => {
                onClose();
                onOpenCatalog();
              }}
            >
              Abrir Bulário completo
            </button>
          ) : null}
          <button type="button" className="btn btn-primario" onClick={onClose}>
            Continuar escrevendo
          </button>
        </footer>
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
        <span>Digite <strong>@</strong> para inserir medicamentos do Bulário.</span>
        {onOpenCatalog ? (
          <button type="button" onClick={onOpenCatalog}>
            Abrir Bulário
          </button>
        ) : null}
      </div>

      <DetectedDrugChips mention={mention} />
      <ClinicalDrugSafetyAlerts mention={mention} />

      {mention.activeDrug ? (
        <ClinicalDrugQuickModal
          drug={mention.activeDrug}
          onClose={mention.closeActiveDrug}
          onOpenCatalog={onOpenCatalog}
        />
      ) : null}
    </>
  );
}

export default ClinicalDrugMentionAssist;

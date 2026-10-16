import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  buildSectionsByTab,
  DRUG_TABS,
  ESSENTIAL_SECTION_KEYS,
  getEssentialSections,
  getPregnancyLabel,
  getPregnancyRiskClass,
} from '../lib/clinicalDrugDisplay';
import { ClinicalDrugSection, ClinicalDrugSectionBody, ReferenceList, ReviewNotice } from './ClinicalDrugBlocks';

// Folga entre a linha do cursor e a caixa, para não encostar no texto.
const CARET_GAP_PX = 6;

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

const PHARMACEUTICAL_SUFFIX_WORDS = new Set([
  'acido',
  'acetato',
  'anhidro',
  'base',
  'besilato',
  'brometo',
  'bromidrato',
  'calcio',
  'cloridrato',
  'cloreto',
  'de',
  'di',
  'dihidratado',
  'dissodico',
  'fosfato',
  'hemihidratado',
  'hidrobrometo',
  'hidrocloreto',
  'magnesio',
  'maleato',
  'mesilato',
  'monoidratado',
  'nitrato',
  'potassico',
  'sodico',
  'succinato',
  'sulfato',
]);

const INTERACTION_ALIAS_STOPWORDS = new Set([
  'analgesico',
  'analgesicos',
  'analgesico opioide',
  'anti inflamatorio',
  'antiinflamatorio',
  'antiinflamatorios',
  'antibiotico',
  'antibioticos',
  'antidepressivo',
  'antidepressivos',
  'antitermico',
  'antitermicos',
  'antiviral',
  'antivirais',
  'capsula',
  'comprimido',
  'comprimidos',
  'dor',
  'fraco',
  'generico',
  'genericos',
  'moderada',
  'opioide',
  'opioides',
  'suspensao',
  'xarope',
]);

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

function getReducedDrugAlias(alias) {
  const parts = normalizeSearchText(alias)
    .split(' ')
    .filter((part) => part && !PHARMACEUTICAL_SUFFIX_WORDS.has(part));

  return parts.join(' ').trim();
}

function isUsefulInteractionAlias(alias) {
  return alias.length >= 3 &&
    /[a-z]/.test(alias) &&
    !INTERACTION_ALIAS_STOPWORDS.has(alias);
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
    .flatMap((alias) => [
      normalizeSearchText(alias),
      getReducedDrugAlias(alias),
    ])
    .filter(isUsefulInteractionAlias);

  return Array.from(new Set(aliases));
}

function normalizeSlug(value) {
  return normalizeDisplayText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

function getDrugStructuredInteractionPairs(drug) {
  const pairs = drug?.interactionPairs;

  if (Array.isArray(pairs)) {
    return pairs;
  }

  if (typeof pairs === 'string' && pairs.trim()) {
    try {
      const parsed = JSON.parse(pairs);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  return [];
}

function getInteractionPairTargetSlug(pair) {
  return pair?.targetSlug ||
    pair?.target_slug ||
    pair?.drugSlug ||
    pair?.drug_slug ||
    pair?.slug ||
    '';
}

function interactionPairNeedsReview(pair) {
  return pair?.needsReview === true || pair?.needs_review === true;
}

function normalizeInteractionSeverity(value) {
  const severity = normalizeDisplayText(value).toLowerCase();

  if (['danger', 'high', 'grave', 'contraindicated', 'contraindicado'].includes(severity)) {
    return 'danger';
  }

  if (['info', 'low', 'baixo'].includes(severity)) {
    return 'info';
  }

  return 'warning';
}

function getInteractionSeverityRank(severity) {
  if (severity === 'danger') {
    return 3;
  }

  if (severity === 'warning') {
    return 2;
  }

  return 1;
}

function findStructuredInteractionPair(source, targetSlug) {
  const normalizedTargetSlug = normalizeSlug(targetSlug);

  if (!normalizedTargetSlug) {
    return null;
  }

  return getDrugStructuredInteractionPairs(source.drug).find((pair) => {
    if (!pair || interactionPairNeedsReview(pair)) {
      return false;
    }

    return normalizeSlug(getInteractionPairTargetSlug(pair)) === normalizedTargetSlug;
  }) || null;
}

function buildStructuredInteractionAlert({
  first,
  firstTitle,
  second,
  secondTitle,
  structuredPair,
  structuredPairOwner,
}) {
  const pairKey = [first.slug, second.slug].sort().join('-');
  const severity = normalizeInteractionSeverity(structuredPair?.severity);
  const mechanism = normalizeDisplayText(structuredPair?.mechanism);
  const message = normalizeDisplayText(structuredPair?.message) ||
    `${firstTitle} + ${secondTitle}: ${mechanism || 'interação medicamentosa documentada no Bulário'}. Revise antes de prescrever.`;

  return {
    id: `${pairKey}-structured-interaction`,
    slug: structuredPairOwner.slug,
    severity,
    title: severity === 'danger' ? 'Interação medicamentosa relevante' : 'Possível interação medicamentosa',
    message,
  };
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
      const firstTitle = getDrugTitle(first.drug, first.slug);
      const secondTitle = getDrugTitle(second.drug, second.slug);
      const pairKey = [first.slug, second.slug].sort().join('-');
      const firstStructuredPair = findStructuredInteractionPair(first, second.slug);
      const secondStructuredPair = findStructuredInteractionPair(second, first.slug);

      if (firstStructuredPair || secondStructuredPair) {
        const firstStructuredSeverity = normalizeInteractionSeverity(firstStructuredPair?.severity);
        const secondStructuredSeverity = normalizeInteractionSeverity(secondStructuredPair?.severity);
        const useSecondStructuredPair =
          secondStructuredPair &&
          (
            !firstStructuredPair ||
            getInteractionSeverityRank(secondStructuredSeverity) > getInteractionSeverityRank(firstStructuredSeverity)
          );

        alerts.push(buildStructuredInteractionAlert({
          first,
          firstTitle,
          second,
          secondTitle,
          structuredPair: useSecondStructuredPair ? secondStructuredPair : firstStructuredPair,
          structuredPairOwner: useSecondStructuredPair ? second : first,
        }));
        continue;
      }

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

export function ClinicalDrugAutocomplete({ mention }) {
  const {
    highlightedIndex,
    insertDrugMention,
    loadingResults,
    results,
    searchError,
    setHighlightedIndex,
    trigger,
  } = mention;

  const popoverRef = useRef(null);
  const [topPx, setTopPx] = useState(null);
  const caret = trigger?.caret || null;

  // Decide embaixo/em cima com a altura REAL da caixa, depois do layout e antes
  // da pintura — medir no useEffect faria a lista aparecer embaixo e pular para
  // cima, visivelmente. A altura muda conforme os resultados chegam, por isso a
  // contagem entra nas dependências.
  useLayoutEffect(() => {
    const node = popoverRef.current;

    if (!node || !caret) {
      return;
    }

    const textarea = node.closest('.textarea-shell')?.querySelector('textarea');

    if (!textarea) {
      return;
    }

    const popoverHeight = node.offsetHeight;
    const field = textarea.getBoundingClientRect();
    const caretTopOnScreen = field.top + caret.top;

    // Compara o espaço realmente utilizável acima e abaixo da linha do cursor.
    // "Utilizável" é a interseção do campo com a viewport: o campo pode estar
    // cortado pela tela, e caber dentro dele não garante estar visível.
    const usableBottom = Math.min(field.bottom, window.innerHeight);
    const usableTop = Math.max(field.top, 0);
    const spaceBelow = usableBottom - (caretTopOnScreen + caret.lineHeight + CARET_GAP_PX);
    const spaceAbove = caretTopOnScreen - CARET_GAP_PX - usableTop;

    // Vira para cima só se não couber embaixo E lá em cima houver mais espaço —
    // assim uma folga pequena embaixo não provoca uma virada que piora a vida.
    const placeAbove = spaceBelow < popoverHeight && spaceAbove > spaceBelow;
    const desiredTop = placeAbove
      ? caret.top - CARET_GAP_PX - popoverHeight
      : caret.top + caret.lineHeight + CARET_GAP_PX;

    // Trava dentro do campo: se o cursor estiver fora da área visível (campo
    // rolado, texto colado de uma vez), a conta acima cairia fora do textarea e
    // a lista apareceria solta na página.
    const maxTop = Math.max(0, textarea.clientHeight - popoverHeight);
    setTopPx(Math.round(Math.min(Math.max(desiredTop, 0), maxTop)));
  }, [caret, results.length, loadingResults, searchError]);

  if (!trigger) {
    return null;
  }

  const query = trigger.query.trim();
  const shouldTypeMore = query.length === 1;
  const positionStyle = caret && topPx !== null ? { top: `${topPx}px` } : undefined;

  return (
    <div
      className="drug-mention-popover"
      ref={popoverRef}
      style={positionStyle}
      role="listbox"
      aria-label="Sugestões de medicamentos"
    >
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

// Consulta rápida aberta durante a escrita: o essencial para prescrever fica
// aberto e inteiro no topo (nunca cortar posologia no meio da dose); o resto
// da bula vem nas mesmas abas da página do Bulário, com as seções fechadas.
function ClinicalDrugQuickModal({ drug, onClose, onOpenCatalog }) {
  const [activeTab, setActiveTab] = useState('principal');
  const [expanded, setExpanded] = useState({});
  const essentials = getEssentialSections(drug);
  const sectionsByTab = buildSectionsByTab(drug, { exclude: ESSENTIAL_SECTION_KEYS });
  const visibleTabs = DRUG_TABS.filter((tab) => sectionsByTab[tab.id].length > 0);
  const currentTab = visibleTabs.some((tab) => tab.id === activeTab) ? activeTab : visibleTabs[0]?.id;
  const visibleSections = currentTab ? sectionsByTab[currentTab] : [];
  const pregnancy = getPregnancyLabel(drug);

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
    setExpanded({});
    setActiveTab('principal');
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
          </div>
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Fechar
          </button>
        </header>

        <div className="clinical-drug-quick-body">
          <div className="clinical-drug-quick-meta">
            {drug?.classCategory ? <span className="protocol-meta-chip">{drug.classCategory}</span> : null}
            {pregnancy ? (
              <span className={`protocol-status-badge ${getPregnancyRiskClass(drug)}`}>Gestação: {pregnancy}</span>
            ) : null}
            <ReviewNotice drug={drug} compact />
          </div>

          <section className="clinical-drug-quick-essentials" aria-label="Essencial para prescrever">
            {essentials.map((section) => (
              <div className="clinical-drug-quick-essential" key={section.key}>
                <span>{section.title}</span>
                {section.text ? (
                  <ClinicalDrugSectionBody title={section.title} text={section.text} />
                ) : (
                  <p className="clinical-drug-quick-empty">Ainda não preenchido no Bulário.</p>
                )}
              </div>
            ))}
          </section>

          {visibleTabs.length > 0 ? (
            <>
              <div className="prescription-section-tabs clinical-drug-quick-tabs" role="tablist" aria-label="Seções da bula">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={currentTab === tab.id}
                    className={`prescription-section-tab ${currentTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                    <span className="clinical-drug-tab-count">{sectionsByTab[tab.id].length}</span>
                  </button>
                ))}
              </div>

              <div className="clinical-drug-section-list">
                {visibleSections.map((section) => (
                  <ClinicalDrugSection
                    key={section.key}
                    title={section.title}
                    text={section.text}
                    expanded={Boolean(expanded[section.key])}
                    onToggle={() => setExpanded((current) => ({ ...current, [section.key]: !current[section.key] }))}
                  />
                ))}
              </div>
            </>
          ) : null}

          <ReferenceList drug={drug} />
        </div>

        <div className="clinical-drug-quick-disclaimer">
          Conteúdo apenas informativo e de apoio. Confirme bula oficial, contraindicações, alergias, gestação,
          interações, função renal/hepática e protocolo local antes de qualquer uso assistencial.
        </div>

        <footer className="clinical-drug-quick-actions">
          {onOpenCatalog ? (
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => {
                onClose();
                onOpenCatalog(drug?.slug);
              }}
            >
              Abrir bula completa
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
      <div className="drug-mention-helper-row">
        <span>Digite <strong>@</strong> para inserir medicamentos do Bulário.</span>
        {onOpenCatalog ? (
          <button type="button" onClick={() => onOpenCatalog()}>
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

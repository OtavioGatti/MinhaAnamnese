import { useEffect, useMemo, useState } from 'react';
import { api } from '../apiClient';

const DEFAULT_QUERY = '';
const SEARCH_DEBOUNCE_MS = 320;

const SECTION_DEFINITIONS = [
  {
    key: 'summaryText',
    title: 'Resumo clínico',
    empty: 'Resumo ainda não preenchido no CMS.',
  },
  {
    key: 'adultDosage',
    title: 'Posologia adulto',
    empty: 'Posologia adulto ainda não preenchida.',
  },
  {
    key: 'pediatricDosage',
    title: 'Posologia pediátrica',
    empty: 'Posologia pediátrica ainda não preenchida.',
  },
  {
    key: 'contraindications',
    title: 'Contraindicações',
    empty: 'Contraindicações ainda não preenchidas.',
  },
  {
    key: 'warnings',
    title: 'Advertências',
    empty: 'Advertências ainda não preenchidas.',
  },
  {
    key: 'interactions',
    title: 'Interações',
    empty: 'Interações ainda não preenchidas.',
  },
  {
    key: 'presentations',
    title: 'Apresentações / nomes comerciais',
    empty: 'Apresentações ainda não preenchidas.',
  },
];

function normalizeDisplayText(value) {
  return String(value || '').trim();
}

function getDrugTitle(drug) {
  return drug?.activeIngredient || 'Medicamento';
}

function getCommercialNames(drug) {
  return [
    drug?.commercialNamesAnvisa,
    drug?.commercialNamesOpenai,
    drug?.presentations,
  ]
    .map(normalizeDisplayText)
    .filter(Boolean)
    .join('\n');
}

function getDrugMetaParts(drug) {
  return [
    drug?.classCategory,
    drug?.pregnancyRisk ? `Gestação ${drug.pregnancyRisk}` : '',
  ].filter(Boolean);
}

function splitListText(value) {
  const text = normalizeDisplayText(value);

  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n|;/)
    .map((item) => item.replace(/^\s*[-•]\s*/, '').trim())
    .filter(Boolean);
}

function isLikelyList(value) {
  const text = normalizeDisplayText(value);
  const items = splitListText(text);

  return items.length > 1 && (text.includes('\n') || text.includes(';') || /^\s*[-•]/.test(text));
}

function getPregnancyRiskClass(value) {
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

function getSourceUrl(drug) {
  const candidates = [drug?.sourceBula, drug?.pdfFile].map(normalizeDisplayText);
  return candidates.find((value) => /^https?:\/\//i.test(value)) || '';
}

function ClinicalDrugSidebar({
  query,
  setQuery,
  drugs,
  selectedSlug,
  setSelectedSlug,
  loadingDrugs,
  error,
}) {
  return (
    <aside className="protocol-sidebar clinical-drug-sidebar">
      <label className="protocol-search-label" htmlFor="clinical-drug-search">
        Buscar medicamento
      </label>
      <input
        id="clinical-drug-search"
        className="protocol-search-input"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedSlug('');
        }}
        placeholder="Ex: prednisona, GLP-1, topiramato"
      />

      {error ? <div className="prescription-error">{error}</div> : null}

      <div className="protocol-results-list" aria-live="polite">
        {loadingDrugs ? (
          <div className="prescription-empty">Buscando medicamentos...</div>
        ) : drugs.length > 0 ? (
          drugs.map((drug) => (
            <button
              key={drug.slug}
              type="button"
              className={`protocol-result-item ${drug.slug === selectedSlug ? 'active' : ''}`}
              onClick={() => setSelectedSlug(drug.slug)}
            >
              <strong>{getDrugTitle(drug)}</strong>
              <span>{getDrugMetaParts(drug).join(' · ') || 'Bulário clínico'}</span>
            </button>
          ))
        ) : (
          <div className="prescription-empty">Nenhum medicamento encontrado.</div>
        )}
      </div>
    </aside>
  );
}

function createExpandedSectionsState(expanded = true) {
  return SECTION_DEFINITIONS.reduce((accumulator, definition) => ({
    ...accumulator,
    [definition.key]: expanded,
  }), {});
}

function ClinicalDrugSection({ title, text, empty, expanded, onToggle }) {
  const content = normalizeDisplayText(text);

  return (
    <section className="clinical-drug-section">
      <button
        type="button"
        className="clinical-drug-section-trigger"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span>
          <span className="protocol-chevron">{expanded ? '▾' : '▸'}</span>
          {title}
        </span>
      </button>

      {expanded ? (
        <div className="clinical-drug-section-content">
          {content ? (
            isLikelyList(content) ? (
              <ul className="protocol-simple-list">
                {splitListText(content).map((item, index) => (
                  <li key={`${title}-${item}-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <pre>{content}</pre>
            )
          ) : (
            <div className="protocol-section-empty">{empty}</div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function ClinicalDrugHeader({ drug }) {
  const sourceUrl = getSourceUrl(drug);
  const riskClass = getPregnancyRiskClass(drug?.pregnancyRisk);

  return (
    <header className="protocol-header clinical-drug-detail-header">
      <div className="protocol-header-copy">
        <span className="clinical-drug-eyebrow">Bulário clínico</span>
        <h2>{getDrugTitle(drug)}</h2>

        <div className="protocol-header-meta">
          {drug?.classCategory ? (
            <div className="protocol-meta-group">
              <span>Classe / categoria</span>
              <strong>{drug.classCategory}</strong>
            </div>
          ) : null}

          <div className="protocol-meta-chips">
            {drug?.pregnancyRisk ? (
              <span className={`protocol-status-badge ${riskClass}`}>
                Risco gestacional {drug.pregnancyRisk}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {sourceUrl ? (
        <div className="clinical-drug-actions">
          <a
            className="btn btn-secundario clinical-drug-source-link"
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Abrir fonte
          </a>
        </div>
      ) : null}
    </header>
  );
}

function SafetyNotice() {
  return (
    <div className="protocol-safety-notice">
      <strong>Uso clínico seguro:</strong>
      <span>
        Confira alergias, gestação, idade, peso, função renal/hepática, interações e bula oficial antes de prescrever.
      </span>
    </div>
  );
}

function ClinicalDrugPage({
  user,
  isPro,
  accessState,
  onLogin,
  onRequestUpgrade,
  loadingCheckout,
  checkoutError,
}) {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [drugs, setDrugs] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [loadingDrugs, setLoadingDrugs] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState(() => createExpandedSectionsState(true));

  useEffect(() => {
    if (!user?.id || !isPro) {
      setDrugs([]);
      setSelectedDrug(null);
      setSelectedSlug('');
      setLoadingDrugs(false);
      setLoadingDetail(false);
      return undefined;
    }

    let ignore = false;
    const timeoutId = window.setTimeout(async () => {
      setLoadingDrugs(true);
      setError('');

      const params = new URLSearchParams({
        q: query.trim(),
        limit: query.trim() ? '80' : '250',
      });
      const response = await api.get(`/clinical-drugs?${params.toString()}`);

      if (ignore) {
        return;
      }

      if (response.success && Array.isArray(response.data)) {
        setDrugs(response.data);
        if (!selectedSlug && response.data[0]?.slug) {
          setSelectedSlug(response.data[0].slug);
        }
      } else {
        setDrugs([]);
        setError(response.error || 'Não foi possível buscar o bulário clínico.');
      }

      setLoadingDrugs(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [isPro, query, selectedSlug, user?.id]);

  useEffect(() => {
    if (!user?.id || !isPro || !selectedSlug) {
      setSelectedDrug(null);
      return undefined;
    }

    let ignore = false;

    async function loadDrugDetail() {
      setLoadingDetail(true);
      setError('');
      const response = await api.get(`/clinical-drugs?slug=${encodeURIComponent(selectedSlug)}`);

      if (ignore) {
        return;
      }

      if (response.success && response.data) {
        setSelectedDrug(response.data);
        setExpandedSections(createExpandedSectionsState(true));
      } else {
        setSelectedDrug(null);
        setError(response.error || 'Não foi possível abrir este medicamento.');
      }

      setLoadingDetail(false);
    }

    loadDrugDetail();

    return () => {
      ignore = true;
    };
  }, [isPro, selectedSlug, user?.id]);

  const headerCopy = useMemo(() => {
    if (accessState?.isTrialAccess) {
      return 'Consulte posologia, contraindicações e apresentações durante o teste profissional.';
    }

    return 'Pesquise por princípio ativo, nome comercial, classe farmacológica ou tag de busca.';
  }, [accessState?.isTrialAccess]);

  function toggleSection(key) {
    setExpandedSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  if (!user?.id) {
    return (
      <main className="prescription-guide-page clinical-drug-page">
        <section className="prescription-access-panel">
          <span className="workspace-kicker">Bulário clínico</span>
          <h1>Entre para consultar medicamentos</h1>
          <p>Este recurso fica protegido para profissionais com conta ativa.</p>
          <button type="button" className="btn btn-primario prescription-access-action" onClick={onLogin}>
            Entrar
          </button>
        </section>
      </main>
    );
  }

  if (!isPro) {
    return (
      <main className="prescription-guide-page clinical-drug-page">
        <section className="prescription-access-panel">
          <span className="workspace-kicker">Bulário clínico</span>
          <h1>Recurso do plano profissional</h1>
          <p>Consulte medicamentos, posologias e contraindicações quando seu acesso profissional estiver ativo.</p>
          {checkoutError ? <div className="prescription-error">{checkoutError}</div> : null}
          <button
            type="button"
            className="btn btn-primario prescription-access-action"
            onClick={onRequestUpgrade}
            disabled={loadingCheckout}
          >
            {loadingCheckout ? 'Abrindo checkout...' : 'Ativar profissional'}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="prescription-guide-page clinical-drug-page">
      <section className="prescription-guide-header clinical-drug-header">
        <div>
          <span className="workspace-kicker">Bulário clínico</span>
          <h1>Consulta rápida de medicamentos</h1>
          <p>{headerCopy}</p>
        </div>
      </section>

      <section className="prescription-guide-grid clinical-drug-grid">
        <ClinicalDrugSidebar
          query={query}
          setQuery={setQuery}
          drugs={drugs}
          selectedSlug={selectedSlug}
          setSelectedSlug={setSelectedSlug}
          loadingDrugs={loadingDrugs}
          error={error}
        />

        <article className="protocol-detail-panel clinical-drug-detail-panel">
          {loadingDetail ? (
            <div className="prescription-empty">Carregando medicamento...</div>
          ) : selectedDrug ? (
            <>
              <ClinicalDrugHeader drug={selectedDrug} />
              <SafetyNotice />

              <div className="clinical-drug-section-list">
                {SECTION_DEFINITIONS.map((definition) => {
                  const sectionText = definition.key === 'presentations'
                    ? getCommercialNames(selectedDrug)
                    : selectedDrug[definition.key];

                  return (
                    <ClinicalDrugSection
                      key={definition.key}
                      title={definition.title}
                      text={sectionText}
                      empty={definition.empty}
                      expanded={Boolean(expandedSections[definition.key])}
                      onToggle={() => toggleSection(definition.key)}
                    />
                  );
                })}
              </div>

              {selectedDrug.sourceBula || selectedDrug.pdfFile ? (
                <div className="clinical-drug-source-box">
                  <strong>Fonte</strong>
                  {selectedDrug.sourceBula ? <span>{selectedDrug.sourceBula}</span> : null}
                  {selectedDrug.pdfFile ? <span>{selectedDrug.pdfFile}</span> : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="prescription-empty">Selecione um medicamento para ver os detalhes.</div>
          )}
        </article>
      </section>
    </main>
  );
}

export default ClinicalDrugPage;

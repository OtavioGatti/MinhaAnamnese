import { useEffect, useMemo, useState } from 'react';
import { api } from '../apiClient';

const DEFAULT_QUERY = '';
const SEARCH_DEBOUNCE_MS = 320;
const DRUG_PATH_PREFIX = '/bulario';

const TABS = [
  { id: 'principal', label: 'Principal' },
  { id: 'ajustes', label: 'Ajustes' },
  { id: 'cuidados', label: 'Cuidados' },
];

// `read` devolve o texto da seção. Seções vazias não aparecem: com a bula
// completa sendo preenchida aos poucos, mostrar "ainda não preenchido" em cada
// campo novo encheria a tela de avisos.
const SECTION_DEFINITIONS = [
  { key: 'summary', tab: 'principal', title: 'Resumo clínico', read: (drug) => drug.summaryText },
  { key: 'indications', tab: 'principal', title: 'Indicações', read: (drug) => drug.monograph?.indications },
  { key: 'adultDosage', tab: 'principal', title: 'Posologia adulto', read: (drug) => drug.adultDosage },
  { key: 'pediatricDosage', tab: 'principal', title: 'Posologia pediátrica', read: (drug) => drug.pediatricDosage },
  { key: 'administration', tab: 'principal', title: 'Administração', read: (drug) => drug.monograph?.administration },
  { key: 'presentations', tab: 'principal', title: 'Apresentações', read: (drug) => drug.presentations || drug.anvisaPresentations },
  { key: 'commercialNames', tab: 'principal', title: 'Nomes comerciais', read: (drug) => getCommercialNames(drug).join('\n') },
  { key: 'mechanism', tab: 'principal', title: 'Mecanismo de ação', read: (drug) => drug.monograph?.mechanism },
  { key: 'renalAdjustment', tab: 'ajustes', title: 'Ajuste renal', read: (drug) => drug.monograph?.renalAdjustment },
  { key: 'hepaticAdjustment', tab: 'ajustes', title: 'Ajuste hepático', read: (drug) => drug.monograph?.hepaticAdjustment },
  { key: 'pregnancyUse', tab: 'ajustes', title: 'Gestação', read: (drug) => drug.monograph?.pregnancyUse },
  { key: 'lactation', tab: 'ajustes', title: 'Lactação', read: (drug) => drug.monograph?.lactation },
  { key: 'geriatricUse', tab: 'ajustes', title: 'Uso geriátrico', read: (drug) => drug.monograph?.geriatricUse },
  { key: 'perioperative', tab: 'ajustes', title: 'Perioperatório', read: (drug) => drug.monograph?.perioperative },
  { key: 'monitoring', tab: 'ajustes', title: 'Monitoramento', read: (drug) => drug.monograph?.monitoring },
  { key: 'contraindications', tab: 'cuidados', title: 'Contraindicações', read: (drug) => drug.contraindications },
  { key: 'warnings', tab: 'cuidados', title: 'Advertências', read: (drug) => drug.warnings },
  { key: 'adverseEffects', tab: 'cuidados', title: 'Efeitos adversos', read: (drug) => drug.monograph?.adverseEffects },
  { key: 'interactions', tab: 'cuidados', title: 'Interações', read: (drug) => drug.interactions },
];

function normalizeDisplayText(value) {
  return String(value || '').trim();
}

function getDrugTitle(drug) {
  return drug?.activeIngredient || 'Medicamento';
}

// Nomes vêm de duas fontes (Anvisa e levantamento complementar) que se repetem
// entre si; a tela mostra cada nome uma vez só.
function getCommercialNames(drug) {
  const seen = new Set();
  const names = [];

  [drug?.commercialNamesAnvisa, drug?.commercialNamesOpenai].forEach((value) => {
    normalizeDisplayText(value)
      .split(/\r?\n|;/)
      .map((item) => item.replace(/^\s*[-•]\s*/, '').replace(/\.$/, '').trim())
      .filter(Boolean)
      .forEach((name) => {
        const key = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

        if (!seen.has(key)) {
          seen.add(key);
          names.push(name);
        }
      });
  });

  return names;
}

function getPregnancyLabel(drug) {
  return drug?.monograph?.pregnancyRiskLabel || drug?.pregnancyRisk || '';
}

function getDrugMetaParts(drug) {
  const pregnancy = getPregnancyLabel(drug);

  return [
    drug?.classCategory,
    pregnancy ? `Gestação ${pregnancy}` : '',
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

function getPregnancyRiskClass(drug) {
  const code = normalizeDisplayText(drug?.pregnancyRisk).toUpperCase();

  if (['D', 'X', 'EVITAR'].includes(code)) {
    return 'danger';
  }

  if (['A', 'B'].includes(code)) {
    return 'success';
  }

  if (['C', 'INDEFINIDO'].includes(code)) {
    return 'warning';
  }

  return '';
}

function getSourceUrl(drug) {
  const candidates = [drug?.sourceBula, drug?.pdfFile].map(normalizeDisplayText);
  return candidates.find((value) => /^https?:\/\//i.test(value)) || '';
}

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getSlugFromPath() {
  if (typeof window === 'undefined') {
    return '';
  }

  const match = window.location.pathname.match(/^\/bulario\/([a-z0-9-]+)\/?$/);
  return match ? match[1] : '';
}

function getDrugUrl(slug) {
  return `${window.location.origin}${DRUG_PATH_PREFIX}/${slug}`;
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

function ClinicalDrugSection({ title, text, expanded, onToggle }) {
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
          {isLikelyList(content) ? (
            <ul className="protocol-simple-list">
              {splitListText(content).map((item, index) => (
                <li key={`${title}-${item}-${index}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <pre>{content}</pre>
          )}
        </div>
      ) : null}
    </section>
  );
}

// O que dá (ou não) para confiar no conteúdo, sempre visível no topo da bula.
function ReviewNotice({ drug }) {
  const monograph = drug?.monograph || {};
  const status = normalizeDisplayText(monograph.clinicalReviewStatus);
  const reviewedAt = formatDate(monograph.reviewedAt);
  const updatedAt = formatDate(drug?.sourceUpdatedAt || drug?.updatedAt);

  if (/revisado por m[eé]dico/i.test(status)) {
    return (
      <div className="clinical-drug-review success">
        <strong>Revisado por médico</strong>
        <span>
          {[monograph.reviewedBy, reviewedAt ? `em ${reviewedAt}` : ''].filter(Boolean).join(' ')}
        </span>
      </div>
    );
  }

  if (/aguardando revis/i.test(status)) {
    return (
      <div className="clinical-drug-review warning">
        <strong>Aguardando revisão médica</strong>
        <span>Conteúdo elaborado a partir das referências listadas no fim da bula, ainda não revisado por médico.</span>
      </div>
    );
  }

  if (/precisa corre/i.test(status)) {
    return (
      <div className="clinical-drug-review danger">
        <strong>Em correção</strong>
        <span>Este conteúdo foi marcado para correção. Confira na bula oficial antes de usar.</span>
      </div>
    );
  }

  return (
    <div className="clinical-drug-review neutral">
      <strong>Sem revisão documentada</strong>
      <span>{updatedAt ? `Atualizado em ${updatedAt}. ` : ''}Confira na bula oficial antes de usar.</span>
    </div>
  );
}

function ReferenceList({ drug }) {
  const references = splitListText(drug?.monograph?.references);
  const sourceUrl = getSourceUrl(drug);

  if (references.length === 0 && !sourceUrl) {
    return null;
  }

  return (
    <section className="clinical-drug-source-box">
      <strong>Referências</strong>
      <ol className="clinical-drug-reference-list">
        {references.map((reference, index) => {
          const url = reference.match(/https?:\/\/\S+/i)?.[0]?.replace(/[).,]+$/, '') || '';
          const label = url ? reference.replace(url, '').replace(/[\s—–-]+$/, '').trim() : reference;

          return (
            <li key={`${reference}-${index}`}>
              {label || url}
              {url ? (
                <>
                  {' '}
                  <a href={url} target="_blank" rel="noreferrer">acessar</a>
                </>
              ) : null}
            </li>
          );
        })}
        {sourceUrl ? (
          <li>
            Bula de referência{' '}
            <a href={sourceUrl} target="_blank" rel="noreferrer">acessar</a>
          </li>
        ) : null}
      </ol>
    </section>
  );
}

function ClinicalDrugHeader({ drug }) {
  const [copied, setCopied] = useState(false);
  const monograph = drug?.monograph || {};
  const pregnancy = getPregnancyLabel(drug);
  const riskClass = getPregnancyRiskClass(drug);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(getDrugUrl(drug.slug));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <header className="protocol-header clinical-drug-detail-header">
      <div className="protocol-header-copy">
        <nav className="clinical-drug-breadcrumb" aria-label="Caminho">
          <span>Bulário</span>
          <span aria-hidden="true">›</span>
          <span>{getDrugTitle(drug)}</span>
        </nav>
        <h2>{getDrugTitle(drug)}</h2>

        <div className="protocol-header-meta">
          {drug?.classCategory ? (
            <div className="protocol-meta-group">
              <span>Classe / categoria</span>
              <strong>{drug.classCategory}</strong>
            </div>
          ) : null}

          <div className="protocol-meta-chips">
            {pregnancy ? (
              <span className={`protocol-status-badge ${riskClass}`}>
                Gestação: {pregnancy}
              </span>
            ) : null}
            {monograph.prescriptionType ? (
              <span className="protocol-status-badge">{monograph.prescriptionType}</span>
            ) : null}
            {monograph.susAvailable ? (
              <span className="protocol-status-badge success">Rede SUS (RENAME)</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="clinical-drug-actions">
        <button type="button" className="btn btn-secundario" onClick={copyLink}>
          {copied ? 'Link copiado' : 'Copiar link'}
        </button>
      </div>
    </header>
  );
}

function SafetyNotice() {
  return (
    <div className="protocol-safety-notice">
      <strong>Uso clínico seguro:</strong>
      <span>
        Conteúdo apenas informativo e de apoio. Confira alergias, gestação, idade, peso, função renal/hepática, interações,
        bula oficial e protocolo local antes de qualquer uso assistencial.
      </span>
    </div>
  );
}

function ClinicalDrugDetail({ drug }) {
  const [activeTab, setActiveTab] = useState('principal');
  const [collapsed, setCollapsed] = useState({});

  const sectionsByTab = useMemo(() => TABS.reduce((accumulator, tab) => ({
    ...accumulator,
    [tab.id]: SECTION_DEFINITIONS
      .filter((definition) => definition.tab === tab.id)
      .map((definition) => ({ ...definition, text: normalizeDisplayText(definition.read(drug)) }))
      .filter((definition) => definition.text),
  }), {}), [drug]);

  const visibleSections = sectionsByTab[activeTab] || [];

  return (
    <>
      <ClinicalDrugHeader drug={drug} />
      <ReviewNotice drug={drug} />
      <SafetyNotice />

      <div className="prescription-section-tabs" role="tablist" aria-label="Seções da bula">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`prescription-section-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            <span className="clinical-drug-tab-count">{sectionsByTab[tab.id].length}</span>
          </button>
        ))}
      </div>

      {/* Tudo aberto por padrão: em plantão, abrir seção por seção custa cliques. */}
      <div className="clinical-drug-section-list">
        {visibleSections.length > 0 ? (
          visibleSections.map((section) => (
            <ClinicalDrugSection
              key={section.key}
              title={section.title}
              text={section.text}
              expanded={!collapsed[section.key]}
              onToggle={() => setCollapsed((current) => ({ ...current, [section.key]: !current[section.key] }))}
            />
          ))
        ) : (
          <div className="protocol-section-empty">
            Esta parte da bula ainda não foi preenchida para este medicamento.
          </div>
        )}
      </div>

      <ReferenceList drug={drug} />
    </>
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
  const [selectedSlug, setSelectedSlug] = useState(getSlugFromPath);
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [loadingDrugs, setLoadingDrugs] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');

  // Cada medicamento tem endereço próprio (/bulario/<slug>) para poder ser
  // compartilhado e favoritado. Ao sair do bulário a URL volta para a raiz,
  // senão recarregar em outra página reabriria o bulário.
  useEffect(() => {
    if (selectedSlug && window.location.pathname !== `${DRUG_PATH_PREFIX}/${selectedSlug}`) {
      window.history.replaceState(window.history.state, '', `${DRUG_PATH_PREFIX}/${selectedSlug}`);
    }
  }, [selectedSlug]);

  useEffect(() => () => {
    if (window.location.pathname.startsWith(DRUG_PATH_PREFIX)) {
      window.history.replaceState(window.history.state, '', '/');
    }
  }, []);

  useEffect(() => {
    if (!user?.id || !isPro) {
      setDrugs([]);
      setSelectedDrug(null);
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
            <ClinicalDrugDetail key={selectedDrug.slug} drug={selectedDrug} />
          ) : (
            <div className="prescription-empty">Selecione um medicamento para ver os detalhes.</div>
          )}
        </article>
      </section>
    </main>
  );
}

export default ClinicalDrugPage;

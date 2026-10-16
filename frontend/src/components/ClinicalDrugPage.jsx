import { useEffect, useMemo, useState } from 'react';
import { api } from '../apiClient';
import {
  buildSectionsByTab,
  DRUG_TABS,
  getDrugMetaParts,
  getDrugTitle,
  getPregnancyLabel,
  getPregnancyRiskClass,
} from '../lib/clinicalDrugDisplay';
import { ClinicalDrugSection, ReferenceList, ReviewNotice } from './ClinicalDrugBlocks';

const DEFAULT_QUERY = '';
const SEARCH_DEBOUNCE_MS = 320;
const DRUG_PATH_PREFIX = '/bulario';

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
  const [expanded, setExpanded] = useState({});

  const sectionsByTab = useMemo(() => buildSectionsByTab(drug), [drug]);

  const visibleSections = sectionsByTab[activeTab] || [];

  return (
    <>
      <ClinicalDrugHeader drug={drug} />
      <ReviewNotice drug={drug} />
      <SafetyNotice />

      <div className="prescription-section-tabs" role="tablist" aria-label="Seções da bula">
        {DRUG_TABS.map((tab) => (
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

      {/* Tudo fechado por padrão: as abas já deixam poucas seções por tela, e a
          lista de títulos funciona como índice da bula. */}
      <div className="clinical-drug-section-list">
        {visibleSections.length > 0 ? (
          visibleSections.map((section) => (
            <ClinicalDrugSection
              key={section.key}
              title={section.title}
              text={section.text}
              expanded={Boolean(expanded[section.key])}
              onToggle={() => setExpanded((current) => ({ ...current, [section.key]: !current[section.key] }))}
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

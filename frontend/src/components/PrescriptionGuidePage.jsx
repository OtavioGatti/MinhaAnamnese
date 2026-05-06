import { useEffect, useMemo, useState } from 'react';
import { api } from '../apiClient';

const DEFAULT_QUERY = '';
const SEARCH_DEBOUNCE_MS = 320;

function getItemCopyText(item) {
  return item?.copyText || item?.instructions || item?.title || '';
}

function buildSectionCopy(items) {
  return items
    .map((item) => getItemCopyText(item))
    .filter(Boolean)
    .join('\n');
}

function getGuideCopyText(guide) {
  if (guide?.copyText) {
    return guide.copyText;
  }

  return Array.isArray(guide?.items) ? buildSectionCopy(guide.items) : '';
}

function PrescriptionGuidePage({
  user,
  isPro,
  onLogin,
  onRequestUpgrade,
  loadingCheckout,
  checkoutError,
}) {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [guides, setGuides] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const selectedGuideItems = Array.isArray(selectedGuide?.items) ? selectedGuide.items : [];
  const prescriptionItems = useMemo(
    () => selectedGuideItems.filter((item) => item.itemType === 'Prescrição'),
    [selectedGuideItems],
  );
  const conductItems = useMemo(
    () => selectedGuideItems.filter((item) => item.itemType === 'Conduta'),
    [selectedGuideItems],
  );

  useEffect(() => {
    if (!user?.id || !isPro) {
      setGuides([]);
      setSelectedGuide(null);
      setSelectedSlug('');
      setLoadingGuides(false);
      setLoadingDetail(false);
      return undefined;
    }

    let ignore = false;
    const timeoutId = window.setTimeout(async () => {
      setLoadingGuides(true);
      setError('');

      const params = new URLSearchParams({
        q: query.trim(),
        limit: '40',
      });
      const response = await api.get(`/prescription-guides?${params.toString()}`);

      if (ignore) {
        return;
      }

      if (response.success && Array.isArray(response.data)) {
        setGuides(response.data);
        if (!selectedSlug && response.data[0]?.slug) {
          setSelectedSlug(response.data[0].slug);
        }
      } else {
        setGuides([]);
        setError(response.error || 'Não foi possível buscar os guias de prescrição.');
      }

      setLoadingGuides(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [isPro, query, selectedSlug, user?.id]);

  useEffect(() => {
    if (!user?.id || !isPro || !selectedSlug) {
      setSelectedGuide(null);
      return undefined;
    }

    let ignore = false;

    async function loadGuideDetail() {
      setLoadingDetail(true);
      setError('');
      const response = await api.get(`/prescription-guides?slug=${encodeURIComponent(selectedSlug)}`);

      if (ignore) {
        return;
      }

      if (response.success && response.data) {
        setSelectedGuide(response.data);
      } else {
        setSelectedGuide(null);
        setError(response.error || 'Não foi possível abrir este guia de prescrição.');
      }

      setLoadingDetail(false);
    }

    loadGuideDetail();

    return () => {
      ignore = true;
    };
  }, [isPro, selectedSlug, user?.id]);

  async function copyText(text, key) {
    const content = String(text || '').trim();

    if (!content) {
      return;
    }

    await navigator.clipboard.writeText(content);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(''), 1400);
  }

  if (!user?.id) {
    return (
      <main className="prescription-guide-page">
        <section className="prescription-access-panel">
          <span className="workspace-kicker">Guia de Prescrição</span>
          <h1>Entre para acessar os modelos de prescrição</h1>
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
      <main className="prescription-guide-page">
        <section className="prescription-access-panel">
          <span className="workspace-kicker">Guia de Prescrição</span>
          <h1>Recurso do plano profissional</h1>
          <p>Pesquise patologias e copie modelos estruturados quando seu acesso profissional estiver ativo.</p>
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
    <main className="prescription-guide-page">
      <section className="prescription-guide-header">
        <div>
          <span className="workspace-kicker">Guia de Prescrição</span>
          <h1>Modelos por patologia</h1>
          <p>Busque uma condição clínica e copie a conduta completa ou partes específicas do modelo.</p>
        </div>
        <div className="prescription-guide-summary">
          <strong>{selectedGuideItems.length || guides.length}</strong>
          <span>{selectedGuide ? 'itens no modelo' : 'resultados'}</span>
        </div>
      </section>

      <section className="prescription-guide-grid">
        <div className="prescription-search-panel">
          <label className="prescription-search-label" htmlFor="prescription-search">
            Patologia
          </label>
          <input
            id="prescription-search"
            className="prescription-search-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedSlug('');
              setSelectedGuide(null);
            }}
            placeholder="Ex: cistite, rinossinusite, abdome obstrutivo"
          />

          {error ? <div className="prescription-error">{error}</div> : null}

          <div className="prescription-results-list" aria-live="polite">
            {loadingGuides ? (
              <div className="prescription-empty">Buscando modelos...</div>
            ) : guides.length > 0 ? (
              guides.map((guide) => (
                <button
                  key={guide.slug}
                  type="button"
                  className={`prescription-result-item ${guide.slug === selectedSlug ? 'active' : ''}`}
                  onClick={() => setSelectedSlug(guide.slug)}
                >
                  <strong>{guide.conditionName}</strong>
                  <span>
                    {[guide.specialty, guide.subcondition, ...(guide.contexts || [])]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
              ))
            ) : (
              <div className="prescription-empty">Nenhum modelo encontrado.</div>
            )}
          </div>
        </div>

        <div className="prescription-detail-panel">
          {loadingDetail ? (
            <div className="prescription-empty">Carregando prescrição...</div>
          ) : selectedGuide ? (
            <>
              <div className="prescription-detail-header">
                <div>
                  <h2>{selectedGuide.conditionName}</h2>
                  <p>
                    {[selectedGuide.specialty, selectedGuide.subcondition, ...(selectedGuide.contexts || [])]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="prescription-copy-actions">
                  <button
                    type="button"
                    className="btn btn-secundario"
                    onClick={() => copyText(getGuideCopyText(selectedGuide), 'all')}
                  >
                    {copiedKey === 'all' ? 'Copiado' : 'Copiar tudo'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secundario"
                    onClick={() => copyText(buildSectionCopy(conductItems), 'conducts')}
                    disabled={conductItems.length === 0}
                  >
                    {copiedKey === 'conducts' ? 'Copiado' : 'Copiar condutas'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secundario"
                    onClick={() => copyText(buildSectionCopy(prescriptionItems), 'prescriptions')}
                    disabled={prescriptionItems.length === 0}
                  >
                    {copiedKey === 'prescriptions' ? 'Copiado' : 'Copiar prescrições'}
                  </button>
                </div>
              </div>

              <div className="prescription-safety-note">
                Modelo de apoio. Confirme dose, alergias, contraindicações, idade, peso, gestação, função renal/hepática e protocolo local antes de prescrever.
              </div>

              <div className="prescription-category-list">
                {(selectedGuide.categories || []).map((categoryGroup) => (
                  <section key={categoryGroup.category} className="prescription-category-section">
                    <h3>{categoryGroup.category}</h3>
                    <div className="prescription-item-list">
                      {categoryGroup.items.map((item) => (
                        <article key={item.id} className="prescription-item">
                          <div className="prescription-item-index">{item.orderIndex}</div>
                          <div className="prescription-item-body">
                            <div className="prescription-item-heading">
                              <strong>{getItemCopyText(item)}</strong>
                              <span>{item.itemType}</span>
                            </div>
                            {item.reviewStatus === 'Revisão pendente' ? (
                              <p className="prescription-review-note">Revisão clínica pendente.</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="prescription-item-copy"
                            onClick={() => copyText(getItemCopyText(item), item.id)}
                            title="Copiar item"
                          >
                            {copiedKey === item.id ? 'Copiado' : 'Copiar'}
                          </button>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <div className="prescription-empty">Selecione uma patologia para ver o modelo.</div>
          )}
        </div>
      </section>
    </main>
  );
}

export default PrescriptionGuidePage;

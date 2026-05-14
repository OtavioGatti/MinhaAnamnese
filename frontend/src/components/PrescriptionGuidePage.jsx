import { useEffect, useMemo, useState } from 'react';
import { api } from '../apiClient';

const DEFAULT_QUERY = '';
const SEARCH_DEBOUNCE_MS = 320;
const SAFETY_TEXT = 'Confirmar dose, alergias, contraindicações, idade, peso quando aplicável, gestação, função renal/hepática, gravidade do caso e protocolo local.';

const SECTION_DEFINITIONS = [
  {
    key: 'prescription',
    title: 'Prescrição medicamentosa',
    copyLabel: 'Copiar prescrição',
    copyKey: 'prescription',
    copyHint: 'A cópia é formatada para receituário.',
  },
  {
    key: 'conduct',
    title: 'Conduta / Procedimento',
    copyLabel: 'Copiar conduta',
    copyKey: 'conduct',
  },
  {
    key: 'orientations',
    title: 'Orientações ao paciente',
    copyLabel: 'Copiar orientações',
    copyKey: 'orientations',
  },
  {
    key: 'warnings',
    title: 'Sinais de alerta',
  },
  {
    key: 'whenUse',
    title: 'Quando usar',
  },
  {
    key: 'whenNotUse',
    title: 'Quando não usar',
  },
  {
    key: 'referral',
    title: 'Encaminhamento / Retorno',
  },
  {
    key: 'observations',
    title: 'Observações clínicas',
  },
  {
    key: 'sourceReview',
    title: 'Fonte e revisão',
  },
];

function getGuideTitle(guide) {
  return guide?.title || guide?.conditionName || 'Protocolo';
}

function getContextText(guide) {
  return (guide?.contexts || []).filter(Boolean).join(' / ');
}

function getGuideMetaParts(guide) {
  return [
    guide?.specialty,
    getContextText(guide),
    guide?.subcondition,
  ].filter(Boolean);
}

function getStatusLabel(guide) {
  return guide?.statusRevisao || guide?.nivelRisco || '';
}

function getRiskClass(guide) {
  const value = String(guide?.nivelRisco || guide?.statusRevisao || '').toLowerCase();
  if (value.includes('alto') || value.includes('não usar')) {
    return 'danger';
  }
  if (value.includes('validado')) {
    return 'success';
  }
  return 'warning';
}

function getCopyText(guide, key) {
  if (!guide) {
    return '';
  }

  const copy = guide.copy || {};
  const sections = guide.sections || {};

  if (key === 'all') {
    return copy.all || guide.copyText || '';
  }

  return copy[key] || sections[key] || '';
}

function getSectionText(guide, key) {
  return String(guide?.sections?.[key] || '').trim();
}

function countMeaningfulLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function normalizeOptionHeading(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function parsePrescriptionOptions(text) {
  const lines = String(text || '').split(/\r?\n/);
  const options = [];
  let currentOption = null;

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    const normalizedLine = normalizeOptionHeading(trimmedLine);
    const headingMatch = normalizedLine.match(/^OPCAO\s+(\d+)\s*[:\-–—]\s*(.+)$/);

    if (headingMatch) {
      if (currentOption) {
        currentOption.text = currentOption.lines.join('\n').trim();
        options.push(currentOption);
      }

      currentOption = {
        number: headingMatch[1],
        title: trimmedLine.replace(/^OP[ÇC][ÃA]O\s+\d+\s*[:\-–—]\s*/i, '').trim(),
        lines: [],
        text: '',
      };
      return;
    }

    if (currentOption) {
      currentOption.lines.push(line);
    }
  });

  if (currentOption) {
    currentOption.text = currentOption.lines.join('\n').trim();
    options.push(currentOption);
  }

  return options.filter((option) => option.title && option.text);
}

function getDefaultExpandedSections(guide) {
  const defaults = {
    prescription: true,
    conduct: true,
  };

  if (String(guide?.nivelRisco || '').toLowerCase().includes('alto')) {
    defaults.warnings = true;
    defaults.whenNotUse = true;
  }

  return defaults;
}

function CopyButton({
  text,
  copyKey,
  copiedKey,
  onCopy,
  children,
  className = 'btn btn-secundario',
}) {
  const disabled = !String(text || '').trim();

  return (
    <button
      type="button"
      className={className}
      onClick={() => onCopy(text, copyKey)}
      disabled={disabled}
    >
      {copiedKey === copyKey ? 'Copiado' : children}
    </button>
  );
}

function ProtocolSidebar({
  query,
  setQuery,
  guides,
  selectedSlug,
  setSelectedSlug,
  loadingGuides,
  error,
}) {
  return (
    <aside className="protocol-sidebar">
      <label className="protocol-search-label" htmlFor="prescription-search">
        Buscar protocolo
      </label>
      <input
        id="prescription-search"
        className="protocol-search-input"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedSlug('');
        }}
        placeholder="Ex: conjuntivite, alergica, abdome obstrutivo"
      />

      {error ? <div className="prescription-error">{error}</div> : null}

      <div className="protocol-results-list" aria-live="polite">
        {loadingGuides ? (
          <div className="prescription-empty">Buscando protocolos...</div>
        ) : guides.length > 0 ? (
          guides.map((guide) => {
            const status = getStatusLabel(guide);

            return (
              <button
                key={guide.slug}
                type="button"
                className={`protocol-result-item ${guide.slug === selectedSlug ? 'active' : ''}`}
                onClick={() => setSelectedSlug(guide.slug)}
              >
                <strong>{getGuideTitle(guide)}</strong>
                <span>
                  {[...getGuideMetaParts(guide), status]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            );
          })
        ) : (
          <div className="prescription-empty">Nenhum protocolo encontrado.</div>
        )}
      </div>
    </aside>
  );
}

function ProtocolHeader({ guide, copiedKey, onCopy }) {
  const status = getStatusLabel(guide);

  return (
    <header className="protocol-header">
      <div className="protocol-header-copy">
        <h2>{getGuideTitle(guide)}</h2>
        <p>{getGuideMetaParts(guide).join(' · ')}</p>
        {status ? (
          <div className="protocol-meta-row">
            <span className={`protocol-status-badge ${getRiskClass(guide)}`}>
              {status}
            </span>
          </div>
        ) : null}
      </div>

      <div className="protocol-copy-actions">
        <CopyButton text={getCopyText(guide, 'all')} copyKey="all" copiedKey={copiedKey} onCopy={onCopy}>
          Copiar tudo
        </CopyButton>
        <CopyButton text={getCopyText(guide, 'prescription')} copyKey="prescription-top" copiedKey={copiedKey} onCopy={onCopy}>
          Copiar prescrição
        </CopyButton>
        <CopyButton text={getCopyText(guide, 'conduct')} copyKey="conduct-top" copiedKey={copiedKey} onCopy={onCopy}>
          Copiar conduta
        </CopyButton>
        <CopyButton text={getCopyText(guide, 'orientations')} copyKey="orientations-top" copiedKey={copiedKey} onCopy={onCopy}>
          Copiar orientações
        </CopyButton>
      </div>
    </header>
  );
}

function SafetyNotice() {
  return (
    <div className="protocol-safety-notice">
      <strong>Antes de prescrever:</strong>
      <span>{SAFETY_TEXT}</span>
    </div>
  );
}

function ProtocolAccordionSection({
  definition,
  guide,
  expanded,
  onToggle,
  copiedKey,
  onCopy,
}) {
  const sectionText = getSectionText(guide, definition.key);
  const copyText = definition.copyKey ? getCopyText(guide, definition.copyKey) : sectionText;
  const showsCopyHint = definition.key === 'prescription' && Boolean(String(copyText || '').trim());
  const prescriptionOptions = definition.key === 'prescription' ? parsePrescriptionOptions(copyText) : [];
  const hasPrescriptionOptions = prescriptionOptions.length > 0;
  const displayText = sectionText || copyText;
  const itemCount = countMeaningfulLines(sectionText);
  const countLabel = hasPrescriptionOptions ? `${prescriptionOptions.length} opções` : `${itemCount} itens`;

  return (
    <section className="protocol-accordion-section">
      <button
        type="button"
        className="protocol-accordion-trigger"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="protocol-accordion-title">
          <span className="protocol-chevron">{expanded ? '▾' : '▸'}</span>
          {definition.title}
        </span>
        {hasPrescriptionOptions || itemCount > 0 ? <span className="protocol-section-count">{countLabel}</span> : null}
      </button>

      {expanded ? (
        <div className="protocol-accordion-content">
          {hasPrescriptionOptions ? (
            <div className="protocol-prescription-options">
              <span className="protocol-copy-hint">Copie apenas a opção correspondente ao caso.</span>
              {prescriptionOptions.map((option) => (
                <article className="protocol-prescription-option" key={`${definition.key}-${option.number}-${option.title}`}>
                  <div className="protocol-prescription-option-header">
                    <span>Opção {option.number}</span>
                    <strong>{option.title}</strong>
                  </div>
                  <pre>{option.text}</pre>
                  <CopyButton
                    text={option.text}
                    copyKey={`${definition.key}-option-${option.number}`}
                    copiedKey={copiedKey}
                    onCopy={onCopy}
                    className="protocol-section-copy"
                  >
                    Copiar esta opção
                  </CopyButton>
                </article>
              ))}
            </div>
          ) : displayText ? (
            <pre>{displayText}</pre>
          ) : (
            <div className="protocol-section-empty">Campo ainda não preenchido no CMS.</div>
          )}
          {definition.copyLabel ? (
            <div className="protocol-section-copy-row">
              <CopyButton
                text={copyText}
                copyKey={`${definition.key}-section`}
                copiedKey={copiedKey}
                onCopy={onCopy}
                className="protocol-section-copy"
              >
                {hasPrescriptionOptions ? 'Copiar todas as opções' : definition.copyLabel}
              </CopyButton>
              {showsCopyHint && definition.copyHint && !hasPrescriptionOptions ? (
                <span className="protocol-copy-hint">{definition.copyHint}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
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
  const [expandedSections, setExpandedSections] = useState({});
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const populatedSectionCount = useMemo(() => (
    SECTION_DEFINITIONS.filter((section) => getSectionText(selectedGuide, section.key)).length
  ), [selectedGuide]);

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
        setExpandedSections(getDefaultExpandedSections(response.data));
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

  function toggleSection(key) {
    setExpandedSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
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
          <h1>Protocolos por patologia</h1>
          <p>Busque uma condição clínica e copie a prescrição, conduta ou orientação pronta para uso.</p>
        </div>
        <div className="prescription-guide-summary">
          <strong>{selectedGuide ? populatedSectionCount : guides.length}</strong>
          <span>{selectedGuide ? 'seções preenchidas' : 'resultados'}</span>
        </div>
      </section>

      <section className="prescription-guide-grid">
        <ProtocolSidebar
          query={query}
          setQuery={(value) => {
            setQuery(value);
            setSelectedGuide(null);
          }}
          guides={guides}
          selectedSlug={selectedSlug}
          setSelectedSlug={setSelectedSlug}
          loadingGuides={loadingGuides}
          error={error}
        />

        <article className="protocol-detail-panel">
          {loadingDetail ? (
            <div className="prescription-empty">Carregando protocolo...</div>
          ) : selectedGuide ? (
            <>
              <ProtocolHeader guide={selectedGuide} copiedKey={copiedKey} onCopy={copyText} />
              <SafetyNotice />

              {selectedGuide.resumoClinico ? (
                <div className="protocol-summary-block">
                  <strong>Resumo clínico</strong>
                  <p>{selectedGuide.resumoClinico}</p>
                </div>
              ) : null}

              <div className="protocol-accordion-list">
                {SECTION_DEFINITIONS.map((definition) => (
                  <ProtocolAccordionSection
                    key={definition.key}
                    definition={definition}
                    guide={selectedGuide}
                    expanded={Boolean(expandedSections[definition.key])}
                    onToggle={() => toggleSection(definition.key)}
                    copiedKey={copiedKey}
                    onCopy={copyText}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="prescription-empty">Selecione uma patologia para ver o protocolo.</div>
          )}
        </article>
      </section>
    </main>
  );
}

export default PrescriptionGuidePage;

import { useEffect, useState } from 'react';
import { api } from '../apiClient';

// Catálogo de manobras de exame físico dentro da aba Avaliação. Reaproveita o
// layout de Protocolos (lista à esquerda, detalhe em seções à direita) porque o
// conteúdo tem corpo — quando fazer, como fazer, o que cada achado sugere.

const SEARCH_DEBOUNCE_MS = 320;

const DETAIL_SECTIONS = [
  { key: 'whenToPerform', title: 'Quando fazer' },
  { key: 'howToPerform', title: 'Como executar' },
  { key: 'positiveFinding', title: 'Achado positivo' },
  { key: 'negativeFinding', title: 'Achado negativo' },
  { key: 'clinicalUtility', title: 'Utilidade clínica' },
  { key: 'source', title: 'Fonte' },
];

function ManeuverSidebar({ query, setQuery, maneuvers, selectedSlug, setSelectedSlug, loading, error }) {
  return (
    <aside className="protocol-sidebar">
      <label className="protocol-search-label" htmlFor="maneuver-search">
        Buscar manobra
      </label>
      <input
        id="maneuver-search"
        className="protocol-search-input"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedSlug('');
        }}
        placeholder="Ex: Giordano, pielonefrite, joelho"
        autoComplete="off"
      />

      {error ? <div className="prescription-error">{error}</div> : null}

      <div className="protocol-results-list" aria-live="polite">
        {loading ? (
          <div className="prescription-empty">Buscando manobras...</div>
        ) : maneuvers.length > 0 ? (
          maneuvers.map((maneuver) => (
            <button
              key={maneuver.slug}
              type="button"
              className={`protocol-result-item ${maneuver.slug === selectedSlug ? 'active' : ''}`}
              onClick={() => setSelectedSlug(maneuver.slug)}
            >
              <strong>{maneuver.name}</strong>
              <span>{[maneuver.category, maneuver.relatedConditions].filter(Boolean).join(' · ')}</span>
            </button>
          ))
        ) : (
          <div className="prescription-empty">
            {query.trim()
              ? 'Nenhuma manobra encontrada para esta busca.'
              : 'Nenhuma manobra publicada ainda.'}
          </div>
        )}
      </div>
    </aside>
  );
}

function ManeuverDetail({ maneuver }) {
  const sections = DETAIL_SECTIONS
    .map((definition) => ({ ...definition, text: String(maneuver[definition.key] || '').trim() }))
    .filter((section) => section.text);

  return (
    <>
      <header className="protocol-header">
        <div className="protocol-header-copy">
          <h2>{maneuver.name}</h2>
          {maneuver.aliases ? <p>{maneuver.aliases}</p> : null}
        </div>
        <div className="protocol-header-meta">
          {maneuver.category ? (
            <div className="protocol-meta-group">
              <span>Região</span>
              <strong>{maneuver.category}</strong>
            </div>
          ) : null}
          {maneuver.relatedConditions ? (
            <div className="protocol-meta-group">
              <span>Relacionada a</span>
              <strong>{maneuver.relatedConditions}</strong>
            </div>
          ) : null}
        </div>
      </header>

      <div className="maneuver-safety-notice">
        Conteúdo de apoio à memória. A execução e a interpretação dependem do contexto clínico,
        do treinamento do examinador e do exame completo — nunca de uma manobra isolada.
      </div>

      <div className="maneuver-sections">
        {sections.map((section) => (
          <section key={section.key} className="maneuver-section">
            <h3>{section.title}</h3>
            <p>{section.text}</p>
          </section>
        ))}
      </div>
    </>
  );
}

function ManeuversSection({ initialSlug = '' }) {
  const [query, setQuery] = useState('');
  const [maneuvers, setManeuvers] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState(initialSlug);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Chegada por link (ex.: manobra citada numa hipótese) troca a seleção.
  useEffect(() => {
    if (initialSlug) {
      setSelectedSlug(initialSlug);
    }
  }, [initialSlug]);

  useEffect(() => {
    let ignore = false;

    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({ q: query.trim(), limit: '60' });
      const response = await api.get(`/physical-exam-maneuvers?${params.toString()}`).catch(() => null);

      if (ignore) {
        return;
      }

      if (response?.success && Array.isArray(response.data)) {
        setManeuvers(response.data);
      } else {
        setManeuvers([]);
        setError(response?.error || 'Não foi possível carregar as manobras agora.');
      }

      setLoading(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const selectedManeuver = maneuvers.find((maneuver) => maneuver.slug === selectedSlug) || null;

  return (
    <section className="prescription-guide-grid">
      <ManeuverSidebar
        query={query}
        setQuery={setQuery}
        maneuvers={maneuvers}
        selectedSlug={selectedSlug}
        setSelectedSlug={setSelectedSlug}
        loading={loading}
        error={error}
      />

      <article className="protocol-detail-panel">
        {selectedManeuver ? (
          <ManeuverDetail maneuver={selectedManeuver} />
        ) : (
          <div className="prescription-empty">Selecione uma manobra para ver a execução e a interpretação.</div>
        )}
      </article>
    </section>
  );
}

export default ManeuversSection;

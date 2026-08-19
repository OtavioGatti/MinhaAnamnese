import { useEffect, useMemo, useState } from 'react';
import { api } from '../apiClient';
import CatalogFilterPanel, { getCatalogFilterValues } from './CatalogFilterPanel';

// Catálogo de exames complementares dentro da aba Avaliação. Mesmo layout das
// manobras (lista à esquerda, detalhe em seções à direita).

const SEARCH_DEBOUNCE_MS = 320;
// Teto da listagem, alinhado ao do backend. Acima disso a lista precisa de
// paginação de verdade — carregar tudo de uma vez deixaria de compensar.
const CATALOG_LIMIT = 300;

// O aviso de faixa de referência é fixo, não vem do CMS: que o valor varia por
// laboratório é regra clínica, e uma edição no Notion não pode tirar isso da
// tela. O texto espelha EXAM_REFERENCE_DISCLAIMER no backend.
const REFERENCE_DISCLAIMER = 'Faixas de referência variam por laboratório, método de análise, idade, sexo e gestação. O que está aqui é orientação geral — o intervalo do laudo do seu laboratório sempre prevalece.';

const DETAIL_SECTIONS = [
  { key: 'whenToRequest', title: 'Quando pedir' },
  { key: 'preparation', title: 'Preparo' },
  { key: 'howToInterpret', title: 'Como interpretar' },
  { key: 'limitations', title: 'Limitações' },
  { key: 'source', title: 'Fonte' },
];

function ExamSidebar({
  query,
  setQuery,
  category,
  setCategory,
  categories,
  exams,
  selectedSlug,
  setSelectedSlug,
  loading,
  error,
}) {
  return (
    <aside className="protocol-sidebar">
      <label className="protocol-search-label" htmlFor="exam-search">
        Buscar exame
      </label>
      <input
        id="exam-search"
        className="protocol-search-input"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedSlug('');
        }}
        placeholder="Ex: hemograma, urina, pielonefrite"
        autoComplete="off"
      />

      <CatalogFilterPanel
        groups={[{
          key: 'category',
          label: 'Tipo',
          values: categories,
          selected: category,
          onSelect: setCategory,
        }]}
      />

      {error ? <div className="prescription-error">{error}</div> : null}

      <div className="protocol-results-list" aria-live="polite">
        {loading ? (
          <div className="prescription-empty">Buscando exames...</div>
        ) : exams.length > 0 ? (
          exams.map((exam) => (
            <button
              key={exam.slug}
              type="button"
              className={`protocol-result-item ${exam.slug === selectedSlug ? 'active' : ''}`}
              onClick={() => setSelectedSlug(exam.slug)}
            >
              <strong>{exam.name}</strong>
              <span>{[exam.category, exam.relatedConditions].filter(Boolean).join(' · ')}</span>
            </button>
          ))
        ) : (
          <div className="prescription-empty">
            {query.trim() || category
              ? 'Nenhum exame encontrado para esta busca.'
              : 'Nenhum exame publicado ainda.'}
          </div>
        )}
      </div>
    </aside>
  );
}

function ExamDetail({ exam }) {
  const sections = DETAIL_SECTIONS
    .map((definition) => ({ ...definition, text: String(exam[definition.key] || '').trim() }))
    .filter((section) => section.text);

  return (
    <>
      <header className="protocol-header">
        <div className="protocol-header-copy">
          <h2>{exam.name}</h2>
          {exam.aliases ? <p>{exam.aliases}</p> : null}
        </div>
        <div className="protocol-header-meta">
          {exam.category ? (
            <div className="protocol-meta-group">
              <span>Tipo</span>
              <strong>{exam.category}</strong>
            </div>
          ) : null}
          {exam.relatedConditions ? (
            <div className="protocol-meta-group">
              <span>Relacionado a</span>
              <strong>{exam.relatedConditions}</strong>
            </div>
          ) : null}
        </div>
      </header>

      <div className="maneuver-safety-notice">{REFERENCE_DISCLAIMER}</div>

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

function ExamsSection({ initialSlug = '' }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [exams, setExams] = useState([]);
  // Catálogo completo (primeira carga, sem busca nem filtro): alimenta os chips
  // para que os tipos não sumam conforme a busca estreita o resultado.
  const [catalog, setCatalog] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState(initialSlug);
  // Exame aberto por link que não veio na listagem — ver o efeito abaixo.
  const [fallbackExam, setFallbackExam] = useState(null);
  const [loadingFallback, setLoadingFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Chegada por link (ex.: exame citado numa hipótese) troca a seleção.
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

      const params = new URLSearchParams({ q: query.trim(), limit: String(CATALOG_LIMIT) });

      if (category) {
        params.set('category', category);
      }

      const response = await api.get(`/diagnostic-exams?${params.toString()}`).catch(() => null);

      if (ignore) {
        return;
      }

      if (response?.success && Array.isArray(response.data)) {
        setExams(response.data);

        if (!query.trim() && !category) {
          setCatalog(response.data);
        }
      } else {
        setExams([]);
        setError(response?.error || 'Não foi possível carregar os exames agora.');
      }

      setLoading(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [category, query]);

  const categories = useMemo(() => getCatalogFilterValues(catalog, 'category'), [catalog]);

  function handleCategoryChange(value) {
    setCategory(value);
    setSelectedSlug('');
  }

  const examFromList = exams.find((exam) => exam.slug === selectedSlug) || null;
  const foundSlug = examFromList?.slug || '';

  // A lista vem limitada (60 itens), então um link direto — vindo de uma
  // hipótese, por exemplo — pode apontar para exame fora dessa janela. Buscar
  // pelo slug evita que esse link abra em branco: o painel não depende mais de
  // o exame ter cabido na listagem.
  useEffect(() => {
    if (!selectedSlug || foundSlug) {
      setFallbackExam(null);
      setLoadingFallback(false);
      return undefined;
    }

    let ignore = false;
    setLoadingFallback(true);

    (async () => {
      const params = new URLSearchParams({ slug: selectedSlug });
      const response = await api.get(`/diagnostic-exams?${params.toString()}`).catch(() => null);

      if (ignore) {
        return;
      }

      setFallbackExam(response?.success ? response.data?.exam || null : null);
      setLoadingFallback(false);
    })();

    return () => {
      ignore = true;
    };
  }, [foundSlug, selectedSlug]);

  const selectedExam = examFromList || fallbackExam;

  return (
    <section className="prescription-guide-grid">
      <ExamSidebar
        query={query}
        setQuery={setQuery}
        category={category}
        setCategory={handleCategoryChange}
        categories={categories}
        exams={exams}
        selectedSlug={selectedSlug}
        setSelectedSlug={setSelectedSlug}
        loading={loading}
        error={error}
      />

      <article className="protocol-detail-panel">
        {selectedExam ? (
          <ExamDetail exam={selectedExam} />
        ) : loadingFallback ? (
          <div className="prescription-empty">Carregando exame...</div>
        ) : (
          <div className="prescription-empty">Selecione um exame para ver quando pedir e como interpretar.</div>
        )}
      </article>
    </section>
  );
}

export default ExamsSection;

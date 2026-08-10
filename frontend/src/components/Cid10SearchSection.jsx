import { useState } from 'react';
import { useCid10Search } from '../hooks/useCid10Search';

const SEX_LABELS = {
  F: 'Código restrito ao sexo feminino',
  M: 'Código restrito ao sexo masculino',
};

function Cid10ResultCard({ item, copiedCode, onCopy }) {
  const isManifestation = item.daggerAsterisk === '*';
  const sexLabel = SEX_LABELS[item.sexRestriction] || '';

  return (
    <article className="cid10-result">
      <div className="cid10-result-main">
        <div className="cid10-result-heading">
          <span className="cid10-result-code">{item.code}</span>
          {item.level === 'categoria' ? (
            <span className="cid10-result-tag" title="Código de categoria (3 caracteres). Quando houver, prefira a subcategoria, que é mais específica.">
              Categoria
            </span>
          ) : null}
        </div>
        <p className="cid10-result-description">{item.description}</p>
        {item.chapterDescription ? (
          <p className="cid10-result-context">{item.chapterDescription}</p>
        ) : null}
        {isManifestation || sexLabel ? (
          <p className="cid10-result-flag">
            {isManifestation
              ? 'Código de manifestação (*) — não use isolado como diagnóstico principal.'
              : sexLabel}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        className={`btn btn-secundario cid10-copy-button ${copiedCode === item.code ? 'copiado' : ''}`}
        onClick={() => onCopy(item)}
      >
        {copiedCode === item.code ? 'Copiado!' : 'Copiar código'}
      </button>
    </article>
  );
}

function Cid10SearchSection() {
  const [query, setQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const { results, loading, error, isQueryTooShort } = useCid10Search(query, { limit: 30 });

  async function handleCopy(item) {
    await navigator.clipboard.writeText(item.code);
    setCopiedCode(item.code);
    window.setTimeout(() => setCopiedCode(''), 1400);
  }

  return (
    <section className="cid10-section">
      <div className="cid10-toolbar">
        <label className="cid10-search">
          <span>Buscar CID-10</span>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Digite o código (N30) ou a condição (cistite)"
            autoComplete="off"
          />
        </label>
        <p className="cid10-toolbar-hint">
          Tabela oficial do DATASUS. Confira o código antes de usar em atestado, receituário ou prontuário.
        </p>
      </div>

      {error ? <div className="prescription-error">{error}</div> : null}

      {loading ? <div className="prescription-empty">Buscando códigos...</div> : null}

      {!loading && !error && isQueryTooShort ? (
        <div className="prescription-empty">Digite pelo menos 2 caracteres.</div>
      ) : null}

      {!loading && !error && !query.trim() ? (
        <div className="prescription-empty">
          Busque por código ou por condição para ver a descrição oficial e copiar o CID.
        </div>
      ) : null}

      {!loading && !error && query.trim() && !isQueryTooShort && results.length === 0 ? (
        <div className="prescription-empty">Nenhum código encontrado para esta busca.</div>
      ) : null}

      {results.length > 0 ? (
        <div className="cid10-results">
          {results.map((item) => (
            <Cid10ResultCard
              key={item.code}
              item={item}
              copiedCode={copiedCode}
              onCopy={handleCopy}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default Cid10SearchSection;

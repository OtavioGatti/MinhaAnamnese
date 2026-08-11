import { useState } from 'react';
import { useCid10Search } from '../hooks/useCid10Search';

// Versão compacta da busca de CID-10, para caber dentro de outro card (hoje o
// da hipótese diagnóstica). Já entra preenchida com o termo do contexto para o
// médico não precisar redigitar nem sair da tela.
function Cid10InlineSearch({ initialQuery = '', limit = 6 }) {
  const [query, setQuery] = useState(initialQuery);
  const [copiedCode, setCopiedCode] = useState('');
  const { results, loading, error, isQueryTooShort } = useCid10Search(query, { limit });

  async function handleCopy(code) {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode(''), 1400);
  }

  return (
    <div className="cid10-inline">
      <label className="cid10-inline-field">
        <span>Buscar CID-10</span>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Código ou condição"
          autoComplete="off"
        />
      </label>

      {loading ? <p className="cid10-inline-status">Buscando...</p> : null}
      {error ? <p className="cid10-inline-status">{error}</p> : null}
      {!loading && !error && isQueryTooShort ? (
        <p className="cid10-inline-status">Digite pelo menos 2 caracteres.</p>
      ) : null}
      {!loading && !error && !isQueryTooShort && query.trim() && results.length === 0 ? (
        <p className="cid10-inline-status">
          {/* O nome da hipótese é linguagem clínica ("Infecção Urinária
              Complicada"); a tabela usa nomenclatura oficial ("Infecção do
              trato urinário"). Buscar por aproximação chegaria a sugerir código
              de outra condição, então aqui pedimos o termo mais curto. */}
          Nenhum código com esse nome exato. A tabela usa a nomenclatura oficial —
          tente um termo mais curto ou outra palavra do diagnóstico.
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="cid10-inline-results">
          {results.map((item) => (
            <li key={item.code}>
              <button
                type="button"
                className={`cid10-inline-result ${copiedCode === item.code ? 'copiado' : ''}`}
                onClick={() => handleCopy(item.code)}
                title={
                  item.daggerAsterisk === '*'
                    ? 'Código de manifestação (*) — não use isolado como diagnóstico principal.'
                    : 'Clique para copiar o código'
                }
              >
                <strong>{item.code}</strong>
                <span>{item.description}</span>
                <em>{copiedCode === item.code ? 'Copiado!' : 'Copiar'}</em>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="cid10-inline-note">
        Códigos da tabela oficial do DATASUS. Confira antes de registrar.
      </p>
    </div>
  );
}

export default Cid10InlineSearch;

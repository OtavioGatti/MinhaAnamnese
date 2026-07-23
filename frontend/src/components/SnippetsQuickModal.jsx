import { useEffect, useState } from 'react';
import { api } from '../apiClient';

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Acesso rápido às frases prontas de dentro do workspace: inserir no texto da
// anamnese ou copiar. A edição/criação fica na página de Templates (onManage).
function SnippetsQuickModal({ open, onClose, onInsert, onManage, user }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [officialSnippets, setOfficialSnippets] = useState([]);
  const [mySnippets, setMySnippets] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let cancelled = false;

    setLoading(true);
    setError('');

    api.get('/snippets')
      .then((response) => {
        if (cancelled) {
          return;
        }

        if (!response.success) {
          throw new Error(response.error || 'Não foi possível carregar as frases prontas.');
        }

        setOfficialSnippets(Array.isArray(response.data?.official) ? response.data.official : []);
        setMySnippets(Array.isArray(response.data?.mine) ? response.data.mine : []);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message || 'Não foi possível carregar as frases prontas.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, user?.id]);

  if (!open) {
    return null;
  }

  const handleCopy = async (snippet) => {
    const copied = await copyToClipboard(snippet.body);

    if (copied) {
      setCopiedId(snippet.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const renderRow = (snippet, mine) => (
    <div key={`${mine ? 'mine' : 'official'}-${snippet.id}`} className="snippet-quick-row">
      <div className="snippet-quick-copy">
        <strong>{snippet.title}</strong>
        <span>{snippet.snippetType || 'Outro'}</span>
      </div>
      <div className="snippet-quick-actions">
        <button
          type="button"
          className="btn btn-primario"
          onClick={() => {
            onInsert?.(snippet.body);
            onClose?.();
          }}
        >
          Inserir
        </button>
        <button type="button" className="btn btn-secundario" onClick={() => handleCopy(snippet)}>
          {copiedId === snippet.id ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="app-modal-card snippet-quick-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="snippets-quick-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header">
          <div>
            <span className="workspace-kicker">Frases prontas</span>
            <h2 id="snippets-quick-title">Inserir modelo na anamnese</h2>
            <p>O texto entra no fim do campo e você ajusta só o que estiver diferente no paciente.</p>
          </div>
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Fechar
          </button>
        </div>

        {error ? <div className="templates-inline-error">{error}</div> : null}

        {loading ? (
          <div className="affiliate-loading">Carregando...</div>
        ) : (
          <div className="snippet-quick-list">
            {mySnippets.length ? (
              <>
                <div className="snippet-quick-group-title">Meus modelos</div>
                {mySnippets.map((snippet) => renderRow(snippet, true))}
              </>
            ) : null}

            {officialSnippets.length ? (
              <>
                <div className="snippet-quick-group-title">Modelos oficiais</div>
                {officialSnippets.map((snippet) => renderRow(snippet, false))}
              </>
            ) : null}

            {!mySnippets.length && !officialSnippets.length ? (
              <div className="empty-state-hint">Nenhum modelo disponível ainda.</div>
            ) : null}
          </div>
        )}

        <div className="snippet-quick-footer">
          <button type="button" className="btn-link" onClick={onManage}>
            Gerenciar frases prontas
          </button>
        </div>
      </div>
    </div>
  );
}

export default SnippetsQuickModal;

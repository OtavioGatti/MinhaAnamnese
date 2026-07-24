import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../apiClient';

// Corpo do modelo com recorte suave: o gradiente só aparece quando o texto
// realmente ultrapassa a altura (evita "esmaecer" um modelo curto e completo).
function SnippetCardBody({ text }) {
  const ref = useRef(null);
  const [clipped, setClipped] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;

    if (element) {
      setClipped(element.scrollHeight > element.clientHeight + 2);
    }
  }, [text]);

  return (
    <div className={`snippet-card-body-wrap ${clipped ? 'is-clipped' : ''}`}>
      <pre className="snippet-card-body" ref={ref}>{text}</pre>
    </div>
  );
}

const EMPTY_SNIPPET_FORM = {
  id: null,
  title: '',
  body: '',
  snippetType: 'Exame físico',
};

const SNIPPET_TYPE_OPTIONS = [
  'Exame físico',
  'Conduta',
  'Orientação de alta',
  'Evolução',
  'Outro',
];

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Aba "Frases prontas" da página de Templates: oficiais (CMS Notion, leitura
// para todos) + modelos do usuário (criar é Pro; editar/apagar é do dono).
function SnippetsSection({ user, isPro, onRequestUpgrade, onLogin }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [officialSnippets, setOfficialSnippets] = useState([]);
  const [mySnippets, setMySnippets] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_SNIPPET_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const refresh = async () => {
    const response = await api.get('/snippets');

    if (!response.success) {
      throw new Error(response.error || 'Não foi possível carregar as frases prontas.');
    }

    setOfficialSnippets(Array.isArray(response.data?.official) ? response.data.official : []);
    setMySnippets(Array.isArray(response.data?.mine) ? response.data.mine : []);
  };

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');

    refresh()
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
    // Recarrega ao logar/deslogar para refletir os modelos pessoais.
  }, [user?.id]);

  const officialByType = useMemo(() => {
    const groups = new Map();

    officialSnippets.forEach((snippet) => {
      const type = snippet.snippetType || 'Outro';

      if (!groups.has(type)) {
        groups.set(type, []);
      }

      groups.get(type).push(snippet);
    });

    return [...groups.entries()];
  }, [officialSnippets]);

  // Sugestões do campo "Tipo": opções padrão + qualquer tipo já usado nos
  // modelos carregados (oficiais e do usuário). Assim tipos novos criados no
  // Notion — como "Anamnese" — aparecem para escolha sem precisar de deploy.
  const typeOptions = useMemo(() => {
    const seen = new Set();
    const ordered = [];

    [
      ...SNIPPET_TYPE_OPTIONS,
      ...officialSnippets.map((snippet) => snippet.snippetType),
      ...mySnippets.map((snippet) => snippet.snippetType),
    ].forEach((rawType) => {
      const type = String(rawType || '').trim();
      const key = type.toLocaleLowerCase('pt-BR');

      if (type && !seen.has(key)) {
        seen.add(key);
        ordered.push(type);
      }
    });

    return ordered;
  }, [officialSnippets, mySnippets]);

  const handleCopy = async (snippet) => {
    const copied = await copyToClipboard(snippet.body);

    if (copied) {
      setCopiedId(snippet.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const openEditor = (snippet = null) => {
    if (!user) {
      onLogin?.();
      return;
    }

    // Criar (novo ou clone de oficial) é Pro; editar um modelo já seu não.
    const isCreation = !snippet || snippet.source !== 'custom';

    if (isCreation && !isPro) {
      onRequestUpgrade?.();
      return;
    }

    setFormError('');
    setFormState(snippet
      ? {
          id: snippet.source === 'custom' ? snippet.id : null,
          title: snippet.title,
          body: snippet.body,
          snippetType: snippet.snippetType || 'Outro',
        }
      : EMPTY_SNIPPET_FORM);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError('');

    const payload = {
      title: formState.title,
      body: formState.body,
      snippetType: formState.snippetType,
    };

    try {
      const response = formState.id
        ? await api.put(`/snippets?id=${encodeURIComponent(formState.id)}`, payload)
        : await api.post('/snippets', payload);

      if (!response.success) {
        setFormError(response.error || 'Não foi possível salvar o modelo.');
        return;
      }

      await refresh();
      setEditorOpen(false);
      setFormState(EMPTY_SNIPPET_FORM);
    } catch (requestError) {
      setFormError(requestError.message || 'Não foi possível salvar o modelo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (snippet) => {
    const confirmed = window.confirm(`Excluir o modelo "${snippet.title}"?`);

    if (!confirmed) {
      return;
    }

    setError('');
    const response = await api.delete(`/snippets?id=${encodeURIComponent(snippet.id)}`);

    if (!response.success) {
      setError(response.error || 'Não foi possível excluir o modelo.');
      return;
    }

    await refresh().catch(() => null);
  };

  const renderSnippetCard = (snippet, { mine }) => (
    <article key={`${snippet.source}-${snippet.id}`} className="snippet-card">
      <div className="snippet-card-top">
        <div>
          <span className="template-category-chip">{snippet.snippetType || 'Outro'}</span>
          {mine ? <span className="template-category-chip">Meu modelo</span> : null}
          <h3>{snippet.title}</h3>
        </div>
      </div>

      <SnippetCardBody text={snippet.body} />

      <div className="snippet-card-actions">
        <button type="button" className="btn btn-secundario" onClick={() => handleCopy(snippet)}>
          {copiedId === snippet.id ? 'Copiado' : 'Copiar'}
        </button>
        {mine ? (
          <>
            <button type="button" className="btn btn-secundario" onClick={() => openEditor(snippet)}>
              Editar
            </button>
            <button type="button" className="btn btn-secundario" onClick={() => handleDelete(snippet)}>
              Excluir
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-secundario" onClick={() => openEditor(snippet)}>
            Adicionar às minhas
          </button>
        )}
      </div>
    </article>
  );

  return (
    <>
      <section className="templates-section templates-my-section">
        <div className="templates-section-header">
          <div>
            <h2>Minhas frases prontas</h2>
            <p>Modelos seus para copiar e colar na anamnese: exame físico normal, condutas, orientações.</p>
          </div>
          <div className="templates-toolbar-actions">
            <button type="button" className="btn btn-primario" onClick={() => openEditor()}>
              {isPro || !user ? 'Novo modelo' : 'Liberar modelos próprios'}
            </button>
          </div>
        </div>

        {error ? <div className="templates-inline-error">{error}</div> : null}

        {loading ? (
          <div className="affiliate-loading">Carregando frases prontas...</div>
        ) : mySnippets.length ? (
          <div className="snippets-grid">
            {mySnippets.map((snippet) => renderSnippetCard(snippet, { mine: true }))}
          </div>
        ) : (
          <div className="empty-state-hint">
            {user
              ? 'Você ainda não tem modelos próprios. Crie um novo ou use "Adicionar às minhas" em um modelo oficial abaixo.'
              : 'Entre na sua conta para salvar modelos próprios. Os modelos oficiais abaixo já estão liberados para copiar.'}
          </div>
        )}
      </section>

      <section className="templates-section">
        <div className="templates-section-header">
          <div>
            <h2>Modelos oficiais</h2>
            <p>Frases revisadas pela equipe, prontas para copiar ou usar como base dos seus modelos.</p>
          </div>
          <span className="templates-count">
            {loading ? 'Carregando...' : `${officialSnippets.length} modelo${officialSnippets.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {!loading && !officialSnippets.length ? (
          <div className="empty-state-hint">
            Nenhum modelo oficial publicado ainda.
          </div>
        ) : null}

        {officialByType.map(([type, snippets]) => (
          <div key={type} className="snippets-type-group">
            <h3 className="snippets-type-title">{type}</h3>
            <div className="snippets-grid">
              {snippets.map((snippet) => renderSnippetCard(snippet, { mine: false }))}
            </div>
          </div>
        ))}
      </section>

      {editorOpen ? (
        <div className="app-modal-backdrop" role="presentation" onClick={() => !saving && setEditorOpen(false)}>
          <div
            className="app-modal-card snippet-editor-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="snippet-editor-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="app-modal-header">
              <div>
                <span className="workspace-kicker">Frases prontas</span>
                <h2 id="snippet-editor-title">{formState.id ? 'Editar modelo' : 'Novo modelo'}</h2>
                <p>O texto salvo fica pronto para copiar ou inserir direto na anamnese.</p>
              </div>
              <button type="button" className="btn btn-secundario" onClick={() => setEditorOpen(false)} disabled={saving}>
                Fechar
              </button>
            </div>

            <div className="snippet-editor-form">
              <label htmlFor="snippet-title">Título</label>
              <input
                id="snippet-title"
                type="text"
                value={formState.title}
                maxLength={80}
                onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex.: Exame físico normal — feminino"
              />

              <label htmlFor="snippet-type">Tipo</label>
              <input
                id="snippet-type"
                type="text"
                list="snippet-type-options"
                value={formState.snippetType}
                maxLength={40}
                onChange={(event) => setFormState((current) => ({ ...current, snippetType: event.target.value }))}
                placeholder="Escolha ou digite um tipo"
                autoComplete="off"
              />
              <datalist id="snippet-type-options">
                {typeOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>

              <label htmlFor="snippet-body">Texto do modelo</label>
              <textarea
                id="snippet-body"
                value={formState.body}
                maxLength={4000}
                onChange={(event) => setFormState((current) => ({ ...current, body: event.target.value }))}
                placeholder={'EXAME FÍSICO\nBEG, CORADO(A), HIDRATADO(A)...'}
              />
            </div>

            {formError ? <div className="templates-inline-error">{formError}</div> : null}

            <div className="app-modal-actions">
              <button type="button" className="btn btn-secundario" onClick={() => setEditorOpen(false)} disabled={saving}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primario" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar modelo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default SnippetsSection;

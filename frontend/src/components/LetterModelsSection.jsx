import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../apiClient';
import { LETTER_TYPES, LETTER_TYPES_BY_KEY, DEFAULT_LETTER_TYPE_KEY } from '../letterTypes';

const EMPTY_MODEL_FORM = {
  id: null,
  title: '',
  letterType: DEFAULT_LETTER_TYPE_KEY,
  formatBody: '',
  isDefault: false,
};

function typeLabel(key) {
  return LETTER_TYPES_BY_KEY[key]?.label || 'Outro';
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Corpo rolável: o usuário lê o formato inteiro sem sair do card; o fade só
// aparece enquanto ainda há conteúdo abaixo do que está visível.
function ModelCardBody({ text }) {
  const ref = useRef(null);
  const [showFade, setShowFade] = useState(false);

  const updateFade = () => {
    const element = ref.current;
    if (element) {
      setShowFade(element.scrollHeight - element.clientHeight - element.scrollTop > 2);
    }
  };

  useLayoutEffect(() => {
    updateFade();
  }, [text]);

  return (
    <div className={`snippet-card-body-wrap letter-model-body-wrap ${showFade ? 'is-clipped' : ''}`}>
      <pre className="snippet-card-body letter-model-body" ref={ref} onScroll={updateFade}>{text}</pre>
    </div>
  );
}

// Aba "Modelos de carta" da biblioteca: modelos de formato por tipo (oficiais do
// CMS + do usuário). Criar/editar é Pro; ver/copiar é liberado.
function LetterModelsSection({ user, isPro, onRequestUpgrade, onLogin }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [official, setOfficial] = useState([]);
  const [mine, setMine] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_MODEL_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const refresh = async () => {
    const response = await api.get('/letter-models');

    if (!response.success) {
      throw new Error(response.error || 'Não foi possível carregar os modelos de carta.');
    }

    setOfficial(Array.isArray(response.data?.official) ? response.data.official : []);
    setMine(Array.isArray(response.data?.mine) ? response.data.mine : []);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    refresh()
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message || 'Não foi possível carregar os modelos de carta.');
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
  }, [user?.id]);

  const officialByType = useMemo(() => {
    const groups = new Map();
    official.forEach((model) => {
      if (!groups.has(model.letterType)) {
        groups.set(model.letterType, []);
      }
      groups.get(model.letterType).push(model);
    });
    return [...groups.entries()];
  }, [official]);

  const handleCopy = async (model) => {
    const copied = await copyToClipboard(model.formatBody);
    if (copied) {
      setCopiedId(model.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const openEditor = (model = null) => {
    if (!user) {
      onLogin?.();
      return;
    }

    const isCreation = !model || model.source !== 'custom';

    if (isCreation && !isPro) {
      onRequestUpgrade?.();
      return;
    }

    setFormError('');
    setFormState(model
      ? {
          id: model.source === 'custom' ? model.id : null,
          title: model.source === 'custom' ? model.title : `${model.title} (cópia)`,
          letterType: model.letterType || DEFAULT_LETTER_TYPE_KEY,
          formatBody: model.formatBody,
          isDefault: Boolean(model.isDefault),
        }
      : EMPTY_MODEL_FORM);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError('');

    const payload = {
      title: formState.title,
      letterType: formState.letterType,
      formatBody: formState.formatBody,
      isDefault: formState.isDefault,
    };

    try {
      const response = formState.id
        ? await api.put(`/letter-models?id=${encodeURIComponent(formState.id)}`, payload)
        : await api.post('/letter-models', payload);

      if (!response.success) {
        setFormError(response.error || 'Não foi possível salvar o modelo.');
        return;
      }

      await refresh();
      setEditorOpen(false);
      setFormState(EMPTY_MODEL_FORM);
    } catch (requestError) {
      setFormError(requestError.message || 'Não foi possível salvar o modelo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (model) => {
    if (!window.confirm(`Excluir o modelo "${model.title}"?`)) {
      return;
    }

    setError('');
    const response = await api.delete(`/letter-models?id=${encodeURIComponent(model.id)}`);

    if (!response.success) {
      setError(response.error || 'Não foi possível excluir o modelo.');
      return;
    }

    await refresh().catch(() => null);
  };

  const renderCard = (model, { mine: isMine }) => (
    <article key={`${model.source}-${model.id}`} className="snippet-card">
      <div className="snippet-card-top">
        <div>
          <span className="template-category-chip">{typeLabel(model.letterType)}</span>
          {isMine && model.isDefault ? <span className="template-category-chip">Padrão</span> : null}
          {isMine ? <span className="template-category-chip">Meu modelo</span> : null}
          <h3>{model.title}</h3>
        </div>
      </div>

      <ModelCardBody text={model.formatBody} />

      <div className="snippet-card-actions">
        <button type="button" className="btn btn-secundario" onClick={() => handleCopy(model)}>
          {copiedId === model.id ? 'Copiado' : 'Copiar'}
        </button>
        {isMine ? (
          <>
            <button type="button" className="btn btn-secundario" onClick={() => openEditor(model)}>Editar</button>
            <button type="button" className="btn btn-secundario" onClick={() => handleDelete(model)}>Excluir</button>
          </>
        ) : (
          <button type="button" className="btn btn-secundario" onClick={() => openEditor(model)}>Adicionar às minhas</button>
        )}
      </div>
    </article>
  );

  return (
    <>
      <section className="templates-section templates-my-section">
        <div className="templates-section-header">
          <div>
            <h2>Meus modelos de carta</h2>
            <p>Formatos reutilizáveis por tipo de documento — inclua aqui seu cabeçalho e assinatura fixos (nome, CRM, clínica).</p>
          </div>
          <div className="templates-toolbar-actions">
            <button type="button" className="btn btn-primario" onClick={() => openEditor()}>
              {isPro || !user ? 'Novo modelo' : 'Liberar modelos próprios'}
            </button>
          </div>
        </div>

        {error ? <div className="templates-inline-error">{error}</div> : null}

        {loading ? (
          <div className="affiliate-loading">Carregando modelos...</div>
        ) : mine.length ? (
          <div className="snippets-grid">
            {mine.map((model) => renderCard(model, { mine: true }))}
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
            <p>Formatos revisados pela equipe, prontos para copiar ou usar como base dos seus.</p>
          </div>
          <span className="templates-count">
            {loading ? 'Carregando...' : `${official.length} modelo${official.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {!loading && !official.length ? (
          <div className="empty-state-hint">Nenhum modelo oficial publicado ainda.</div>
        ) : null}

        {officialByType.map(([type, models]) => (
          <div key={type} className="snippets-type-group">
            <h3 className="snippets-type-title">{typeLabel(type)}</h3>
            <div className="snippets-grid">
              {models.map((model) => renderCard(model, { mine: false }))}
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
            aria-labelledby="letter-model-editor-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="app-modal-header">
              <div>
                <span className="workspace-kicker">Modelos de carta</span>
                <h2 id="letter-model-editor-title">{formState.id ? 'Editar modelo' : 'Novo modelo'}</h2>
                <p>Use [colchetes] para o que a IA preenche e escreva fixo o cabeçalho/assinatura.</p>
              </div>
              <button type="button" className="btn btn-secundario" onClick={() => setEditorOpen(false)} disabled={saving}>
                Fechar
              </button>
            </div>

            <div className="snippet-editor-form">
              <label htmlFor="letter-model-title">Título</label>
              <input
                id="letter-model-title"
                type="text"
                value={formState.title}
                maxLength={80}
                onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex.: Encaminhamento com meu carimbo"
              />

              <label htmlFor="letter-model-type">Tipo de documento</label>
              <select
                id="letter-model-type"
                value={formState.letterType}
                onChange={(event) => setFormState((current) => ({ ...current, letterType: event.target.value }))}
              >
                {LETTER_TYPES.map((type) => (
                  <option key={type.key} value={type.key}>{type.label}</option>
                ))}
              </select>

              <label htmlFor="letter-model-body">Formato</label>
              <textarea
                id="letter-model-body"
                value={formState.formatBody}
                maxLength={4000}
                onChange={(event) => setFormState((current) => ({ ...current, formatBody: event.target.value }))}
                placeholder={'CARTA DE ENCAMINHAMENTO\n\nAo colega da [especialidade],\n...\n\nAtenciosamente,\nDr(a). Nome — CRM 00000'}
              />

              <label className="letter-model-default-toggle">
                <input
                  type="checkbox"
                  checked={formState.isDefault}
                  onChange={(event) => setFormState((current) => ({ ...current, isDefault: event.target.checked }))}
                />
                Usar como padrão deste tipo
              </label>
            </div>

            {formError ? <div className="templates-inline-error">{formError}</div> : null}

            <div className="app-modal-actions">
              <button type="button" className="btn btn-secundario" onClick={() => setEditorOpen(false)} disabled={saving}>Cancelar</button>
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

export default LetterModelsSection;

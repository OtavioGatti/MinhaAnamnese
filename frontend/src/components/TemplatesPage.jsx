import { useMemo, useState } from 'react';
import { api } from '../apiClient';
import { guides } from '../data/guides';
import { officialTemplateCatalog, templateCategories } from '../data/officialTemplateCatalog';
import { templateStructures } from '../data/templateStructures';

const EMPTY_TEMPLATE_FORM = {
  id: null,
  name: '',
  description: '',
  sections: '',
};

function normalizeText(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getSectionsText(template) {
  return (template?.secoes || template?.structure || []).join('\n');
}

function TemplatesPage({
  templates,
  loadingTemplates,
  selectedTemplateId,
  onUseTemplate,
  onTemplatesRefresh,
  isPro,
  loadingCheckout,
  checkoutError,
  onRequestUpgrade,
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [previewTemplateId, setPreviewTemplateId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_TEMPLATE_FORM);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState('');

  const officialTemplates = useMemo(() => (
    templates
      .filter((template) => template.source !== 'custom')
      .map((template) => {
        const catalogEntry = officialTemplateCatalog[template.id] || {};
        const structure = template.secoes || templateStructures[template.id] || [];
        const checklist = Array.isArray(template.guide) && template.guide.length
          ? template.guide
          : guides[template.id] || [];

        return {
          id: template.id,
          name: template.nome,
          category: template.category || catalogEntry.category || 'Template oficial',
          description: template.description || catalogEntry.description || 'Template oficial disponível para organizar este tipo de anamnese.',
          whenToUse: template.whenToUse || catalogEntry.whenToUse || 'Use este template quando precisar de uma estrutura clínica padronizada.',
          hasCalculators: Boolean(catalogEntry.hasCalculators),
          structure,
          checklist,
          source: 'official',
        };
      })
  ), [templates]);

  const customTemplates = useMemo(() => (
    templates
      .filter((template) => template.source === 'custom')
      .map((template) => ({
        id: template.id,
        name: template.nome,
        category: 'Meu template',
        description: template.description || 'Estrutura personalizada salva para sua rotina.',
        whenToUse: 'Use quando quiser organizar a anamnese seguindo sua estrutura própria.',
        hasCalculators: false,
        structure: template.secoes || [],
        checklist: [],
        source: 'custom',
      }))
  ), [templates]);

  const allTemplates = useMemo(() => (
    [...officialTemplates, ...customTemplates]
  ), [customTemplates, officialTemplates]);

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    return officialTemplates.filter((template) => {
      const matchesCategory = categoryFilter === 'Todos' || template.category === categoryFilter;
      const matchesSearch = !normalizedSearch || [
        template.name,
        template.category,
        template.description,
      ].some((value) => normalizeText(value).includes(normalizedSearch));

      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, officialTemplates, search]);

  const previewTemplate = allTemplates.find((template) => template.id === previewTemplateId) || null;
  const canManageTemplates = Boolean(isPro);

  const openPreview = (templateId) => {
    setPreviewTemplateId(templateId);
  };

  const handleUseTemplate = (templateId) => {
    onUseTemplate(templateId);
    setPreviewTemplateId(null);
  };

  const openTemplateEditor = (template = null) => {
    if (!canManageTemplates) {
      setTemplateError('Templates próprios são um recurso do plano profissional.');
      onRequestUpgrade?.();
      return;
    }

    setTemplateError('');
    setFormState(template
      ? {
          id: template.id,
          name: template.name,
          description: template.description,
          sections: getSectionsText(template),
        }
      : EMPTY_TEMPLATE_FORM);
    setEditorOpen(true);
  };

  const closeTemplateEditor = () => {
    if (savingTemplate) {
      return;
    }

    setEditorOpen(false);
    setTemplateError('');
    setFormState(EMPTY_TEMPLATE_FORM);
  };

  const handleTemplateFormChange = (field, value) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSaveTemplate = async (event) => {
    event.preventDefault();

    if (!canManageTemplates) {
      setTemplateError('Templates próprios são um recurso do plano profissional.');
      onRequestUpgrade?.();
      return;
    }

    setSavingTemplate(true);
    setTemplateError('');

    const payload = {
      name: formState.name,
      description: formState.description,
      sections: formState.sections
        .split(/\r?\n/g)
        .map((section) => section.trim())
        .filter(Boolean),
    };
    const response = formState.id
      ? await api.put(`/templates?id=${encodeURIComponent(formState.id)}`, payload)
      : await api.post('/templates', payload);

    if (!response.success) {
      setTemplateError(response.error || 'Não foi possível salvar o template.');
      setSavingTemplate(false);
      return;
    }

    await onTemplatesRefresh?.();
    setSavingTemplate(false);
    setEditorOpen(false);
    setFormState(EMPTY_TEMPLATE_FORM);
  };

  const handleDeleteTemplate = async (template) => {
    if (!canManageTemplates) {
      setTemplateError('Templates próprios são um recurso do plano profissional.');
      onRequestUpgrade?.();
      return;
    }

    const confirmed = window.confirm(`Excluir o template "${template.name}"?`);

    if (!confirmed) {
      return;
    }

    setTemplateError('');
    const response = await api.delete(`/templates?id=${encodeURIComponent(template.id)}`);

    if (!response.success) {
      setTemplateError(response.error || 'Não foi possível excluir o template.');
      return;
    }

    if (previewTemplateId === template.id) {
      setPreviewTemplateId(null);
    }

    await onTemplatesRefresh?.();
  };

  return (
    <div className="templates-page">
      <section className="workspace-surface templates-hero">
        <div className="templates-hero-copy">
          <span className="workspace-kicker">Biblioteca clínica</span>
          <h1>Templates clínicos</h1>
          <p>
            Escolha um modelo oficial ou salve suas próprias estruturas para organizar a anamnese do jeito que você usa no dia a dia.
          </p>
        </div>

        <div className="templates-toolbar">
          <label className="templates-search">
            <span>Buscar template oficial</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex.: obstetrícia, triagem, clínica médica"
            />
          </label>

          <div className="templates-toolbar-actions">
            <button type="button" className="btn btn-primario" onClick={() => openTemplateEditor()} disabled={loadingCheckout}>
              {canManageTemplates
                ? 'Novo template'
                : loadingCheckout
                  ? 'Abrindo checkout...'
                  : 'Liberar templates'}
            </button>
          </div>
        </div>

        <div className="templates-filters" aria-label="Filtrar templates por categoria">
          {templateCategories.map((category) => (
            <button
              key={category}
              type="button"
              className={`templates-filter-chip ${categoryFilter === category ? 'active' : ''}`}
              onClick={() => setCategoryFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <section className="templates-section templates-my-section">
        <div className="templates-section-header">
          <div>
            <h2>Meus templates</h2>
            <p>Salve estruturas que você usa na rotina e aplique na Home como qualquer modelo clínico.</p>
          </div>
          <span className="templates-count">
            {loadingTemplates ? 'Carregando...' : `${customTemplates.length} template${customTemplates.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {templateError || checkoutError ? (
          <div className="templates-inline-error">{templateError || checkoutError}</div>
        ) : null}

        {customTemplates.length ? (
          <div className="custom-templates-grid">
            {customTemplates.map((template) => (
              <article
                key={template.id}
                className={`template-card ${selectedTemplateId === template.id ? 'selected' : ''}`}
              >
                <div className="template-card-top">
                  <div>
                    <span className="template-category-chip">Personalizado</span>
                    <h3>{template.name}</h3>
                  </div>
                </div>

                <p className="template-description">{template.description}</p>

                <div className="template-preview-list">
                  <strong>Estrutura salva</strong>
                  <div className="template-preview-tags">
                    {template.structure.slice(0, 5).map((item) => (
                      <span key={item} className="template-tag">{item}</span>
                    ))}
                    {template.structure.length > 5 ? (
                      <span className="template-tag template-tag-muted">+{template.structure.length - 5}</span>
                    ) : null}
                  </div>
                </div>

                <div className="template-card-actions custom-template-actions">
                  <button
                    type="button"
                    className="btn btn-primario"
                    onClick={() => handleUseTemplate(template.id)}
                  >
                    Usar template
                  </button>
                  <button
                    type="button"
                    className="btn btn-secundario"
                    onClick={() => openPreview(template.id)}
                  >
                    Ver
                  </button>
                  {canManageTemplates ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-secundario"
                        onClick={() => openTemplateEditor(template)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secundario"
                        onClick={() => handleDeleteTemplate(template)}
                      >
                        Excluir
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secundario"
                      onClick={() => openTemplateEditor(template)}
                      disabled={loadingCheckout}
                    >
                      {loadingCheckout ? 'Abrindo checkout...' : 'Editar no Pro'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="templates-future-empty">
            <div>
              <strong>{canManageTemplates ? 'Crie sua biblioteca própria de modelos.' : 'Templates próprios fazem parte do plano profissional.'}</strong>
              <span>
                {canManageTemplates
                  ? 'Use uma estrutura que já faz parte da sua rotina, salve uma vez e aplique sempre que precisar organizar uma anamnese nesse formato.'
                  : 'No Pro você salva seus modelos de rotina e usa essas estruturas diretamente na Home, sem depender apenas dos templates oficiais.'}
              </span>
            </div>
            <button type="button" className="btn btn-primario" onClick={() => openTemplateEditor()} disabled={loadingCheckout}>
              {canManageTemplates
                ? 'Criar template'
                : loadingCheckout
                  ? 'Abrindo checkout...'
                  : 'Liberar plano profissional'}
            </button>
          </div>
        )}
      </section>

      <section className="templates-section">
        <div className="templates-section-header">
          <div>
            <h2>Templates oficiais</h2>
            <p>Modelos prontos para uso, organizados por contexto clínico e já integrados à Home.</p>
          </div>
          <span className="templates-count">
            {loadingTemplates ? 'Carregando...' : `${filteredTemplates.length} template${filteredTemplates.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {loadingTemplates ? (
          <div className="templates-loading-state">
            Carregando templates...
          </div>
        ) : (
          <div className="templates-layout">
            <div className="templates-grid">
              {filteredTemplates.map((template) => (
                <article
                  key={template.id}
                  className={`template-card ${selectedTemplateId === template.id ? 'selected' : ''}`}
                >
                  <div className="template-card-top">
                    <div>
                      <span className="template-category-chip">{template.category}</span>
                      <h3>{template.name}</h3>
                    </div>
                    {template.hasCalculators ? (
                      <span className="template-feature-chip">Calculadoras</span>
                    ) : null}
                  </div>

                  <p className="template-description">{template.description}</p>

                  <div className="template-preview-list">
                    <strong>Seções principais</strong>
                    <div className="template-preview-tags">
                      {template.structure.slice(0, 4).map((item) => (
                        <span key={item} className="template-tag">{item}</span>
                      ))}
                      {template.structure.length > 4 ? (
                        <span className="template-tag template-tag-muted">+{template.structure.length - 4}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="template-card-actions">
                    <button
                      type="button"
                      className="btn btn-primario"
                      onClick={() => handleUseTemplate(template.id)}
                    >
                      Usar template
                    </button>
                    <button
                      type="button"
                      className="btn btn-secundario"
                      onClick={() => openPreview(template.id)}
                    >
                      Ver estrutura
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <aside className="template-preview-panel">
              {previewTemplate ? (
                <>
                  <div className="template-preview-header">
                    <span className="template-category-chip">{previewTemplate.category}</span>
                    <h3>{previewTemplate.name}</h3>
                    <p>{previewTemplate.whenToUse}</p>
                  </div>

                  <div className="template-preview-block">
                    <strong>Estrutura esperada</strong>
                    <ol>
                      {previewTemplate.structure.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  </div>

                  {previewTemplate.source === 'official' ? (
                    <>
                      <div className="template-preview-block">
                        <strong>Checklist resumido</strong>
                        <ul>
                          {previewTemplate.checklist.slice(0, 6).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="template-preview-block">
                        <strong>Ferramentas vinculadas</strong>
                        <p>
                          {previewTemplate.hasCalculators
                            ? 'Este template possui calculadoras de apoio integradas à Home.'
                            : 'Este template não possui calculadoras vinculadas no momento.'}
                        </p>
                      </div>
                    </>
                  ) : null}

                  <button
                    type="button"
                    className="btn btn-primario template-preview-use"
                    onClick={() => handleUseTemplate(previewTemplate.id)}
                  >
                    Usar este template
                  </button>
                </>
              ) : (
                <div className="template-preview-empty">
                  <strong>Prévia do template</strong>
                  <span>
                    Selecione um template para ver quando usar, a estrutura esperada e os pontos principais da coleta.
                  </span>
                </div>
              )}
            </aside>
          </div>
        )}
      </section>

      {editorOpen ? (
        <div className="app-modal-backdrop" role="presentation" onClick={closeTemplateEditor}>
          <form
            className="app-modal-card template-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-editor-title"
            onSubmit={handleSaveTemplate}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="app-modal-header">
              <div>
                <span className="workspace-kicker">Template próprio</span>
                <h2 id="template-editor-title">
                  {formState.id ? 'Editar template' : 'Criar template'}
                </h2>
                <p>Defina o nome e escreva as seções na ordem em que você quer ver o resultado estruturado.</p>
              </div>
              <button type="button" className="btn btn-secundario" onClick={closeTemplateEditor}>
                Fechar
              </button>
            </div>

            <label className="template-editor-field">
              <span>Nome do template</span>
              <input
                type="text"
                value={formState.name}
                onChange={(event) => handleTemplateFormChange('name', event.target.value)}
                placeholder="Ex.: Retorno de cardiologia"
                maxLength={80}
                required
              />
            </label>

            <label className="template-editor-field">
              <span>Descrição curta</span>
              <input
                type="text"
                value={formState.description}
                onChange={(event) => handleTemplateFormChange('description', event.target.value)}
                placeholder="Quando usar este modelo"
                maxLength={240}
              />
            </label>

            <label className="template-editor-field">
              <span>Seções do resultado</span>
              <textarea
                value={formState.sections}
                onChange={(event) => handleTemplateFormChange('sections', event.target.value)}
                placeholder={'Identificação\nQueixa principal\nHistória da moléstia atual\nMedicações em uso\nExame físico\nConduta'}
                rows={10}
                required
              />
            </label>

            <div className="template-editor-helper">
              Escreva uma seção por linha. O produto usará essa ordem para organizar a anamnese e calcular a revisão estrutural.
            </div>

            {templateError ? (
              <div className="templates-inline-error">{templateError}</div>
            ) : null}

            <div className="app-modal-actions">
              <button type="button" className="btn btn-secundario" onClick={closeTemplateEditor}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primario" disabled={savingTemplate}>
                {savingTemplate ? 'Salvando...' : 'Salvar template'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default TemplatesPage;

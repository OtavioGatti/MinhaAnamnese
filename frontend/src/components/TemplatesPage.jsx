import { useMemo, useState } from 'react';
import { guides } from '../data/guides';
import { officialTemplateCatalog, templateCategories } from '../data/officialTemplateCatalog';
import { templateStructures } from '../data/templateStructures';

function normalizeText(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function TemplatesPage({
  templates,
  loadingTemplates,
  selectedTemplateId,
  onUseTemplate,
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [previewTemplateId, setPreviewTemplateId] = useState(null);

  const officialTemplates = useMemo(() => (
    templates.map((template) => {
      const catalogEntry = officialTemplateCatalog[template.id] || {};
      const structure = templateStructures[template.id] || [];
      const checklist = guides[template.id] || [];

      return {
        id: template.id,
        name: template.nome,
        category: catalogEntry.category || 'Template oficial',
        description: catalogEntry.description || 'Template oficial disponível para organizar este tipo de anamnese.',
        whenToUse: catalogEntry.whenToUse || 'Use este template quando precisar de uma estrutura clínica padronizada.',
        hasCalculators: Boolean(catalogEntry.hasCalculators),
        structure,
        checklist,
      };
    })
  ), [templates]);

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

  const previewTemplate = officialTemplates.find((template) => template.id === previewTemplateId) || null;

  const openPreview = (templateId) => {
    setPreviewTemplateId(templateId);
  };

  const handleUseTemplate = (templateId) => {
    onUseTemplate(templateId);
    setPreviewTemplateId(null);
  };

  return (
    <div className="templates-page">
      <section className="workspace-surface templates-hero">
        <div className="templates-hero-copy">
          <span className="workspace-kicker">Biblioteca oficial</span>
          <h1>Templates clínicos</h1>
          <p>
            Escolha o modelo mais adequado para o contexto do atendimento, veja a estrutura esperada e siga para a Home com tudo pronto para começar.
          </p>
        </div>

        <div className="templates-toolbar">
          <label className="templates-search">
            <span>Buscar template</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex.: obstetrícia, triagem, clínica médica"
            />
          </label>

          <div className="templates-toolbar-actions">
            <button type="button" className="btn btn-secundario" disabled>
              Novo template
              <span className="templates-soon-chip">Em breve</span>
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
            Carregando templates oficiais...
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
                    Selecione um template oficial para ver quando usar, a estrutura esperada e os pontos principais da coleta.
                  </span>
                </div>
              )}
            </aside>
          </div>
        )}
      </section>

      <section className="templates-section templates-future-section">
        <div className="templates-section-header">
          <div>
            <h2>Meus templates</h2>
            <p>Espaço reservado para sua biblioteca própria de estruturas clínicas.</p>
          </div>
        </div>

        <div className="templates-future-empty">
          <div>
            <strong>Em breve você poderá criar e personalizar seus próprios templates.</strong>
            <span>
              A interface já está preparada para evolução com templates próprios, favoritos, duplicação de modelos oficiais e checklists personalizados.
            </span>
          </div>
          <button type="button" className="btn btn-secundario" disabled>
            Criar template
            <span className="templates-soon-chip">Em breve</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export default TemplatesPage;

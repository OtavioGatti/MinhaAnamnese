import CalculatorPanel from './CalculatorPanel';
import GuidePanel from './GuidePanel';
import { guides } from '../data/guides';
import { templateStructures } from '../data/templateStructures';

const TABS = [
  {
    id: 'guide',
    label: 'Guia clínico',
    shortLabel: 'Guia',
    description: 'Consulte os pontos mais importantes do modelo enquanto coleta e escreve.',
  },
  {
    id: 'checklist',
    label: 'Checklist',
    shortLabel: 'Checklist',
    description: 'Use uma revisão rápida para não deixar blocos essenciais de fora.',
  },
  {
    id: 'calculator',
    label: 'Calculadoras',
    shortLabel: 'Calculadoras',
    description: 'Acesse ferramentas de apoio sem sair do fluxo principal.',
  },
  {
    id: 'structure',
    label: 'Estrutura',
    shortLabel: 'Estrutura',
    description: 'Veja como o resultado final será organizado para este modelo.',
  },
];

function WorkspaceSidebar({
  activeTab,
  onChangeTab,
  templateSelecionado,
  templateNome,
  templateTemCalculadora,
}) {
  const guideItems = guides[templateSelecionado] || [];
  const hasGuide = guideItems.length > 0;
  const structureItems = templateStructures[templateSelecionado] || [];
  const hasStructure = structureItems.length > 0;
  const selectedTab = TABS.find((tab) => tab.id === activeTab);
  const hasTemplate = Boolean(templateSelecionado);

  const renderContent = () => {
    if (activeTab === 'guide') {
      return hasGuide ? (
        <div className="workspace-sidebar-section">
          <p className="workspace-sidebar-copy">
            Consulte os pontos do modelo enquanto coleta, escreve e revisa a anamnese.
          </p>
          <GuidePanel
            templateSelecionado={templateSelecionado}
            templateNome={templateNome}
            aberto
            secondary
          />
        </div>
      ) : (
        <div className="workspace-sidebar-empty">
          {'Selecione um modelo para abrir o guia cl\u00ednico correspondente.'}
        </div>
      );
    }

    if (activeTab === 'checklist') {
      return hasGuide ? (
        <div className="workspace-sidebar-section">
          <p className="workspace-sidebar-copy">
            Revise estes pontos antes de organizar a anamnese para reduzir lacunas na estrutura final.
          </p>
          <ul className="workspace-checklist">
            {guideItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="workspace-sidebar-empty">
          {'O checklist aparece quando um modelo cl\u00ednico \u00e9 selecionado.'}
        </div>
      );
    }

    if (activeTab === 'calculator') {
      return templateTemCalculadora ? (
        <div className="workspace-sidebar-section workspace-sidebar-calculator">
          <p className="workspace-sidebar-copy">
            Use estas calculadoras como apoio durante a coleta, sem sair da homepage.
          </p>
          <CalculatorPanel />
        </div>
      ) : (
        <div className="workspace-sidebar-empty">
          {'Este modelo ainda n\u00e3o possui calculadoras de apoio dispon\u00edveis.'}
        </div>
      );
    }

    return hasStructure ? (
      <div className="workspace-sidebar-section">
        <p className="workspace-sidebar-copy">
          {'A organiza\u00e7\u00e3o final segue estas se\u00e7\u00f5es no resultado estruturado.'}
        </p>
        <div className="workspace-structure-list">
          {structureItems.map((item, index) => (
            <div key={item} className="workspace-structure-item">
              <span className="workspace-structure-order">{index + 1}</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div className="workspace-sidebar-empty">
        {'A estrutura do modelo aparecer\u00e1 aqui assim que voc\u00ea selecionar um tipo de anamnese.'}
      </div>
    );
  };

  return (
    <aside className="workspace-sidebar">
      <div className="workspace-sidebar-header">
        <div>
          <h2>Apoio contextual</h2>
          <p>{'Use este painel como refer\u00eancia r\u00e1pida durante a coleta, a escrita e a revis\u00e3o.'}</p>
        </div>
      </div>

      <div className="workspace-sidebar-tabs" role="tablist" aria-label="Apoio contextual">
        {TABS.map((tab) => {
          const isDisabled = tab.id === 'calculator' && !templateTemCalculadora;

          return (
            <button
              key={tab.id}
              type="button"
              className={`workspace-sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onChangeTab(tab.id)}
              disabled={isDisabled}
            >
              <strong>{tab.shortLabel}</strong>
              <span>{tab.id === 'structure' ? 'Resultado esperado' : tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="workspace-sidebar-body">
        <div className="workspace-sidebar-current-tab">
          <strong>{selectedTab?.label || 'Apoio contextual'}</strong>
          <span>
            {hasTemplate
              ? selectedTab?.description
              : 'Escolha um modelo para ver o guia, a checklist, as calculadoras e a estrutura esperada.'}
          </span>
          {templateNome ? (
            <div className="workspace-sidebar-template-chip">{templateNome}</div>
          ) : null}
        </div>
        {renderContent()}
      </div>
    </aside>
  );
}

export default WorkspaceSidebar;

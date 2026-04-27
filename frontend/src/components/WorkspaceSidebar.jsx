import CalculatorPanel from './CalculatorPanel';
import GuidePanel from './GuidePanel';
import { guides } from '../data/guides';

const TABS = [
  {
    id: 'guide',
    label: 'Guia cl\u00ednico',
    shortLabel: 'Guia',
    description: 'Consulte os pontos mais importantes do modelo enquanto coleta e escreve.',
  },
  {
    id: 'calculator',
    label: 'Calculadoras',
    shortLabel: 'Calculadoras',
    description: 'Acesse ferramentas de apoio sem sair do fluxo principal.',
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
  const availableTabs = TABS.filter((tab) => tab.id !== 'calculator' || templateTemCalculadora);
  const safeActiveTab = availableTabs.some((tab) => tab.id === activeTab) ? activeTab : 'guide';
  const selectedTab = TABS.find((tab) => tab.id === safeActiveTab);
  const hasTemplate = Boolean(templateSelecionado);

  const renderContent = () => {
    if (safeActiveTab === 'calculator') {
      return (
        <div className="workspace-sidebar-section workspace-sidebar-calculator">
          <p className="workspace-sidebar-copy">
            Use estas calculadoras como apoio durante a coleta, sem sair da homepage.
          </p>
          <CalculatorPanel />
        </div>
      );
    }

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
  };

  return (
    <aside className="workspace-sidebar">
      <div className="workspace-sidebar-header">
        <div>
          <h2>Apoio contextual</h2>
          <p>{'Use este painel como refer\u00eancia r\u00e1pida durante a coleta, a escrita e a revis\u00e3o.'}</p>
        </div>
      </div>

      {availableTabs.length > 1 ? (
        <div className="workspace-sidebar-tabs" role="tablist" aria-label="Apoio contextual">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`workspace-sidebar-tab ${safeActiveTab === tab.id ? 'active' : ''}`}
              onClick={() => onChangeTab(tab.id)}
            >
              <strong>{tab.shortLabel}</strong>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="workspace-sidebar-body">
        <div className="workspace-sidebar-current-tab">
          <strong>{selectedTab?.label || 'Guia cl\u00ednico'}</strong>
          <span>
            {hasTemplate
              ? selectedTab?.description
              : 'Escolha um modelo para ver o guia cl\u00ednico correspondente.'}
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

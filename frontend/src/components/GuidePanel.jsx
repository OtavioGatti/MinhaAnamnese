import { guides } from '../data/guides';

function GuidePanel({ templateSelecionado, templateNome, aberto }) {
  const guia = guides[templateSelecionado];

  if (!guia || !aberto) return null;

  return (
    <aside className="guide-panel" data-visible="true">
      <div className="guide-panel-content" key={templateSelecionado}>
        <div className="guide-header">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <div className="guide-heading">
            <h3>Guia clínico</h3>
            <p>{templateNome || 'Modelo clínico selecionado'}</p>
          </div>
        </div>
        <ul className="guide-list">
          {guia.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export default GuidePanel;


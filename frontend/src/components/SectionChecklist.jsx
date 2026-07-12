const STATUS_META = {
  present: { symbol: '✓', label: 'Registrada' },
  partial: { symbol: '!', label: 'Parcial' },
  missing: { symbol: '✕', label: 'Ausente' },
  not_applicable: { symbol: '—', label: 'Não se aplica' },
};

function getSectionDetail(section) {
  if (section.status === 'partial') {
    return section.issue || section.recommendation || '';
  }

  if (section.status === 'missing') {
    return section.recommendation || section.issue || '';
  }

  return '';
}

// Checklist seção a seção da análise unificada: mostra, para cada bloco do
// template, se foi registrado, ficou parcial ou está ausente — o resumo visual
// de "onde documentei bem e onde faltou" que o texto corrido não entrega.
function SectionChecklist({ sections }) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return null;
  }

  const counts = sections.reduce(
    (accumulator, section) => {
      accumulator[section.status] = (accumulator[section.status] || 0) + 1;
      return accumulator;
    },
    {},
  );
  const summaryParts = [
    counts.present ? `${counts.present} registrada${counts.present === 1 ? '' : 's'}` : '',
    counts.partial ? `${counts.partial} parcia${counts.partial === 1 ? 'l' : 'is'}` : '',
    counts.missing ? `${counts.missing} ausente${counts.missing === 1 ? '' : 's'}` : '',
    counts.not_applicable ? `${counts.not_applicable} não se aplica` : '',
  ].filter(Boolean);

  return (
    <div className="section-checklist">
      <div className="section-checklist-header">
        <strong>Cobertura por seção</strong>
        <span>{summaryParts.join(' · ')}</span>
      </div>

      <ul className="section-checklist-list">
        {sections.map((section) => {
          const meta = STATUS_META[section.status] || STATUS_META.missing;
          const detail = getSectionDetail(section);

          return (
            <li
              key={section.id || section.label}
              className={`section-checklist-item section-checklist-${section.status}`}
            >
              <span className="section-checklist-icon" aria-hidden="true">{meta.symbol}</span>
              <div className="section-checklist-copy">
                <div className="section-checklist-row">
                  <strong>{section.label}</strong>
                  <span className="section-checklist-status">{meta.label}</span>
                </div>
                {detail ? <small>{detail}</small> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default SectionChecklist;

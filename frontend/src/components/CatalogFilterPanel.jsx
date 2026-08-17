import { useId, useState } from 'react';

// Painel de filtros dos catálogos da aba Avaliação (calculadoras, manobras,
// exames). Fica recolhido por padrão: com os chips sempre abertos, uma dezena
// de opções vira uma parede de pílulas na coluna estreita. Fechado, o que está
// ativo continua na tela — filtro invisível que encurta a lista sem avisar
// confunde mais do que a poluição que ele evita.

export function getCatalogFilterValues(items, key) {
  const values = [...new Set((items || []).map((item) => item?.[key]).filter(Boolean))];
  return values.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function FilterChips({ label, values, selected, onSelect }) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="clinical-tool-filter-row">
      <span className="clinical-tool-filter-label">{label}</span>
      <div className="clinical-tool-filter-chips">
        <button
          type="button"
          className={`clinical-tool-filter-chip ${selected ? '' : 'active'}`}
          onClick={() => onSelect('')}
        >
          Todas
        </button>
        {values.map((value) => (
          <button
            key={value}
            type="button"
            className={`clinical-tool-filter-chip ${value === selected ? 'active' : ''}`}
            onClick={() => onSelect(value === selected ? '' : value)}
            aria-pressed={value === selected}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

// `groups`: [{ key, label, values, selected, onSelect, onClear? }]. `onClear`
// existe para quando remover o filtro não é a mesma coisa que selecioná-lo
// vazio — em calculadoras, trocar de especialidade zera o tipo, mas removê-la
// preserva o tipo escolhido.
function CatalogFilterPanel({ groups }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelId = useId();

  // Um filtro ativo entra na lista mesmo se o grupo ficou sem opções:
  // escondê-lo deixaria a lista estreitada sem nada na tela explicando por quê.
  const activeFilters = groups
    .filter((group) => group.selected)
    .map((group) => ({
      key: group.key,
      label: group.selected,
      clear: group.onClear || (() => group.onSelect('')),
    }));

  if (activeFilters.length === 0 && groups.every((group) => group.values.length === 0)) {
    return null;
  }

  return (
    <div className="clinical-tool-filters">
      <button
        type="button"
        className="clinical-tool-filters-toggle"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        <span aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
        Filtros
        {activeFilters.length > 0 ? (
          <span className="clinical-tool-filters-count">{activeFilters.length}</span>
        ) : null}
      </button>

      {!isExpanded && activeFilters.length > 0 ? (
        <div className="clinical-tool-filters-active">
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className="clinical-tool-filter-chip active"
              aria-label={`Remover filtro ${filter.label}`}
              onClick={filter.clear}
            >
              {filter.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}

      <div id={panelId} className="clinical-tool-filters-panel" hidden={!isExpanded}>
        {groups.map((group) => (
          <FilterChips
            key={group.key}
            label={group.label}
            values={group.values}
            selected={group.selected}
            onSelect={group.onSelect}
          />
        ))}
      </div>
    </div>
  );
}

export default CatalogFilterPanel;

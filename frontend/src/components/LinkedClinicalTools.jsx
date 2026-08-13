import { useEffect, useState } from 'react';
import { api } from '../apiClient';

// Resolve os slugs curados no modelo em ferramentas publicadas. Slug removido
// ou despublicado simplesmente não volta — o modelo não quebra por isso.
export function useLinkedClinicalTools(slugs, enabled = true) {
  const [tools, setTools] = useState([]);
  const key = Array.isArray(slugs) ? slugs.join(',') : '';

  useEffect(() => {
    if (!enabled || !key) {
      setTools([]);
      return undefined;
    }

    let ignore = false;

    async function loadLinkedTools() {
      const response = await api.get(`/clinical-tools?slugs=${encodeURIComponent(key)}`);

      if (ignore) {
        return;
      }

      setTools(response.success && Array.isArray(response.data) ? response.data : []);
    }

    loadLinkedTools();

    return () => {
      ignore = true;
    };
  }, [enabled, key]);

  return tools;
}

function LinkedClinicalTools({ tools, onOpenTool, title = 'Ferramentas relacionadas', hint = '' }) {
  if (!tools.length) {
    return null;
  }

  return (
    <section className="linked-tools">
      <h4>{title}</h4>
      {hint ? <p>{hint}</p> : null}
      <div className="linked-tools-chips">
        {tools.map((tool) => (
          <button
            key={tool.slug}
            type="button"
            className="linked-tools-chip"
            onClick={() => onOpenTool(tool.slug)}
          >
            {tool.title}
          </button>
        ))}
      </div>
    </section>
  );
}

export default LinkedClinicalTools;

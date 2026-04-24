function cleanInsightSegment(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getInsightLabelKey(value) {
  const normalized = normalizeText(value).replace(/[:.-]+$/g, '');

  if (normalized === 'falha' || normalized === 'ponto critico') {
    return 'point';
  }

  if (normalized === 'consequencia na leitura') {
    return 'consequence';
  }

  if (normalized === 'impacto na qualidade') {
    return 'impact';
  }

  return '';
}

function extractLabeledPrefix(value) {
  const labels = [
    ['FALHA', 'point'],
    ['PONTO CRITICO', 'point'],
    ['CONSEQUENCIA NA LEITURA', 'consequence'],
    ['IMPACTO NA QUALIDADE', 'impact'],
  ];
  const normalized = normalizeText(value);

  for (const [label, key] of labels) {
    const normalizedLabel = normalizeText(label);

    if (normalized === normalizedLabel) {
      return { key, rest: '' };
    }

    if (normalized.startsWith(`${normalizedLabel} `)) {
      return {
        key,
        rest: value.slice(label.length).replace(/^[:\s-]+/, '').trim(),
      };
    }
  }

  return { key: '', rest: value };
}

function parseCriticalInsight(insightText) {
  const parsed = {
    point: '',
    consequence: '',
    impact: '',
  };
  let activeKey = '';
  const parts = cleanInsightSegment(insightText)
    .replace(/[→⇒]/g, '->')
    .split(/\s*->\s*/)
    .map((part) => cleanInsightSegment(part))
    .filter(Boolean);

  for (const part of parts) {
    const directKey = getInsightLabelKey(part);

    if (directKey) {
      activeKey = directKey;
      continue;
    }

    const labeledPart = extractLabeledPrefix(part);
    const targetKey = labeledPart.key || activeKey;
    const value = cleanInsightSegment(labeledPart.rest);

    if (targetKey && value) {
      parsed[targetKey] = parsed[targetKey]
        ? `${parsed[targetKey]} ${value}`
        : value;
      activeKey = '';
      continue;
    }

    if (!parsed.point) {
      parsed.point = value || part;
    }
  }

  if (!parsed.point && !parsed.consequence && !parsed.impact) {
    return {
      point: cleanInsightSegment(insightText),
      readingImpact: '',
    };
  }

  return {
    point: parsed.point,
    readingImpact: [parsed.consequence, parsed.impact]
      .filter(Boolean)
      .join(' '),
  };
}

function DetailedAnalysis({
  aberto,
  onToggle,
  showDetailedContent,
  analysisInputSection,
  summarizedScoreJustification,
  insightPrincipalSection,
  secondaryGaps,
}) {
  const criticalReading = parseCriticalInsight(insightPrincipalSection);

  return (
    <div className="card section-secondary">
      <button
        type="button"
        className="secondary-toggle"
        onClick={onToggle}
      >
        <div className="secondary-toggle-copy">
          <strong>{aberto ? 'Ocultar análise detalhada' : 'Ver análise detalhada'}</strong>
          <span>Abra apenas se quiser revisar a leitura completa e os dados complementares.</span>
        </div>
        <span className="secondary-toggle-icon" aria-hidden="true">
          {aberto ? '▲' : '▼'}
        </span>
      </button>

      {aberto && showDetailedContent && (
        <div className="secondary-section-grid">
          <div className="secondary-support-card">
            <div className="card-header">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M12 4h9" />
                <path d="M4 9h16" />
                <path d="M4 15h16" />
              </svg>
              <h2>Análise detalhada</h2>
            </div>

            <div className="detailed-analysis-grid">
              <div className="detailed-analysis-block">
                <h3 className="detailed-analysis-title">Leitura completa</h3>
                <div className="resultado">{analysisInputSection}</div>
              </div>

              <div className="detailed-analysis-block">
                <h3 className="detailed-analysis-title">Justificativa da nota</h3>
                <div className="resultado">{summarizedScoreJustification}</div>
              </div>

              <div className="detailed-analysis-block">
                <h3 className="detailed-analysis-title">Ponto crítico</h3>
                <div className="resultado">
                  <div>{criticalReading.point || insightPrincipalSection}</div>
                  {criticalReading.readingImpact ? <div>{criticalReading.readingImpact}</div> : null}
                </div>
              </div>

              {Array.isArray(secondaryGaps) && secondaryGaps.length > 0 ? (
                <div className="detailed-analysis-block">
                  <h3 className="detailed-analysis-title">Outras lacunas relevantes</h3>
                  <div className="resultado">
                    {secondaryGaps.slice(0, 4).map((gap) => (
                      <div key={gap}>- {gap}</div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DetailedAnalysis;

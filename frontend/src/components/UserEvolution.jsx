const MIN_PATTERN_SAMPLE_SIZE = 3;
const INSUFFICIENT_DATA_MESSAGE = 'Use o sistema mais vezes para visualizar seu padr\u00e3o de anamnese';

function buildRecurringPatterns({ anamneseStats, currentScore, isValidScoreValue }) {
  const patterns = [];
  const totalAnamneses = typeof anamneseStats?.total_anamneses === 'number'
    ? anamneseStats.total_anamneses
    : 0;
  const averageScore = anamneseStats?.score_medio;
  const previousScore = anamneseStats?.score_anterior;

  if (totalAnamneses < MIN_PATTERN_SAMPLE_SIZE) {
    return [];
  }

  if (isValidScoreValue(averageScore) && averageScore < 70) {
    patterns.push('completude dos blocos essenciais');
  }

  if (
    isValidScoreValue(currentScore) &&
    isValidScoreValue(previousScore) &&
    currentScore < previousScore &&
    currentScore < 85
  ) {
    patterns.push('checagem estrutural antes de finalizar');
  }

  return patterns.slice(0, 2);
}

function getTrendData({ lastScore, currentScore, immediateComparison, isValidScoreValue }) {
  if (immediateComparison?.trend === 'up') {
    return {
      trendArrow: '\u2191',
      trendLabel: 'melhora',
    };
  }

  if (immediateComparison?.trend === 'down') {
    return {
      trendArrow: '\u2193',
      trendLabel: 'queda',
    };
  }

  if (immediateComparison?.trend === 'stable') {
    return {
      trendArrow: '\u2022',
      trendLabel: 'est\u00e1vel',
    };
  }

  if (immediateComparison?.trend === 'insufficient_data') {
    return {
      trendArrow: '\u2022',
      trendLabel: 'sem base anterior',
    };
  }

  if (!isValidScoreValue(lastScore) || !isValidScoreValue(currentScore)) {
    return {
      trendArrow: '\u2022',
      trendLabel: 'est\u00e1vel',
    };
  }

  if (currentScore > lastScore) {
    return {
      trendArrow: '\u2191',
      trendLabel: 'melhora',
    };
  }

  if (currentScore < lastScore) {
    return {
      trendArrow: '\u2193',
      trendLabel: 'queda',
    };
  }

  return {
    trendArrow: '\u2022',
    trendLabel: 'est\u00e1vel',
  };
}

function UserEvolution({
  loadingAnamneseStats,
  anamneseStats,
  isValidScoreValue,
  loadingAnamneseActivity,
  consistencySummary,
  currentScore,
  immediateComparison,
}) {
  const lastScore = isValidScoreValue(immediateComparison?.previousScore)
    ? immediateComparison.previousScore
    : isValidScoreValue(anamneseStats?.score_anterior)
      ? anamneseStats.score_anterior
      : anamneseStats?.ultimo_score;
  const recurringPatterns = buildRecurringPatterns({
    anamneseStats,
    currentScore,
    isValidScoreValue,
  });
  const hasRecurringPatterns = recurringPatterns.length > 0;
  const trendData = getTrendData({
    lastScore,
    currentScore,
    immediateComparison,
    isValidScoreValue,
  });
  const shouldUseImmediateComparison = Boolean(immediateComparison);
  const isInitialEvolutionState =
    shouldUseImmediateComparison && !isValidScoreValue(immediateComparison?.previousScore);

  return (
    <div className="card section-evolution">
      <div className="card-header">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="M7 13l3-3 3 2 4-5" />
        </svg>
        <h2>{'Evolu\u00e7\u00e3o do usu\u00e1rio'}</h2>
      </div>

      <div className="user-evolution-grid">
        <div className="evolution-panel">
          <h3>{'Voc\u00ea costuma esquecer:'}</h3>
          {loadingAnamneseStats ? (
            <p className="field-helper">{'Lendo padr\u00f5es recorrentes...'}</p>
          ) : hasRecurringPatterns ? (
            <div className="evolution-patterns">
              {recurringPatterns.map((pattern) => (
                <div key={pattern} className="evolution-pattern-item">
                  {pattern}
                </div>
              ))}
            </div>
          ) : (
            <p className="field-helper">{INSUFFICIENT_DATA_MESSAGE}</p>
          )}

          {!loadingAnamneseActivity && consistencySummary && (
            <div className="consistency-box">
              <div className="consistency-title">Ritmo recente</div>
              <div className="consistency-text">{consistencySummary.title}</div>
              {consistencySummary.details.map((detail) => (
                <div key={detail} className="consistency-detail">
                  {detail}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="evolution-panel">
          <h3>{'Evolu\u00e7\u00e3o'}</h3>
          {loadingAnamneseStats && !shouldUseImmediateComparison ? (
            <p className="field-helper">{'Carregando evolu\u00e7\u00e3o...'}</p>
          ) : (
            <div className="evolution-summary">
              <div className="evolution-summary-row">
                <span>{'\u00daltima anamnese'}</span>
                <strong>{isValidScoreValue(lastScore) ? Math.round(lastScore) : '-'}</strong>
              </div>
              <div className="evolution-summary-row">
                <span>Atual</span>
                <strong>{isValidScoreValue(currentScore) ? Math.round(currentScore) : '-'}</strong>
              </div>
              <div className="evolution-summary-row">
                <span>{'Tend\u00eancia'}</span>
                <strong className="evolution-trend">
                  {trendData.trendArrow} {trendData.trendLabel}
                </strong>
              </div>
              {isInitialEvolutionState && (
                <p className="field-helper">
                  {'Esta \u00e9 a primeira anamnese persistida dispon\u00edvel para compara\u00e7\u00e3o imediata.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserEvolution;

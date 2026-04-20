function isValidScore(value) {
  return typeof value === 'number' && !Number.isNaN(value);
}

function formatScore(value) {
  return isValidScore(value) ? Math.round(value) : '-';
}

function parseActivityDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCurrentStreak(activityDates) {
  if (!Array.isArray(activityDates) || activityDates.length === 0) {
    return 0;
  }

  const sortedDates = [...activityDates].sort((left, right) => right.localeCompare(left));
  let streak = 1;
  let previousDate = parseActivityDate(sortedDates[0]);

  if (!previousDate) {
    return 0;
  }

  for (let index = 1; index < sortedDates.length; index += 1) {
    const currentDate = parseActivityDate(sortedDates[index]);

    if (!currentDate) {
      break;
    }

    const diffInDays = Math.round((previousDate.getTime() - currentDate.getTime()) / 86400000);

    if (diffInDays !== 1) {
      break;
    }

    streak += 1;
    previousDate = currentDate;
  }

  return streak;
}

function getActivitySummary(activityDates) {
  if (!Array.isArray(activityDates) || activityDates.length === 0) {
    return {
      activeDays: 0,
      currentStreak: 0,
      last14Days: [],
    };
  }

  const dateSet = new Set(activityDates);
  const today = new Date();
  const last14Days = Array.from({ length: 14 }, (_, index) => {
    const current = new Date(today);
    current.setDate(today.getDate() - (13 - index));
    const key = current.toISOString().slice(0, 10);

    return {
      key,
      label: current.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      active: dateSet.has(key),
    };
  });

  return {
    activeDays: activityDates.length,
    currentStreak: getCurrentStreak(activityDates),
    last14Days,
  };
}

function getTrendPoints(recentAnamneses) {
  const items = Array.isArray(recentAnamneses) ? [...recentAnamneses] : [];
  const ordered = items
    .filter((item) => isValidScore(item?.score))
    .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)))
    .slice(-8);

  return ordered.map((item, index) => ({
    id: item.id || `${item.created_at}-${index}`,
    score: Math.max(0, Math.min(100, item.score)),
    label: new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  }));
}

function getTopTemplates(recentAnamneses, templates) {
  const templateNames = Object.fromEntries((templates || []).map((template) => [template.id, template.nome]));
  const aggregate = new Map();

  (recentAnamneses || []).forEach((item) => {
    if (!item?.template) {
      return;
    }

    const current = aggregate.get(item.template) || {
      id: item.template,
      count: 0,
      totalScore: 0,
      scoreCount: 0,
    };

    current.count += 1;

    if (isValidScore(item.score)) {
      current.totalScore += item.score;
      current.scoreCount += 1;
    }

    aggregate.set(item.template, current);
  });

  return Array.from(aggregate.values())
    .map((item) => ({
      ...item,
      name: templateNames[item.id] || item.id,
      averageScore: item.scoreCount ? Number((item.totalScore / item.scoreCount).toFixed(1)) : null,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);
}

function getGuidedReading({ anamneseStats, activitySummary, topTemplates }) {
  if (!anamneseStats?.total_anamneses) {
    return [];
  }

  const messages = [];

  if (isValidScore(anamneseStats.score_medio)) {
    if (anamneseStats.score_medio >= 85) {
      messages.push('Sua média estrutural já mostra boa consistência na organização das anamneses.');
    } else if (anamneseStats.score_medio >= 70) {
      messages.push('Sua média estrutural está estável e ainda tem espaço para ganhar mais consistência.');
    } else {
      messages.push('Sua média estrutural indica oportunidade clara para revisar blocos essenciais com mais atenção.');
    }
  }

  if (activitySummary.currentStreak >= 3) {
    messages.push(`Você mantém um ritmo recente de ${activitySummary.currentStreak} dias ativos, o que favorece evolução contínua.`);
  } else if (activitySummary.activeDays > 0) {
    messages.push('Seu ritmo recente ainda está em formação; manter recorrência tende a melhorar a consistência.');
  }

  if (topTemplates[0]) {
    messages.push(`Seu template mais usado no momento é ${topTemplates[0].name}, indicando seu principal contexto de uso.`);
  }

  return messages.slice(0, 3);
}

function EvolutionPage({
  user,
  templates,
  loadingAnamneseStats,
  anamneseStats,
  loadingAnamneseActivity,
  anamneseActivity,
  loadingRecentAnamneses,
  recentAnamneses,
  consistencySummary,
  onGoHome,
  onGoTemplates,
}) {
  const activitySummary = getActivitySummary(anamneseActivity);
  const trendPoints = getTrendPoints(recentAnamneses);
  const topTemplates = getTopTemplates(recentAnamneses, templates);
  const guidedReading = getGuidedReading({ anamneseStats, activitySummary, topTemplates });
  const totalAnamneses = anamneseStats?.total_anamneses || 0;
  const hasData = totalAnamneses > 0 || activitySummary.activeDays > 0 || recentAnamneses.length > 0;
  const isLoading = loadingAnamneseStats || loadingAnamneseActivity || loadingRecentAnamneses;

  if (!user || (!isLoading && !hasData)) {
    return (
      <div className="evolution-page">
        <section className="workspace-surface evolution-hero">
          <div className="evolution-hero-copy">
            <span className="workspace-kicker">Acompanhamento</span>
            <h1>Sua evolução</h1>
            <p>Veja como sua estrutura melhora ao longo do uso e quais templates aparecem com mais frequência na sua rotina.</p>
          </div>
        </section>

        <section className="evolution-empty-state">
          <strong>Ainda não há dados suficientes para mostrar sua evolução.</strong>
          <span>Organize sua primeira anamnese para começar a acompanhar score, frequência de uso e templates mais utilizados.</span>
          <div className="evolution-empty-actions">
            <button type="button" className="btn btn-primario" onClick={onGoHome}>
              Ir para Home
            </button>
            <button type="button" className="btn btn-secundario" onClick={onGoTemplates}>
              Explorar Templates
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="evolution-page">
      <section className="workspace-surface evolution-hero">
        <div className="evolution-hero-copy">
          <span className="workspace-kicker">Acompanhamento</span>
          <h1>Sua evolução</h1>
          <p>Entenda rapidamente seu progresso de uso, sua consistência recente e os templates que mais acompanham sua rotina clínica.</p>
        </div>
      </section>

      <section className="evolution-section">
        <div className="evolution-section-header">
          <h2>Visão geral</h2>
          <p>Um resumo simples do seu momento atual no produto.</p>
        </div>

        <div className="evolution-overview-grid">
          <article className="evolution-overview-card">
            <span>Total de anamneses</span>
            <strong>{isLoading ? '...' : totalAnamneses}</strong>
          </article>
          <article className="evolution-overview-card">
            <span>Média estrutural</span>
            <strong>{isLoading ? '...' : formatScore(anamneseStats?.score_medio)}</strong>
          </article>
          <article className="evolution-overview-card">
            <span>Melhor score</span>
            <strong>{isLoading ? '...' : formatScore(anamneseStats?.melhor_score)}</strong>
          </article>
          <article className="evolution-overview-card">
            <span>Consistência recente</span>
            <strong>{isLoading ? '...' : consistencySummary?.title || 'Em formação'}</strong>
          </article>
        </div>
      </section>

      <div className="evolution-grid">
        <section className="evolution-section evolution-panel-card">
          <div className="evolution-section-header">
            <h2>Progresso</h2>
            <p>Tendência recente das suas notas, sem excesso de detalhe.</p>
          </div>

          {trendPoints.length ? (
            <div className="evolution-trend-chart" aria-label="Tendência recente dos scores">
              {trendPoints.map((point) => (
                <div key={point.id} className="evolution-trend-point">
                  <span className="evolution-trend-value">{Math.round(point.score)}</span>
                  <div className="evolution-trend-bar-track">
                    <div
                      className="evolution-trend-bar-fill"
                      style={{ height: `${Math.max(12, point.score)}%` }}
                    />
                  </div>
                  <span className="evolution-trend-label">{point.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="evolution-soft-empty">Assim que houver mais anamneses organizadas, a tendência recente aparecerá aqui.</div>
          )}
        </section>

        <section className="evolution-section evolution-panel-card">
          <div className="evolution-section-header">
            <h2>Atividade</h2>
            <p>Frequência recente e ritmo de uso.</p>
          </div>

          <div className="evolution-activity-stats">
            <div className="evolution-activity-stat">
              <span>Dias ativos</span>
              <strong>{activitySummary.activeDays}</strong>
            </div>
            <div className="evolution-activity-stat">
              <span>Streak atual</span>
              <strong>{activitySummary.currentStreak}</strong>
            </div>
          </div>

          {activitySummary.last14Days.length ? (
            <div className="evolution-activity-strip">
              {activitySummary.last14Days.map((day) => (
                <div key={day.key} className="evolution-activity-day">
                  <div className={`evolution-activity-dot ${day.active ? 'active' : ''}`} />
                  <span>{day.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="evolution-soft-empty">A frequência recente aparecerá aqui conforme você usar o produto mais vezes.</div>
          )}
        </section>
      </div>

      <div className="evolution-grid">
        <section className="evolution-section evolution-panel-card">
          <div className="evolution-section-header">
            <h2>Templates mais usados</h2>
            <p>Os modelos que mais aparecem no seu fluxo recente.</p>
          </div>

          {topTemplates.length ? (
            <div className="evolution-template-list">
              {topTemplates.map((template) => (
                <article key={template.id} className="evolution-template-item">
                  <div>
                    <strong>{template.name}</strong>
                    <span>{template.count} uso{template.count === 1 ? '' : 's'}</span>
                  </div>
                  <div className="evolution-template-score">
                    <span>Média</span>
                    <strong>{formatScore(template.averageScore)}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="evolution-soft-empty">Os templates mais usados aparecerão aqui assim que houver histórico suficiente.</div>
          )}
        </section>

        <section className="evolution-section evolution-panel-card">
          <div className="evolution-section-header">
            <h2>Leitura orientada</h2>
            <p>Uma leitura leve do seu momento atual.</p>
          </div>

          <div className="evolution-reading-list">
            {guidedReading.map((item) => (
              <div key={item} className="evolution-reading-item">
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default EvolutionPage;

const PRIORITY_LABELS = {
  documented_problem: 'Problema ativo',
  most_compatible: 'Mais compatível',
  cannot_miss: 'Não pode ser ignorado',
  differential: 'Diferencial',
};

// Prioriza hipóteses que puxam a atenção clínica (problema ativo, mais
// compatível, não pode ser ignorado) para extrair o que checar sobre o caso.
const FOCUS_PRIORITIES = new Set(['documented_problem', 'most_compatible', 'cannot_miss']);

function dedupeItems(values, max = 8) {
  const seen = new Set();
  const output = [];

  for (const value of values) {
    const clean = String(value || '').replace(/\s+/g, ' ').trim();
    const key = clean.toLowerCase();

    if (!clean || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(clean);

    if (output.length >= max) {
      break;
    }
  }

  return output;
}

// Condensa as hipóteses num checklist único, deduplicado e específico do quadro:
// o que documentar/perguntar para fortalecer ou descartar as principais hipóteses,
// mais os sinais de alerta a checar. É a leitura "sobre o seu caso", separada da
// estrutura genérica do template.
function buildFocusReview(data) {
  const hypotheses = Array.isArray(data?.hypotheses) ? data.hypotheses : [];
  const focusHypotheses = hypotheses.filter((item) => FOCUS_PRIORITIES.has(item.priority));
  const sourceHypotheses = focusHypotheses.length ? focusHypotheses : hypotheses;

  const toCollect = dedupeItems([
    ...(Array.isArray(data?.missingData) ? data.missingData : []),
    ...sourceHypotheses.flatMap((item) => item.missingOrConflictingData || []),
  ]);
  const redFlags = dedupeItems(sourceHypotheses.flatMap((item) => item.redFlags || []), 6);
  const focusNames = hypotheses.slice(0, 4).map((item) => ({
    name: item.name,
    priority: item.priority,
  }));

  return { toCollect, redFlags, focusNames };
}

function FocusedClinicalReview({
  hasStructuredResult,
  user,
  isPro,
  data,
  loading,
  error,
  onGenerate,
  onRequestUpgrade,
  onSeeFullReasoning,
}) {
  if (!hasStructuredResult) {
    return null;
  }

  const header = (
    <div className="card-header insight-block-header">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a7 7 0 0 0-4 12.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3A7 7 0 0 0 12 2z" />
        <path d="M9 22h6" />
      </svg>
      <div>
        <h2>Revisão dirigida ao quadro</h2>
        <p className="card-subtitle">
          Além da estrutura, o que vale checar considerando o provável caso clínico.
        </p>
      </div>
    </div>
  );

  if (!user?.id || !isPro) {
    return (
      <div className="card section-insight focused-review workspace-panel">
        {header}
        <div className="focused-review-cta">
          <span className="diagnostic-pro-badge">PRO</span>
          <p>Uma leitura específica do caso: o que perguntar e documentar para sustentar ou descartar as principais hipóteses.</p>
          <button type="button" className="btn btn-primario" onClick={onRequestUpgrade}>
            {!user?.id ? 'Entrar para continuar' : 'Ativar profissional'}
          </button>
        </div>
      </div>
    );
  }

  if (!data && !loading && !error) {
    return (
      <div className="card section-insight focused-review workspace-panel">
        {header}
        <div className="focused-review-cta">
          <p>Analisa a história organizada e aponta o que checar sobre o quadro específico — sem sugerir diagnóstico, dose ou conduta.</p>
          <button type="button" className="btn btn-primario" onClick={onGenerate}>
            Ver revisão específica deste quadro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card section-insight focused-review workspace-panel">
      {header}

      {loading ? (
        <div className="diagnostic-loading" aria-live="polite">
          <span className="spinner" />
          <strong>Analisando a história clínica...</strong>
          <p>Levantando o que vale checar sobre o provável quadro.</p>
        </div>
      ) : error ? (
        <div className="diagnostic-error" role="alert">
          <strong>Não foi possível concluir a revisão</strong>
          <p>{error}</p>
          <button type="button" className="btn btn-secundario" onClick={onGenerate}>Tentar novamente</button>
        </div>
      ) : (
        <FocusReviewResult data={data} onGenerate={onGenerate} onSeeFullReasoning={onSeeFullReasoning} />
      )}
    </div>
  );
}

function FocusReviewResult({ data, onGenerate, onSeeFullReasoning }) {
  const isInsufficient = data.status === 'insufficient_data';
  const isRefused = data.status === 'refused';

  if (isInsufficient || isRefused) {
    return (
      <div className="focused-review-notice">
        <strong>{isRefused ? 'Revisão não realizada' : 'História ainda insuficiente'}</strong>
        <p>
          {isRefused
            ? 'O conteúdo não pôde ser analisado com segurança.'
            : 'Ainda não há elementos suficientes para uma leitura segura do quadro. Complete a estrutura acima e tente de novo.'}
        </p>
        {Array.isArray(data.missingData) && data.missingData.length ? (
          <ul className="focused-review-list">
            {data.missingData.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : null}
      </div>
    );
  }

  const { toCollect, redFlags, focusNames } = buildFocusReview(data);

  return (
    <div className="focused-review-result" aria-live="polite">
      {focusNames.length ? (
        <div className="focused-review-hypotheses">
          <span>Focos considerados</span>
          <div className="focused-review-chips">
            {focusNames.map((item) => (
              <span key={item.name} className={`focused-review-chip focused-review-chip-${item.priority}`}>
                {item.name}
                <small>{PRIORITY_LABELS[item.priority] || 'Diferencial'}</small>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {toCollect.length ? (
        <div className="focused-review-block">
          <strong>O que perguntar / documentar sobre o caso</strong>
          <ul className="focused-review-list">
            {toCollect.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}

      {redFlags.length ? (
        <div className="focused-review-block focused-review-block-warning">
          <strong>Sinais de alerta a checar</strong>
          <ul className="focused-review-list">
            {redFlags.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="focused-review-actions">
        <button type="button" className="btn btn-secundario" onClick={onSeeFullReasoning}>
          Ver raciocínio completo
        </button>
        <button type="button" className="btn btn-secundario" onClick={onGenerate}>
          Gerar nova revisão
        </button>
      </div>
      <p className="diagnostic-disclaimer">
        Apoio à revisão. Confirme tudo com avaliação clínica, exames e protocolos locais.
      </p>
    </div>
  );
}

export default FocusedClinicalReview;

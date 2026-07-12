import { useId, useState } from 'react';

const PRIORITY_LABELS = {
  documented_problem: 'Problema ativo documentado',
  most_compatible: 'Mais compatível',
  differential: 'Diferencial',
  cannot_miss: 'Não pode ser ignorado',
};

function ClinicalList({ title, items, tone = 'default' }) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <div className={`diagnostic-hypothesis-list diagnostic-hypothesis-list-${tone}`}>
      <strong>{title}</strong>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function HypothesisCard({ hypothesis, index, onOpenPrescriptionGuide }) {
  const guide = hypothesis.prescriptionGuide;
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const reasoningId = useId();

  return (
    <article className="diagnostic-hypothesis-card">
      <div className="diagnostic-hypothesis-heading">
        <span className={`diagnostic-priority diagnostic-priority-${hypothesis.priority}`}>
          {PRIORITY_LABELS[hypothesis.priority] || 'Diferencial'}
        </span>
        <span className="diagnostic-hypothesis-index">{index + 1}</span>
      </div>
      <h3>{hypothesis.name}</h3>
      {hypothesis.rationale ? <p>{hypothesis.rationale}</p> : null}

      <div className="diagnostic-reasoning">
        <button
          type="button"
          className="diagnostic-reasoning-toggle"
          aria-expanded={isReasoningExpanded}
          aria-controls={reasoningId}
          onClick={() => setIsReasoningExpanded((expanded) => !expanded)}
        >
          <span aria-hidden="true">{isReasoningExpanded ? '▾' : '▸'}</span>
          {isReasoningExpanded ? 'Ocultar raciocínio clínico' : 'Ver raciocínio clínico'}
        </button>
        <div id={reasoningId} className="diagnostic-reasoning-content" hidden={!isReasoningExpanded}>
          <ClinicalList title="Evidências na história" items={hypothesis.supportingEvidence} tone="support" />
          <ClinicalList title="Dados ausentes ou conflitantes" items={hypothesis.missingOrConflictingData} />
          <ClinicalList title="Como diferenciar" items={hypothesis.differentiatingSteps} />
          <ClinicalList title="Sinais de alerta" items={hypothesis.redFlags} tone="warning" />
        </div>
      </div>

      <button
        type="button"
        className="diagnostic-guide-action"
        onClick={() => onOpenPrescriptionGuide(hypothesis)}
      >
        {guide ? 'Abrir guia relacionado' : 'Buscar em prescrições'}
      </button>
    </article>
  );
}

function DiagnosticHypothesesPanel({
  hasStructuredResult,
  user,
  isPro,
  data,
  error,
  loading,
  onGenerate,
  onRequestUpgrade,
  onOpenPrescriptionGuide,
}) {
  if (!hasStructuredResult) {
    return (
      <div className="workspace-sidebar-empty">
        Organize a anamnese para liberar a sugestão de hipóteses diagnósticas.
      </div>
    );
  }

  if (!user?.id || !isPro) {
    return (
      <div className="diagnostic-access-card">
        <span className="diagnostic-pro-badge">PRO</span>
        <strong>Apoio ao raciocínio clínico</strong>
        <p>Gere hipóteses diferenciais fundamentadas na história organizada.</p>
        <button type="button" className="btn btn-primario" onClick={onRequestUpgrade}>
          {!user?.id ? 'Entrar para continuar' : 'Ativar profissional'}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="diagnostic-loading" aria-live="polite">
        <span className="spinner" />
        <strong>Analisando a história clínica...</strong>
        <p>As sugestões serão organizadas por relevância e segurança.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="diagnostic-error" role="alert">
        <strong>Não foi possível concluir a análise</strong>
        <p>{error}</p>
        <button type="button" className="btn btn-secundario" onClick={onGenerate}>Tentar novamente</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="diagnostic-start-card">
        <p>Raciocínio clínico completo a partir da história organizada: hipóteses, evidências, o que falta coletar e sinais de alerta. Não altera sua anamnese nem sugere conduta.</p>
        <button type="button" className="btn btn-primario" onClick={onGenerate}>
          Sugerir hipóteses
        </button>
      </div>
    );
  }

  const hypotheses = Array.isArray(data.hypotheses) ? data.hypotheses : [];
  const isInsufficient = data.status === 'insufficient_data';
  const isRefused = data.status === 'refused';

  return (
    <div className="diagnostic-results" aria-live="polite">
      {isInsufficient || isRefused ? (
        <div className="diagnostic-status-notice">
          <strong>{isRefused ? 'Análise não realizada' : 'História clínica insuficiente'}</strong>
          <p>
            {isRefused
              ? 'O conteúdo não pôde ser analisado com segurança.'
              : 'Não há suporte seguro para apresentar pelo menos três hipóteses.'}
          </p>
        </div>
      ) : null}

      <ClinicalList title="Dados importantes a coletar" items={data.missingData} />
      <ClinicalList title="Alertas gerais" items={data.generalWarnings} tone="warning" />

      {hypotheses.map((hypothesis, index) => (
        <HypothesisCard
          key={`${hypothesis.name}-${index}`}
          hypothesis={hypothesis}
          index={index}
          onOpenPrescriptionGuide={onOpenPrescriptionGuide}
        />
      ))}

      <button type="button" className="btn btn-secundario diagnostic-regenerate" onClick={onGenerate}>
        Gerar nova análise
      </button>
      <p className="diagnostic-disclaimer">
        Sugestões de apoio. Confirme todas as hipóteses com avaliação clínica, exames e protocolos locais.
      </p>
    </div>
  );
}

export default DiagnosticHypothesesPanel;

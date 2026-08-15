import { useId, useState } from 'react';
import Cid10InlineSearch from './Cid10InlineSearch';

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

const MANEUVER_DETAIL_FIELDS = [
  { key: 'whenToPerform', label: 'Quando fazer' },
  { key: 'howToPerform', label: 'Como executar' },
  { key: 'positiveFinding', label: 'Achado positivo' },
  { key: 'negativeFinding', label: 'Achado negativo' },
  { key: 'clinicalUtility', label: 'Utilidade clínica' },
];

// A IA nomeia a manobra; a técnica e a interpretação vêm do catálogo revisado.
// Sem correspondência no catálogo, fica só o nome — sem link e sem detalhe,
// porque não há conteúdo revisado para mostrar.
function ManeuverItem({ suggestion }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailId = useId();
  const maneuver = suggestion.maneuver;

  if (!maneuver) {
    return (
      <li className="exam-maneuver exam-maneuver-uncatalogued">
        <span>{suggestion.name}</span>
      </li>
    );
  }

  const details = MANEUVER_DETAIL_FIELDS
    .map((field) => ({ ...field, text: String(maneuver[field.key] || '').trim() }))
    .filter((field) => field.text);

  return (
    <li className="exam-maneuver">
      <button
        type="button"
        className="exam-maneuver-toggle"
        aria-expanded={isExpanded}
        aria-controls={detailId}
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        <span aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
        {maneuver.name}
      </button>

      <div id={detailId} className="exam-maneuver-detail" hidden={!isExpanded}>
        {details.map((field) => (
          <div key={field.key}>
            <strong>{field.label}</strong>
            <p>{field.text}</p>
          </div>
        ))}
        {maneuver.source ? <p className="exam-maneuver-source">Fonte: {maneuver.source}</p> : null}
      </div>
    </li>
  );
}

function ExamManeuvers({ suggestions }) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="exam-maneuvers">
      <strong>Exame físico específico</strong>
      <ul>
        {suggestions.map((suggestion, index) => (
          <ManeuverItem key={`${suggestion.name}-${index}`} suggestion={suggestion} />
        ))}
      </ul>
    </div>
  );
}

function HypothesisCard({ hypothesis, index, onOpenPrescriptionGuide }) {
  const guide = hypothesis.prescriptionGuide;
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const [isCidSearchExpanded, setIsCidSearchExpanded] = useState(false);
  const reasoningId = useId();
  const cidSearchId = useId();
  // Só oferece a busca quando não há CID vindo do guia casado. Com CID revisado
  // em tela, mandar procurar outro só criaria dúvida.
  const canSearchCid = !guide?.cid10Primary;

  return (
    <article className="diagnostic-hypothesis-card">
      <div className="diagnostic-hypothesis-heading">
        <span className={`diagnostic-priority diagnostic-priority-${hypothesis.priority}`}>
          {PRIORITY_LABELS[hypothesis.priority] || 'Diferencial'}
        </span>
        <span className="diagnostic-hypothesis-index">{index + 1}</span>
      </div>
      <div className="diagnostic-hypothesis-title">
        <h3>{hypothesis.name}</h3>
        {/* CID vem do guia de prescrição casado (conteúdo revisado), nunca da IA. */}
        {guide?.cid10Primary ? (
          <span
            className="diagnostic-hypothesis-cid"
            title={`CID-10 do guia de prescrição "${guide.title || guide.conditionName}". Confira antes de registrar.`}
          >
            CID {guide.cid10Primary}
          </span>
        ) : null}
      </div>
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

      <ExamManeuvers suggestions={hypothesis.examManeuvers} />

      {canSearchCid ? (
        <div className="diagnostic-cid-search">
          <button
            type="button"
            className="diagnostic-reasoning-toggle"
            aria-expanded={isCidSearchExpanded}
            aria-controls={cidSearchId}
            onClick={() => setIsCidSearchExpanded((expanded) => !expanded)}
          >
            <span aria-hidden="true">{isCidSearchExpanded ? '▾' : '▸'}</span>
            {isCidSearchExpanded ? 'Ocultar busca de CID-10' : 'Buscar CID-10 desta hipótese'}
          </button>
          <div id={cidSearchId} hidden={!isCidSearchExpanded}>
            {/* Montado só ao abrir: evita disparar uma busca por hipótese
                listada assim que o painel aparece. */}
            {isCidSearchExpanded ? <Cid10InlineSearch initialQuery={hypothesis.name} /> : null}
          </div>
        </div>
      ) : null}

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
  isStale,
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

  // Só substitui a tela inteira pelo erro quando não há análise anterior em tela.
  if (error && !data) {
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
      {error ? (
        <div className="diagnostic-error" role="alert">
          <strong>Não foi possível atualizar a análise</strong>
          <p>{error}</p>
          <button type="button" className="btn btn-secundario" onClick={onGenerate}>Tentar novamente</button>
        </div>
      ) : null}

      {isStale ? (
        <div className="diagnostic-stale-notice">
          <strong>O texto organizado mudou</strong>
          <p>Estas hipóteses foram geradas antes da sua última edição. Termine os ajustes e atualize quando quiser.</p>
          <button type="button" className="btn btn-secundario" onClick={onGenerate}>
            Atualizar hipóteses
          </button>
        </div>
      ) : null}

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

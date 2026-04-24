function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function cleanInsightSegment(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function removeImperativePrefix(value) {
  return String(value || '')
    .replace(/^(inclua|detalhe|registre|descreva|acrescente)\s+/i, '')
    .trim();
}

function buildActionItems(actionText) {
  const sanitized = removeImperativePrefix(actionText.replace(/\.$/, ''));

  if (!sanitized) {
    return [];
  }

  const normalized = normalizeText(sanitized);

  if (normalized.includes(' e ')) {
    return sanitized
      .split(/\s+e\s+/i)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (sanitized.includes(';')) {
    return sanitized
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (sanitized.includes(',')) {
    return sanitized
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [sanitized];
}

function parseStructuredAction(insightText) {
  const fallbackText = cleanInsightSegment(insightText);
  const parts = String(insightText || '')
    .split('->')
    .map((part) => cleanInsightSegment(part))
    .filter(Boolean);

  if (parts.length < 4) {
    return {
      priority: fallbackText,
      whyItMatters: '',
      actionItems: [],
    };
  }

  const priority = parts[0].replace(/^FALHA\s*/i, '').trim();
  const consequence = parts[1].replace(/^CONSEQUENCIA NA LEITURA\s*/i, '').trim();
  const impact = parts[2].replace(/^IMPACTO NA QUALIDADE\s*/i, '').trim();
  const action = parts[3].replace(/^ACAO DIRETA\s*/i, '').trim();

  return {
    priority,
    whyItMatters: [consequence, impact].filter(Boolean).join(' '),
    actionItems: buildActionItems(action),
  };
}

function InsightBlock({
  insightsSectionRef,
  insightPrincipalSection,
  shouldShowPaywall,
  performanceMessage,
  relevantGapsCount,
  onPaywallAction,
  loadingCheckout,
  checkoutError,
  paywallTitle,
  paywallDescription,
  paywallButtonLabel,
  paywallHighlights = [],
}) {
  const gapsLabel = `${relevantGapsCount} ${relevantGapsCount === 1 ? 'lacuna relevante' : 'lacunas relevantes'}`;
  const structuredAction = parseStructuredAction(insightPrincipalSection);

  return (
    <div ref={insightsSectionRef} className="card section-insight insight-block">
      <div className="card-header insight-block-header">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a9 9 0 1 0 9 9" />
          <path d="M12 7v5l3 3" />
        </svg>
        <div>
          <h2>Ação recomendada</h2>
          <p className="card-subtitle">
            Traduza a leitura clínica em um próximo passo claro para a próxima coleta.
          </p>
        </div>
      </div>

      <div className="insight-highlight">
        <div className="insight-kicker">Próximo passo</div>
        <div className="feedback-highlight-block">
          <strong>Prioridade principal</strong>
          <span>{structuredAction.priority || insightPrincipalSection}</span>
        </div>

        {structuredAction.whyItMatters ? (
          <div className="feedback-highlight-block">
            <strong>Por que isso importa</strong>
            <span>{structuredAction.whyItMatters}</span>
          </div>
        ) : null}

        {structuredAction.actionItems.length > 0 ? (
          <div className="feedback-secondary-list">
            <strong>Na próxima coleta, inclua</strong>
            <ul>
              {structuredAction.actionItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {shouldShowPaywall && (
        <div className="paywall-panel insight-paywall-panel">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <circle cx="12" cy="8" r="1" />
          </svg>

          <div className="insight-paywall-content">
            {performanceMessage ? <div className="insight-performance-copy">{performanceMessage}</div> : null}

            <div className="insight-gap-copy">
              Você ainda tem <strong>{gapsLabel}</strong> nesta anamnese.
            </div>

            <div className="insight-paywall-label">{paywallTitle}</div>
            <div className="feedback-helper-copy">{paywallDescription}</div>

            {paywallHighlights.length > 0 ? (
              <ul className="insight-paywall-list">
                {paywallHighlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}

            <button
              className="btn btn-secundario insight-paywall-button"
              type="button"
              onClick={onPaywallAction}
              disabled={loadingCheckout}
            >
              {loadingCheckout ? 'Redirecionando para o pagamento...' : paywallButtonLabel}
            </button>

            {checkoutError ? <div className="feedback-secondary-error">{checkoutError}</div> : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default InsightBlock;

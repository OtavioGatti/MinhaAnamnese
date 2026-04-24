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

function getInsightLabelKey(value) {
  const normalized = normalizeText(value).replace(/[:.-]+$/g, '');

  if (normalized === 'falha' || normalized === 'ponto critico') {
    return 'priority';
  }

  if (normalized === 'consequencia na leitura') {
    return 'consequence';
  }

  if (normalized === 'impacto na qualidade') {
    return 'impact';
  }

  if (normalized === 'acao direta' || normalized === 'proximo passo') {
    return 'action';
  }

  return '';
}

function extractLabeledPrefix(value) {
  const labels = [
    ['FALHA', 'priority'],
    ['PONTO CRITICO', 'priority'],
    ['CONSEQUENCIA NA LEITURA', 'consequence'],
    ['IMPACTO NA QUALIDADE', 'impact'],
    ['ACAO DIRETA', 'action'],
    ['PROXIMO PASSO', 'action'],
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

function buildActionItems(actionText) {
  const sanitized = removeImperativePrefix(actionText.replace(/\.$/, ''))
    .replace(/\s+na proxima coleta$/i, '')
    .replace(/\s+na próxima coleta$/i, '')
    .trim();

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
  const parsed = {
    priority: '',
    consequence: '',
    impact: '',
    action: '',
  };
  let activeKey = '';
  const parts = fallbackText
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

    if (!parsed.priority) {
      parsed.priority = value || part;
    }
  }

  if (!parsed.priority && !parsed.consequence && !parsed.impact && !parsed.action) {
    return {
      priority: fallbackText,
      consequence: '',
      impact: '',
      actionItems: [],
    };
  }

  return {
    priority: parsed.priority,
    consequence: parsed.consequence,
    impact: parsed.impact,
    actionItems: buildActionItems(parsed.action),
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
        <div className="insight-priority-card">
          <strong>{'Ajuste priorit\u00e1rio'}</strong>
          <span>{structuredAction.priority || insightPrincipalSection}</span>
        </div>

        {structuredAction.consequence || structuredAction.impact ? (
          <div className="insight-reason-grid">
            {structuredAction.consequence ? (
              <div className="insight-reason-card">
                <strong>Impacto na leitura</strong>
                <span>{structuredAction.consequence}</span>
              </div>
            ) : null}

            {structuredAction.impact ? (
              <div className="insight-reason-card">
                <strong>Impacto na qualidade</strong>
                <span>{structuredAction.impact}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {structuredAction.actionItems.length > 0 ? (
          <div className="insight-action-list">
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

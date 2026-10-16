// Blocos de exibição da bula usados pela página do Bulário e pela consulta
// rápida, para as duas não divergirem de novo.
import {
  getReviewState,
  getSourceUrl,
  isLikelyList,
  normalizeDisplayText,
  splitListText,
} from '../lib/clinicalDrugDisplay';

export function ClinicalDrugSectionBody({ title, text }) {
  const content = normalizeDisplayText(text);

  return isLikelyList(content) ? (
    <ul className="protocol-simple-list">
      {splitListText(content).map((item, index) => (
        <li key={`${title}-${item}-${index}`}>{item}</li>
      ))}
    </ul>
  ) : (
    <pre>{content}</pre>
  );
}

export function ClinicalDrugSection({ title, text, expanded, onToggle }) {
  return (
    <section className="clinical-drug-section">
      <button
        type="button"
        className="clinical-drug-section-trigger"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span>
          <span className="protocol-chevron">{expanded ? '▾' : '▸'}</span>
          {title}
        </span>
      </button>

      {expanded ? (
        <div className="clinical-drug-section-content">
          <ClinicalDrugSectionBody title={title} text={text} />
        </div>
      ) : null}
    </section>
  );
}

// Sempre visível no topo da bula. `compact` (consulta rápida) mostra só o
// título como selo.
export function ReviewNotice({ drug, compact = false }) {
  const review = getReviewState(drug);

  if (compact) {
    return (
      <span className={`protocol-status-badge clinical-drug-review-badge ${review.tone}`} title={review.detail}>
        {review.tone === 'success' ? '✓ ' : ''}{review.title}
      </span>
    );
  }

  return (
    <div className={`clinical-drug-review ${review.tone}`}>
      <strong>{review.title}</strong>
      {review.detail ? <span>{review.detail}</span> : null}
    </div>
  );
}

export function ReferenceList({ drug }) {
  const references = splitListText(drug?.monograph?.references);
  const sourceUrl = getSourceUrl(drug);

  if (references.length === 0 && !sourceUrl) {
    return null;
  }

  return (
    <section className="clinical-drug-source-box">
      <strong>Referências</strong>
      <ol className="clinical-drug-reference-list">
        {references.map((reference, index) => {
          const url = reference.match(/https?:\/\/\S+/i)?.[0]?.replace(/[).,]+$/, '') || '';
          const label = url ? reference.replace(url, '').replace(/[\s—–-]+$/, '').trim() : reference;

          return (
            <li key={`${reference}-${index}`}>
              {label || url}
              {url ? (
                <>
                  {' '}
                  <a href={url} target="_blank" rel="noreferrer">acessar</a>
                </>
              ) : null}
            </li>
          );
        })}
        {sourceUrl ? (
          <li>
            Bula de referência{' '}
            <a href={sourceUrl} target="_blank" rel="noreferrer">acessar</a>
          </li>
        ) : null}
      </ol>
    </section>
  );
}

import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Balão ancorado no elemento com data-tip="<id>". Fica em position: fixed
// (portal no body) para não ser cortado por overflow dos cards, e se
// reposiciona em scroll e resize. Marca o alvo com data-tip-active para o
// destaque do CSS.
const MARGEM = 12;
const LARGURA = 320;

function computePosition(target) {
  const rect = target.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const largura = Math.min(LARGURA, vw - MARGEM * 2);
  // Abaixo do alvo por padrão; acima quando não cabe embaixo.
  const abaixo = rect.bottom + MARGEM + 160 <= vh || rect.top < 200;
  const left = Math.min(Math.max(rect.left, MARGEM), vw - largura - MARGEM);
  const arrowLeft = Math.min(Math.max(rect.left + rect.width / 2 - left, 18), largura - 18);

  return {
    largura,
    left,
    top: abaixo ? rect.bottom + MARGEM : null,
    bottom: abaixo ? null : vh - rect.top + MARGEM,
    placement: abaixo ? 'below' : 'above',
    arrowLeft,
  };
}

function ProductTip({ tip, onDismiss }) {
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!tip) {
      return undefined;
    }

    const target = document.querySelector(`[data-tip="${tip.id}"]`);

    if (!target) {
      return undefined;
    }

    target.setAttribute('data-tip-active', '');

    const rect = target.getBoundingClientRect();

    if (rect.top < 80 || rect.bottom > window.innerHeight - 80) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    const update = () => setPos(computePosition(target));
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    const timer = window.setInterval(update, 250);

    return () => {
      target.removeAttribute('data-tip-active');
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      window.clearInterval(timer);
    };
  }, [tip]);

  useEffect(() => {
    if (!tip) {
      return undefined;
    }

    const onKey = (event) => {
      if (event.key === 'Escape') {
        onDismiss?.();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tip, onDismiss]);

  if (!tip || !pos) {
    return null;
  }

  const style = {
    width: `${pos.largura}px`,
    left: `${pos.left}px`,
    ...(pos.top !== null ? { top: `${pos.top}px` } : { bottom: `${pos.bottom}px` }),
  };

  return createPortal(
    <div
      className={`product-tip product-tip-${pos.placement}`}
      style={style}
      role="dialog"
      aria-live="polite"
      aria-labelledby={`product-tip-${tip.id}-title`}
    >
      <span className="product-tip-arrow" style={{ left: `${pos.arrowLeft}px` }} aria-hidden="true" />
      <div className="product-tip-body">
        <span className="product-tip-kicker">Dica</span>
        <strong id={`product-tip-${tip.id}-title`}>{tip.title}</strong>
        <p>{tip.text}</p>
      </div>
      <div className="product-tip-actions">
        <button type="button" className="product-tip-button" onClick={onDismiss}>
          Entendi
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default ProductTip;

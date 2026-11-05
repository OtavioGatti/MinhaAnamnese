import { useCallback, useEffect, useRef, useState } from 'react';
import { pickNextTip } from '../lib/productTips';

// Um balão de cada vez, nunca enquanto a pessoa digita, com uma pausa entre
// um e outro. A escolha (qual dica, se o alvo está na tela) é de
// productTips.js; aqui só o tempo: espera o contexto ficar estável antes de
// mostrar e esconde se o alvo some ou a condição deixa de valer.
const ESTABILIDADE_MS = 1200;
const PAUSA_DEPOIS_DE_DIGITAR_MS = 2500;
const PAUSA_ENTRE_DICAS_MS = 20000;
const INTERVALO_MS = 700;

function isTargetPresent(id) {
  if (typeof document === 'undefined') {
    return false;
  }

  const el = document.querySelector(`[data-tip="${id}"]`);
  return Boolean(el && el.getClientRects().length > 0);
}

export default function useProductTips({ enabled, preview = false, seen, context, onShow, onDismiss }) {
  const [activeTip, setActiveTip] = useState(null);
  const dismissedRef = useRef(new Set());
  const shownRef = useRef(new Set());
  const pendingRef = useRef(null);
  const lastDismissedAtRef = useRef(0);
  const contextRef = useRef(context);
  const seenRef = useRef(seen);
  const callbacksRef = useRef({ onShow, onDismiss });

  contextRef.current = context;
  seenRef.current = seen;
  callbacksRef.current = { onShow, onDismiss };

  useEffect(() => {
    if (!enabled) {
      setActiveTip(null);
      return undefined;
    }

    const tick = () => {
      const ctx = contextRef.current || {};
      const now = Date.now();
      const digitando = ctx.lastTypedAt && now - ctx.lastTypedAt < PAUSA_DEPOIS_DE_DIGITAR_MS;
      const emPausa = lastDismissedAtRef.current && now - lastDismissedAtRef.current < PAUSA_ENTRE_DICAS_MS;
      // No modo de teste (?dicas=1) o perfil não conta: só o que fechou agora.
      const vistas = [...(preview ? [] : seenRef.current || []), ...dismissedRef.current];
      const candidata = ctx.blocked || digitando || emPausa
        ? null
        : pickNextTip({ seen: vistas, context: ctx, usedFeatures: preview ? null : ctx.usedFeatures, isTargetPresent });

      setActiveTip((atual) => {
        if (atual) {
          // Some se deixou de fazer sentido (alvo sumiu, condição mudou,
          // modal abriu); não conta como vista.
          return candidata && candidata.id === atual.id ? atual : null;
        }

        if (!candidata) {
          pendingRef.current = null;
          return null;
        }

        if (!pendingRef.current || pendingRef.current.id !== candidata.id) {
          pendingRef.current = { id: candidata.id, since: now };
          return null;
        }

        if (now - pendingRef.current.since < ESTABILIDADE_MS) {
          return null;
        }

        pendingRef.current = null;

        if (!shownRef.current.has(candidata.id)) {
          shownRef.current.add(candidata.id);
          callbacksRef.current.onShow?.(candidata.id);
        }

        return candidata;
      });
    };

    tick();
    const timer = window.setInterval(tick, INTERVALO_MS);

    return () => window.clearInterval(timer);
  }, [enabled, preview]);

  const dismissActiveTip = useCallback(() => {
    setActiveTip((atual) => {
      if (atual) {
        dismissedRef.current.add(atual.id);
        lastDismissedAtRef.current = Date.now();
        callbacksRef.current.onDismiss?.(atual.id);
      }

      return null;
    });
  }, []);

  return { activeTip, dismissActiveTip };
}

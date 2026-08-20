import { useCallback, useEffect, useRef, useState } from 'react';

// `useState` que sobrevive à desmontagem do componente.
//
// As páginas são montadas por `currentPage === '...' && <Pagina />` no App: sair
// da aba desmonta o componente de verdade, e todo estado local morre junto. Era
// por isso que uma busca de prescrição ou uma calculadora meio preenchida
// voltavam zeradas depois de passar pela Home.
//
// O padrão é `sessionStorage`: o rascunho sobrevive a navegar entre abas e a um
// F5 sem querer, mas some ao fechar a aba — que é o tempo de vida certo para
// estado de trabalho, não para dado que a pessoa espera guardar.

function readStored(storage, key, fallback) {
  if (!storage) {
    return fallback;
  }

  try {
    const raw = storage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (_error) {
    // Valor corrompido ou storage bloqueado (aba anônima, cota cheia): cair no
    // inicial é melhor do que derrubar a tela por causa de um rascunho.
    return fallback;
  }
}

function resolveStorage(kind) {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch (_error) {
    return null;
  }
}

export function usePersistedState(key, initialValue, { storage = 'session' } = {}) {
  const storageRef = useRef(null);

  if (storageRef.current === null) {
    storageRef.current = resolveStorage(storage);
  }

  const [value, setValue] = useState(() => readStored(storageRef.current, key, initialValue));

  useEffect(() => {
    const store = storageRef.current;

    if (!store) {
      return;
    }

    try {
      store.setItem(key, JSON.stringify(value));
    } catch (_error) {
      // Persistir é melhor esforço: sem espaço, o app segue funcionando com o
      // estado em memória.
    }
  }, [key, value]);

  const clear = useCallback(() => {
    setValue(initialValue);

    try {
      storageRef.current?.removeItem(key);
    } catch (_error) {
      // idem
    }
    // `initialValue` fica fora das dependências de propósito: literais de objeto
    // (`{}`, `[]`) mudam de identidade a cada render e recriariam o callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, setValue, clear];
}

export default usePersistedState;

import { useRef } from 'react';
import { api } from '../apiClient';
import usePersistedState from './usePersistedState';

// Os catálogos (bulário, prescrição, ferramentas) abrem sozinhos o 1º item da
// lista para a tela não ficar vazia. Abrir a página não é usar o recurso: o
// detalhe desse item vai com `auto=1` e o servidor não grava em `usage_logs`.
// Até 07/11/2026 contava, e o 1º item de cada catálogo (abatacepte, gasometria
// arterial) virava o "mais consultado" do painel — e a oferta do Pro dizia que
// a pessoa tinha usado um recurso que ela só viu abrir.
//
// Passa a contar quando a pessoa escolhe: clicar num item (inclusive no que
// abriu sozinho), chegar por link, ou usar o item aberto (`confirmUse`, ex.:
// preencher a calculadora).
//
// A marca fica na sessão da aba, junto com a seleção: voltar à página (ou dar
// F5 no /bulario/<slug> que a abertura escreveu na URL) reabre o mesmo item, e
// ele continua não sendo escolha da pessoa.
export default function useAutoSelection({ storageKey, selectedSlug, setSelectedSlug, detailPath }) {
  const [autoSlug, setAutoSlug] = usePersistedState(storageKey, '');
  const autoSlugRef = useRef(autoSlug);
  // Lido pelo efeito que carrega o detalhe, que roda depois deste render.
  autoSlugRef.current = autoSlug;

  const isAutomatic = (slug) => Boolean(slug) && autoSlugRef.current === slug;

  // Pede o detalhe de novo, sem a marca, só para o servidor registrar o uso.
  // A resposta é descartada: a tela já mostra esse item.
  function registerUse(slug) {
    api.get(detailPath(slug));
  }

  return {
    detailUrl(slug) {
      return isAutomatic(slug) ? `${detailPath(slug)}&auto=1` : detailPath(slug);
    },

    selectAutomatically(slug) {
      setAutoSlug(slug);
      setSelectedSlug(slug);
    },

    // Escolha da pessoa. Clicar no item que já estava aberto não muda a
    // seleção (o detalhe não é pedido de novo), então o uso vai à parte.
    selectByUser(slug) {
      if (slug && slug === selectedSlug && isAutomatic(slug)) {
        registerUse(slug);
      }

      setAutoSlug('');
      setSelectedSlug(slug);
    },

    confirmUse() {
      if (!isAutomatic(selectedSlug)) {
        return;
      }

      setAutoSlug('');
      registerUse(selectedSlug);
    },
  };
}

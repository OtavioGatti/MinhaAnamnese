// Marcador único de seção vazia na saída da organização.
//
// Os prompts do CMS são editados à mão e já pediram grafias diferentes: o de
// geriatria mandava "[nao relatado]" e o modelo obedecia em 10 de 10 rodadas.
// Como a tela mostra a seção em maiúsculas, a falta do acento aparecia como
// "[NAO RELATADO]". Pedir no prompt não basta para todos os prompts presentes
// e futuros, então a grafia é corrigida aqui.
//
// Só variações de grafia de "não relatado" são trocadas. "[DADO AUSENTE]" e
// "[INFORMAÇÃO INSUFICIENTE]" são outros marcadores e ficam como vieram.
const STANDARD_MISSING_MARKER = '[Não relatado]';
const MISSING_MARKER_VARIANTS = /\[\s*n[aã]o\s+relatad[oa]\s*\]/gi;

function normalizeMissingMarkers(text) {
  return String(text || '').replace(MISSING_MARKER_VARIANTS, STANDARD_MISSING_MARKER);
}

module.exports = {
  STANDARD_MISSING_MARKER,
  normalizeMissingMarkers,
};

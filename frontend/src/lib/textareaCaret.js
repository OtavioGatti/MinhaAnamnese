// Posição do cursor dentro de um <textarea>, em pixels.
//
// Não existe API nativa para isso (Selection/Range só funcionam em conteúdo
// renderizado, não no valor de um textarea). A técnica padrão é a "div espelho":
// um elemento fora da tela que replica exatamente as regras de quebra de linha
// do campo, recebe o texto até o cursor e um marcador no fim — a posição do
// marcador é a posição do cursor.
//
// Usado pelo popover de menção de medicamentos (@) para abrir ao lado da linha
// que está sendo escrita, em vez de por cima dela.

// Só o que afeta onde o texto quebra e onde cada linha começa. Copiar o estilo
// inteiro traria coisas (background, box-shadow) que só custam performance.
const MIRRORED_PROPERTIES = [
  'boxSizing',
  'width',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontVariant',
  'letterSpacing',
  'lineHeight',
  'textAlign',
  'textIndent',
  'textTransform',
  'wordSpacing',
  'tabSize',
];

function parseLineHeight(computed) {
  const lineHeight = Number.parseFloat(computed.lineHeight);

  if (Number.isFinite(lineHeight)) {
    return lineHeight;
  }

  // lineHeight: normal não vira número. ~1.2x o tamanho da fonte é a
  // aproximação usual dos navegadores.
  const fontSize = Number.parseFloat(computed.fontSize);
  return Number.isFinite(fontSize) ? fontSize * 1.2 : 16;
}

/**
 * Posição do cursor relativa à borda superior/esquerda do textarea, já
 * descontada a rolagem interna do campo.
 *
 * @returns {{ top: number, left: number, lineHeight: number } | null}
 */
export function getCaretPosition(textarea, index) {
  if (!textarea || typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  const computed = window.getComputedStyle(textarea);
  const lineHeight = parseLineHeight(computed);
  const mirror = document.createElement('div');

  for (const property of MIRRORED_PROPERTIES) {
    mirror.style[property] = computed[property];
  }

  // Fora da tela, mas ainda renderizado: sem layout não há offsetTop.
  mirror.style.position = 'absolute';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.visibility = 'hidden';
  mirror.style.overflow = 'hidden';
  // Reproduz a quebra de linha do textarea. Sem isso o espelho renderiza tudo
  // numa linha só e a medição erra em qualquer texto que passe da largura.
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.height = 'auto';

  const value = textarea.value || '';
  mirror.textContent = value.slice(0, index);

  const marker = document.createElement('span');
  // Um caractere qualquer: um span vazio pode colapsar e não medir altura.
  marker.textContent = '.';
  mirror.appendChild(marker);

  document.body.appendChild(mirror);

  const top = marker.offsetTop - textarea.scrollTop;
  const left = marker.offsetLeft - textarea.scrollLeft;

  document.body.removeChild(mirror);

  return { top, left, lineHeight };
}

export default getCaretPosition;

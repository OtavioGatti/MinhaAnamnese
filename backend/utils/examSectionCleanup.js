// Remove linha de sistema vazia dentro do exame físico.
//
// POR QUE ISTO EXISTE, E POR QUE NO CÓDIGO E NÃO NO PROMPT:
//
// O modelo devolvia linha para sistema que ninguém examinou, preenchida com
// marcador de ausência ("SSVV: [Não relatado]", "NEURO: [Não relatado]"). A
// causa é uma colisão de sintaxe: as linhas do exame usam o mesmo formato
// "RÓTULO:" das seções do template, e a regra "seção vazia recebe marcador"
// escorrega para dentro delas.
//
// Três rodadas de edição de prompt (código e CMS) levaram de 7 para 2-3 linhas
// fantasma por geração, e pararam de melhorar. Instrução de prompt é pedido,
// não garantia. Esta passagem é determinística: o mesmo texto sempre sai igual,
// e um teste trava o comportamento.
//
// O que NÃO faz: não mexe em nenhuma outra seção. Marcador em seção vazia (ID,
// QP, MUC...) é o comportamento correto e continua intacto. Também não remove
// linha que tenha conteúdo real junto do marcador.

const { isPhysicalExamSection, isMentalExamSection } = require('./examSectionGuidance');

// Marcadores de ausência aceitos em qualquer variação de caixa/acento que os
// prompts usam hoje (o CMS padroniza [Não relatado]; o código usa os outros).
const MARCADOR = /\[\s*(n[ãa]o\s+relatado|n[ãa]o\s+informado|dado\s+ausente|informa[çc][ãa]o\s+insuficiente|sem\s+dados?)\s*\]/i;

// Linha que é SÓ marcador, com ou sem bullet e com ou sem rótulo de sistema.
// Exemplos que casam:  "- [Não relatado]"  "SSVV: [Não relatado]"
//                      "- NEURO: [Não relatado]"
// Não casa: "AC: [Não relatado] mas com sopro" (tem conteúdo real junto).
const SO_MARCADOR = new RegExp(
  `^\\s*(?:[-*•]\\s*)?(?:[^:]{1,40}:\\s*)?${MARCADOR.source}\\s*$`,
  'i',
);

function ehLinhaDeSecao(linha, rotulos) {
  const texto = String(linha || '').trim();

  return rotulos.some((rotulo) => {
    const inicio = `${rotulo}:`;
    return texto.toLocaleLowerCase('pt-BR').startsWith(inicio.toLocaleLowerCase('pt-BR'));
  });
}

function ehSecaoDeExame(linha, rotulos) {
  const texto = String(linha || '').trim();

  return rotulos.some((rotulo) => {
    const inicio = `${rotulo}:`;

    if (!texto.toLocaleLowerCase('pt-BR').startsWith(inicio.toLocaleLowerCase('pt-BR'))) {
      return false;
    }

    return isPhysicalExamSection(rotulo) || isMentalExamSection(rotulo);
  });
}

/**
 * @param {string} resultado saída organizada pelo modelo
 * @param {string[]} secoes rótulos de seção do template (fonte da verdade das
 *   fronteiras — sem isto seria preciso adivinhar onde o exame termina)
 */
function removeLinhasVaziasDoExame(resultado, secoes) {
  const rotulos = (Array.isArray(secoes) ? secoes : [])
    .map((secao) => String(secao || '').trim())
    .filter(Boolean);

  if (!resultado || rotulos.length === 0) {
    return resultado;
  }

  const linhas = String(resultado).split(/\r?\n/);
  const saida = [];
  let dentroDoExame = false;
  let indiceDoRotulo = -1;
  let manteveAlgumaLinha = false;

  function fechaExame() {
    // Exame inteiro sem achado: a seção existe e está vazia, então o marcador
    // é legítimo — mas UMA vez, na linha do rótulo, não por sistema.
    if (dentroDoExame && !manteveAlgumaLinha && indiceDoRotulo >= 0) {
      const rotulo = saida[indiceDoRotulo];

      if (rotulo && !MARCADOR.test(rotulo)) {
        saida[indiceDoRotulo] = `${rotulo.trimEnd()} [Não relatado]`;
      }
    }

    dentroDoExame = false;
    indiceDoRotulo = -1;
    manteveAlgumaLinha = false;
  }

  linhas.forEach((linha) => {
    if (ehLinhaDeSecao(linha, rotulos)) {
      fechaExame();

      if (ehSecaoDeExame(linha, rotulos)) {
        dentroDoExame = true;
        indiceDoRotulo = saida.length;
        // O rótulo pode trazer o conteúdo na mesma linha ("EF: BEG, corado").
        const depoisDoRotulo = String(linha).slice(String(linha).indexOf(':') + 1).trim();
        manteveAlgumaLinha = Boolean(depoisDoRotulo) && !MARCADOR.test(depoisDoRotulo);
      }

      saida.push(linha);
      return;
    }

    if (dentroDoExame) {
      if (SO_MARCADOR.test(linha)) {
        return;
      }

      if (linha.trim()) {
        manteveAlgumaLinha = true;
      }
    }

    saida.push(linha);
  });

  fechaExame();

  return saida.join('\n');
}

// --- rede de segurança contra perda de achado ------------------------------
//
// O bug real: o médico escreveu "C+P: Tireoide..." e "AP: Murmúrios abolidos
// em base, estertorando difusamente". Como C+P não estava na lista de siglas,
// o modelo encaixou a tireoide em AP e SOBRESCREVEU o achado pulmonar, que
// sumiu sem deixar rastro.
//
// A orientação do prompt já foi corrigida, mas prompt é pedido, não garantia —
// e aqui o custo do erro é apagar achado clínico. Esta passagem compara o texto
// do médico com a saída e devolve o que desapareceu, COM AS PALAVRAS DELE.
//
// Deliberadamente conservadora: só age quando NENHUMA palavra distintiva da
// linha sobreviveu em lugar nenhum da saída. Reescrita clínica normal
// ("BRNF 2T" -> "Bulhas normofonéticas") preserva parte das palavras e não
// dispara nada.

// Rótulos que reconhecidamente nomeiam sistema/segmento no exame físico. A
// lista existe para NÃO mexer em linhas de outras seções (MUC:, HDA:...), cuja
// realocação é legítima.
const ROTULOS_DE_SISTEMA = new Set([
  'estado geral', 'eg', 'ectoscopia', 'ssvv', 'sinais vitais', 'sv',
  'c+p', 'cp', 'cabeca e pescoco', 'cabeca', 'pescoco',
  'ap', 'ar', 'aparelho respiratorio', 'respiratorio', 'pulmonar', 'torax',
  'ac', 'acv', 'aparelho cardiovascular', 'cardiovascular', 'cardiaco', 'precordio',
  'abd', 'ad', 'abdome', 'abdomen',
  'mmii', 'mmss', 'membros', 'membros inferiores', 'extremidades',
  'neuro', 'neurologico',
  'pele', 'tegumentar', 'oroscopia', 'otoscopia', 'orofaringe',
  'genital', 'genitalia', 'reflexos', 'mamas', 'tireoide', 'coluna', 'osteoarticular',
  'linfonodos', 'fundoscopia', 'ausculta', 'toque', 'perineo',
]);

// Palavras curtas ou genéricas demais para provar sobrevivência de conteúdo.
const GENERICAS = new Set([
  'sem', 'com', 'para', 'pela', 'pelo', 'nao', 'sim', 'que', 'dos', 'das',
  'presente', 'presentes', 'ausente', 'ausentes', 'normal', 'normais',
  'alteracao', 'alteracoes', 'exame', 'fisico', 'paciente', 'refere', 'nega',
  'bilateralmente', 'bilateral', 'direita', 'esquerda', 'leve', 'moderado',
]);

function normalizaTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function tokensDistintivos(conteudo) {
  return [...new Set(
    normalizaTexto(conteudo)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4 && !GENERICAS.has(t)),
  )];
}

function ehRotuloDeSistema(rotulo) {
  return ROTULOS_DE_SISTEMA.has(normalizaTexto(rotulo).replace(/\s+/g, ' ').trim());
}

/** Linhas "ROTULO: conteúdo" do texto do médico que nomeiam sistema do exame. */
function achadosDeSistemaNoOriginal(texto) {
  return String(texto || '')
    .split(/\r?\n/)
    .map((linha) => {
      const casou = /^\s*[-*•]?\s*([^:]{1,28}):\s*(.+?)\s*$/.exec(linha);

      if (!casou) {
        return null;
      }

      const [, rotulo, conteudo] = casou;

      if (!ehRotuloDeSistema(rotulo)) {
        return null;
      }

      const tokens = tokensDistintivos(conteudo);
      // Sem palavra distintiva não dá para provar perda sem falso positivo.
      return tokens.length ? { rotulo: rotulo.trim(), conteudo, tokens } : null;
    })
    .filter(Boolean);
}

/**
 * Devolve ao exame físico os achados de sistema que sumiram por completo.
 *
 * @param {string} resultado saída já organizada
 * @param {string} original texto que o médico escreveu
 * @param {string[]} secoes rótulos de seção do template
 */
function preservaAchadosDoExame(resultado, original, secoes) {
  if (!resultado || !original) {
    return resultado;
  }

  const saidaNormalizada = normalizaTexto(resultado);
  const perdidos = achadosDeSistemaNoOriginal(original)
    .filter(({ tokens }) => !tokens.some((token) => saidaNormalizada.includes(token)));

  if (!perdidos.length) {
    return resultado;
  }

  const rotulos = (Array.isArray(secoes) ? secoes : [])
    .map((secao) => String(secao || '').trim())
    .filter(Boolean);
  const linhas = String(resultado).split(/\r?\n/);

  // Fim da seção de exame: onde a próxima seção do template começa.
  let inicioExame = -1;
  let fimExame = linhas.length;

  linhas.forEach((linha, i) => {
    if (!ehLinhaDeSecao(linha, rotulos)) {
      return;
    }

    if (inicioExame === -1 && ehSecaoDeExame(linha, rotulos)) {
      inicioExame = i;
      return;
    }

    if (inicioExame !== -1 && i > inicioExame && fimExame === linhas.length) {
      fimExame = i;
    }
  });

  if (inicioExame === -1) {
    return resultado;
  }

  const devolvidos = perdidos.map(({ rotulo, conteudo }) => `- ${rotulo}: ${conteudo}`);

  // Se o exame tinha virado marcador de seção vazia, ele deixa de estar vazio.
  if (MARCADOR.test(linhas[inicioExame])) {
    linhas[inicioExame] = linhas[inicioExame].replace(MARCADOR, '').trimEnd();
  }

  linhas.splice(fimExame, 0, ...devolvidos);

  return linhas.join('\n');
}

module.exports = {
  achadosDeSistemaNoOriginal,
  preservaAchadosDoExame,
  removeLinhasVaziasDoExame,
  SO_MARCADOR,
};

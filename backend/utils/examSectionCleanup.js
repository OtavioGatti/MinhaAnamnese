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

module.exports = {
  removeLinhasVaziasDoExame,
  SO_MARCADOR,
};

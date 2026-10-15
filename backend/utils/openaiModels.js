// Parâmetros de chamada por família de modelo. Os modelos de raciocínio
// (gpt-5.x, gpt-6.x) recusam temperature/top_p e trocam max_tokens por
// max_completion_tokens; aqui eles rodam sem raciocínio ("none"), porque nas
// comparações de 10/2026 raciocinar só deixou as respostas mais lentas.

function isReasoningModel(model) {
  return /^gpt-(5|6)(\.|-|$)/i.test(String(model || '').trim());
}

function buildChatModelParams(model, { temperature = null, topP = null, maxTokens } = {}) {
  if (isReasoningModel(model)) {
    return { model, reasoning_effort: 'none', max_completion_tokens: maxTokens };
  }

  return {
    model,
    ...(temperature === null ? {} : { temperature }),
    ...(topP === null ? {} : { top_p: topP }),
    max_tokens: maxTokens,
  };
}

// Variável do Render > valor vindo do CMS > padrão. Só nomes de modelo
// plausíveis passam: um campo editorial com lixo não pode quebrar a chamada.
function resolveModelChoice({ envValue, cmsValue, fallback }) {
  for (const candidate of [envValue, cmsValue]) {
    const model = String(candidate || '').trim();

    if (/^gpt-[a-z0-9.-]+$/i.test(model)) {
      return model;
    }
  }

  return fallback;
}

// Alfabetos que nunca aparecem num prontuário em português. Em 10/2026 o
// gpt-5.4-mini deixou "السابقة" no meio de uma anamnese ("exames da consulta
// السابقة") — raro, mas visível. Só conta se não estava no texto de entrada.
const FOREIGN_SCRIPT = /[\u0590-\u08FF\u0400-\u04FF\u0E00-\u0E7F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/;

function hasUnexpectedForeignScript(output, input = '') {
  return FOREIGN_SCRIPT.test(String(output || '')) && !FOREIGN_SCRIPT.test(String(input || ''));
}

module.exports = {
  buildChatModelParams,
  hasUnexpectedForeignScript,
  isReasoningModel,
  resolveModelChoice,
};

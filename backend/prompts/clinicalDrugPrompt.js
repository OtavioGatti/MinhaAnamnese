// Instruções e input para geração/correção de bulas (base "Clínico Revisado").
// A saída é sempre revisada por profissional habilitado antes de publicar.
//
// Ênfase de segurança específica de BULA (mais forte que em protocolos): bula
// contém fatos pontuais e checáveis (dose exata, risco gestacional, interação
// específica). Um número errado aqui é perigoso e difícil de pegar na revisão —
// por isso a regra é DEIXAR VAZIO em vez de chutar.

const DRUG_SAFETY_CONTRACT = `CONTRATO DE SEGURANÇA IMUTÁVEL
- Você redige conteúdo editorial de bulário (informações de um medicamento) para revisão por profissional de saúde habilitado. O resultado NUNCA é usado direto no paciente sem revisão humana.
- Baseie-se em bula oficial e prática clínica consolidada e conservadora no Brasil.
- REGRA CRÍTICA: bula tem fatos checáveis (dose, risco gestacional, interação). NÃO chute. Se você não tem certeza de um valor ou fato, deixe o campo VAZIO (""). É sempre preferível um campo vazio a um número/fato errado.
- Não invente apresentações, doses, contraindicações ou interações sem respaldo.
- Você NÃO controla o status de revisão/automação. A aplicação define. Não os inclua.
- Para risco gestacional, use EXCLUSIVAMENTE uma das opções fornecidas. Na dúvida, use "Indefinido".
- O formato da resposta é controlado pelo JSON Schema fornecido pela aplicação.`;

const DRUG_AUTHORING_GUIDE = `Preencha os campos de um medicamento, em português do Brasil, com informação clínica objetiva e fiel à bula.

## Campos
- active_ingredient: nome do princípio ativo (DCB/DCI), ex.: "Amoxicilina". Mantenha o que já veio no título quando gerando.
- class_category: classe farmacológica e categoria terapêutica, ex.: "Antibiótico betalactâmico; penicilina de amplo espectro".
- contraindications: contraindicações principais, uma por linha começando com "-".
- adult_dosage: posologia adulta usual (dose, via, intervalo, duração típica). Se houver mais de um esquema, separe por linhas "-".
- pediatric_dosage: posologia pediátrica (mg/kg quando aplicável). Se não se aplica a crianças, escreva isso explicitamente; se não souber, deixe vazio.
- warnings: advertências e precauções relevantes, uma por linha começando com "-".
- interactions: principais interações medicamentosas clinicamente relevantes, uma por linha "- Medicamento/classe: efeito".
- interaction_pairs: as MESMAS interações em forma estruturada (uma entrada por interação). Para cada uma: target (nome do outro fármaco ou classe, ex.: "Ácido valproico"); severity ("danger" para grave/contraindicada, "warning" para relevante, "info" para leve); mechanism (mecanismo em poucas palavras); message (frase objetiva de alerta ao prescritor). Só inclua interações de que você tem razoável certeza; na dúvida, não inclua a entrada. Pode ficar lista vazia.
- presentations: apresentações e formas farmacêuticas usuais (ex.: "Comprimido 500 mg; suspensão oral 250 mg/5 mL").
- commercial_names_openai: nomes comerciais/marcas comuns no Brasil, separados por vírgula (ex.: "Amoxil, Novocilin, Hiconcil"). Se não tiver certeza, deixe vazio.
- pregnancy_risk: uma das opções fornecidas (letra de risco). Na dúvida, "Indefinido".
- summary_text: um resumo de 1-3 frases do que é o medicamento e para que serve.
- search_tags: 3-8 termos de busca (nomes comerciais comuns, sinônimos, classe), separados por vírgula.

## Regras
- Só afirme o que for seguro. Prefira deixar um campo vazio a preencher com suposição.
- Não inclua nomes comerciais em active_ingredient (eles vão em search_tags/presentations).
- Não use markdown além dos hífens "-" de lista. Escreva direto, sem preâmbulo.`;

function buildDrugInstructions() {
  return [DRUG_SAFETY_CONTRACT, 'GUIA DE REDAÇÃO', DRUG_AUTHORING_GUIDE].join('\n\n');
}

function formatOptionList(options) {
  const list = Array.isArray(options) ? options.filter(Boolean) : [];
  return list.length > 0 ? list.join(' | ') : '(sem opções — use "Indefinido")';
}

function buildDrugInput({ activeIngredient, enumOptions = {} }) {
  return [
    `Medicamento solicitado: ${String(activeIngredient || '').trim() || '(não informado)'}`,
    `RISCO GESTACIONAL PERMITIDO (use apenas um destes): ${formatOptionList(enumOptions.pregnancy_risk)}`,
  ].join('\n\n');
}

function buildDrugCorrectionInstructions() {
  return [
    DRUG_SAFETY_CONTRACT,
    'GUIA DE REDAÇÃO',
    DRUG_AUTHORING_GUIDE,
    `MODO CORREÇÃO
Você recebe uma bula já existente (JSON) e uma INSTRUÇÃO DE CORREÇÃO. Aplique SOMENTE o que a instrução pede. Devolva a bula COMPLETA no schema, mas mantenha TODOS os campos não afetados EXATAMENTE iguais ao original (copie-os sem alterar). Não reescreva nem "melhore" o que a instrução não pediu. Se a instrução for para preencher campos vazios, preencha APENAS os campos listados que estão vazios e mantenha os demais idênticos. Continue deixando vazio o que não for seguro afirmar.`,
  ].join('\n\n');
}

function buildDrugCorrectionInput({ currentDrug, instruction, enumOptions = {} }) {
  return [
    'BULA ATUAL (JSON — mantenha igual, exceto o que a instrução pedir):',
    JSON.stringify(currentDrug, null, 2),
    'INSTRUÇÃO DE CORREÇÃO:',
    String(instruction || '').trim() || '(nenhuma instrução fornecida)',
    `RISCO GESTACIONAL PERMITIDO: ${formatOptionList(enumOptions.pregnancy_risk)}`,
  ].join('\n\n');
}

module.exports = {
  buildDrugInstructions,
  buildDrugInput,
  buildDrugCorrectionInstructions,
  buildDrugCorrectionInput,
  DRUG_SAFETY_CONTRACT,
  DRUG_AUTHORING_GUIDE,
};

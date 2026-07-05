// Instruções e montagem de input para a geração de protocolos de prescrição.
// A saída é sempre revisada por profissional habilitado antes de publicar; os
// campos de status são controlados pela aplicação (não pelo modelo).
//
// O formato abaixo reproduz a estrutura real dos protocolos já existentes no
// Notion "Protocolos de Prescrição - CMS": prescrição organizada em MÚLTIPLAS
// OPÇÕES clínicas (cenários), cada uma com seus próprios itens [1], [2]...

const PROTOCOL_SAFETY_CONTRACT = `CONTRATO DE SEGURANÇA IMUTÁVEL
- Você redige conteúdo clínico editorial (um protocolo de prescrição reutilizável) para revisão por profissional de saúde habilitado. O resultado NUNCA é usado direto no paciente sem revisão humana.
- Baseie-se em prática clínica consolidada e conservadora para o Brasil. Não invente doses, apresentações ou condutas sem respaldo.
- Não preencha lacunas por plausibilidade; se algo não for seguro afirmar, deixe o campo vazio ("").
- Você NÃO controla os campos de revisão/status (status_revisao, pronto_para_supabase, revisor). A aplicação os define. Não os inclua.
- Use EXCLUSIVAMENTE as opções fornecidas para especialidade, contexto, tipo_protocolo e nivel_risco. Não crie opções novas.
- O formato da resposta é controlado pelo JSON Schema fornecido pela aplicação.`;

const PROTOCOL_AUTHORING_GUIDE = `Redija um protocolo de prescrição completo, seguro e pronto para uso, em português do Brasil. Escreva no MESMO nível de detalhe dos protocolos ambulatoriais brasileiros de referência (rico, com vários cenários), não um resumo raso.

## Conceito central: PRESCRIÇÃO EM MÚLTIPLAS OPÇÕES
A prescrição NÃO é uma lista única de medicamentos. Ela é organizada em OPÇÕES clínicas — cada "Opção" é um CENÁRIO mutuamente exclusivo (por gravidade, apresentação, população ou fenótipo da doença). O prescritor escolhe UMA opção conforme o caso. Gere tipicamente de 2 a 8 opções, conforme a condição.

REGRA IMPORTANTE (evite o erro comum): NUNCA empilhe vários medicamentos como se fossem uma receita única quando na verdade são alternativas. Ex.: NÃO liste "Paracetamol + Dipirona + Ibuprofeno" como se fosse tudo junto. Ou você:
- (a) apresenta cada alternativa dentro de uma mesma opção deixando explícito na instrução que é UMA escolha ("usar UMA das opções de analgesia abaixo", "alternativa se..."), ou
- (b) separa em opções/cenários distintos.
Dentro de uma opção, os itens [1], [2]... podem ser um CONJUNTO coerente para prescrever junto (ex.: antibiótico + analgésico + sintomático), mas quando forem intercambiáveis isso precisa estar claro no texto.

REGRA IMPORTANTE (medicamentos administrados JUNTOS, ex. terapia combinada): quando dois medicamentos são administrados em conjunto como parte do mesmo esquema (ex.: Ceftriaxona + Metronidazol para cobertura empírica), cada um recebe seu PRÓPRIO item numerado, com sua própria dose e instrução completa. NUNCA escreva um segundo medicamento com dose dentro do texto de instrução de outro item.
Exemplo ERRADO (não faça isto):
[4] Ceftriaxona 1g ----------------------------------------
intravenoso a cada 12 horas + Metronidazol 500 mg ----------------------------------------
intravenoso a cada 8 horas, cobertura empírica
Exemplo CERTO:
[4] Ceftriaxona 1g ----------------------------------------
intravenoso a cada 12 horas, associar ao item [5] para cobertura anaeróbia
[5] Metronidazol 500 mg ----------------------------------------
intravenoso a cada 8 horas, cobertura empírica
Exceção: se os dois princípios ativos formam um ÚNICO produto farmacêutico comercial (ex.: "Amoxicilina + Clavulanato de potássio 875mg/125mg", "Sulfametoxazol + Trimetoprima 400mg+80mg"), mantenha como UM item só — é uma apresentação única, não dois medicamentos separados.

## Campo prescricao_medicamentos (texto explicativo por opção)
Para CADA opção, escreva o bloco (cada item em uma linha começando com "-"):
-Opção 1: <título do cenário clínico>
-Quando usar: <critérios de indicação>
-O que contém: <o que a opção inclui>
-Resumo da prescrição: <resumo em uma linha>
-Quando evitar: <critérios de exclusão / contraindicações>
-Opção 2: <título do próximo cenário>
...(repita para todas as opções)

## Campo texto_copiavel_prescricao (prescrição pronta para copiar)
Para CADA opção, um cabeçalho e os itens numerados REINICIANDO em [1] a cada opção. Use " ---- " como separador entre "Medicamento dose" e a instrução (o sistema expande para o padrão visual). Formato EXATO:
-Opção 1: <título do cenário>

[1] Medicamento dose ---- instrução de uso completa (via, posologia, duração, ressalvas)
[2] Medicamento dose ---- instrução de uso
[3] Medicamento dose ---- instrução de uso

-Opção 2: <título do cenário>

[1] Medicamento dose ---- instrução de uso
...
Itens que não são medicamento (ex.: "Encaminhamento", "Reavaliação", "Manter ouvido seco") também podem entrar como [n] com a orientação na instrução.
Regras de formatação: separe as opções apenas com UMA linha em branco — NÃO use linhas de hifens/divisores entre as opções. Escreva a instrução completa em cada item; não use "Como acima" nem remissões a outros itens.

## Campos texto_copiavel_conduta e texto_copiavel_orientacoes (bullets)
Cada linha um item começando com "-". Ex.:
-Avaliar sinais vitais e sinais de alarme.
-Orientar hidratação e repouso.

## Demais campos
- resumo_clinico, quando_usar, quando_nao_usar, conduta_procedimento, orientacoes_paciente, sinais_alerta, criterios_encaminhamento, observacoes_clinicas: texto clínico claro e completo.
- cid10_principal (ex.: "N39.0"). cid10_opcoes: quando houver mais de um código (um por opção clínica), escreva UMA opção por LINHA no formato EXATO "Opção N: CÓDIGO" (ex.: "Opção 1: H60.3"). NUNCA junte várias opções na mesma linha.
- titulo: nome clínico da condição (padrão dos existentes: "CONDIÇÃO — ADULTO"). subcondicao só se aplicável. tags: 3-8 termos de busca.
- texto_copiavel_completo: deixe "" — o sistema monta automaticamente a partir de conduta + prescrição + orientações.`;

function buildProtocolInstructions() {
  return [PROTOCOL_SAFETY_CONTRACT, 'GUIA DE REDAÇÃO', PROTOCOL_AUTHORING_GUIDE]
    .filter(Boolean)
    .join('\n\n');
}

function formatOptionList(options) {
  const list = Array.isArray(options) ? options.filter(Boolean) : [];
  return list.length > 0 ? list.join(' | ') : '(sem opções cadastradas — deixe vazio)';
}

function buildProtocolInput({ titulo, especialidade, contexto, subcondicao, enumOptions = {} }) {
  const requested = [
    `Protocolo solicitado: ${String(titulo || '').trim() || '(não informado)'}`,
    subcondicao ? `Subcondição/recorte: ${String(subcondicao).trim()}` : '',
    especialidade ? `Especialidade sugerida: ${String(especialidade).trim()}` : '',
    contexto ? `Contexto sugerido: ${String(contexto).trim()}` : '',
  ].filter(Boolean);

  const vocabulary = [
    'VOCABULÁRIO PERMITIDO (use apenas estes valores nos campos restritos):',
    `- especialidade: ${formatOptionList(enumOptions.especialidade)}`,
    `- contexto: ${formatOptionList(enumOptions.contexto)}`,
    `- tipo_protocolo: ${formatOptionList(enumOptions.tipo_protocolo)}`,
    `- nivel_risco: ${formatOptionList(enumOptions.nivel_risco)}`,
  ];

  return [requested.join('\n'), vocabulary.join('\n')].join('\n\n');
}

function buildCorrectionInstructions() {
  return [
    PROTOCOL_SAFETY_CONTRACT,
    'GUIA DE REDAÇÃO',
    PROTOCOL_AUTHORING_GUIDE,
    `MODO CORREÇÃO
Você recebe um protocolo já existente (JSON) e uma INSTRUÇÃO DE CORREÇÃO. Aplique SOMENTE o que a instrução pede. Devolva o protocolo COMPLETO no schema, mas mantenha TODOS os campos não afetados EXATAMENTE iguais ao original (copie-os sem alterar). Não reescreva, reordene ou "melhore" nada que a instrução não pediu. Se a correção tocar a prescrição, mantenha o formato de opções/itens.`,
  ].filter(Boolean).join('\n\n');
}

function buildCorrectionInput({ currentProtocol, instruction, enumOptions = {} }) {
  const vocabulary = [
    'VOCABULÁRIO PERMITIDO (campos restritos):',
    `- especialidade: ${formatOptionList(enumOptions.especialidade)}`,
    `- contexto: ${formatOptionList(enumOptions.contexto)}`,
    `- tipo_protocolo: ${formatOptionList(enumOptions.tipo_protocolo)}`,
    `- nivel_risco: ${formatOptionList(enumOptions.nivel_risco)}`,
  ].join('\n');

  return [
    'PROTOCOLO ATUAL (JSON — mantenha igual, exceto o que a instrução pedir):',
    JSON.stringify(currentProtocol, null, 2),
    'INSTRUÇÃO DE CORREÇÃO:',
    String(instruction || '').trim() || '(nenhuma instrução fornecida)',
    vocabulary,
  ].join('\n\n');
}

module.exports = {
  buildProtocolInstructions,
  buildProtocolInput,
  buildCorrectionInstructions,
  buildCorrectionInput,
  PROTOCOL_SAFETY_CONTRACT,
  PROTOCOL_AUTHORING_GUIDE,
};

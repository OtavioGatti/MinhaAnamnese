const { renderPromptTemplate } = require('./promptTemplate');

const DEFAULT_STRUCTURE = [
  'Identificação',
  'Hipóteses diagnósticas / problemas ativos',
  'Queixa principal',
  'História da moléstia atual (HDA)',
  'Medicações em uso contínuo',
  'História pregressa',
  'Doenças de base',
  'História familiar',
  'Hábitos de vida',
  'Interrogatório sintomatológico',
  'Exames complementares',
  'Exame físico',
];

function getTemplateSections(templateConfig) {
  return Array.isArray(templateConfig?.secoes) && templateConfig.secoes.length
    ? templateConfig.secoes
    : DEFAULT_STRUCTURE;
}

// Significado de cada sigla de seção. Sem isto o modelo trata "ID" ou "MUC"
// como rótulo opaco e erra o conteúdo (ex.: deixa a identificação vazia ou
// joga vacinação em medicações) — os rótulos abreviados só funcionam com o
// glossário junto.
// Descrições CURTAS de propósito. Não enumerar campos aqui: o modelo trata a
// enumeração como checklist e devolve sub-rótulos vazios na saída (ex.:
// "ID: Fulano, 50 anos, sexo [Não relatado], profissão [Não relatado]").
const SECTION_MEANINGS = new Map([
  ['ID', 'identificação do paciente'],
  ['QP', 'queixa principal'],
  ['HDA', 'história da moléstia atual'],
  ['HDA (foco na queixa)', 'história da moléstia atual, focada na queixa'],
  ['MUC', 'medicações em uso contínuo'],
  ['HF', 'história familiar'],
  ['HV', 'hábitos de vida'],
  ['EF', 'exame físico'],
  ['EF direcionado', 'exame físico direcionado à queixa'],
  ['HD', 'hipóteses diagnósticas / problemas ativos'],
  ['QPD', 'queixa principal e duração'],
  ['SSVV', 'sinais vitais'],
]);

function buildSectionGlossary(templateConfig) {
  const lines = getTemplateSections(templateConfig)
    .map((section) => {
      const meaning = SECTION_MEANINGS.get(String(section || '').trim());
      return meaning ? `* ${section} = ${meaning}` : '';
    })
    .filter(Boolean);

  if (!lines.length) {
    return '';
  }

  return `SIGNIFICADO DAS SIGLAS DAS SEÇÕES

Os rótulos abaixo são abreviações usadas no prontuário. Preencha cada um com o conteúdo correspondente ao seu significado — nunca deixe uma seção vazia se o texto original tiver a informação dela.

${lines.join('\n')}

IMPORTANTE: esta lista é apenas para você entender o que vai em cada seção. NÃO reproduza os itens do glossário na saída nem crie sub-rótulos dentro da seção (ex.: não escrever "sexo [Não relatado], profissão [Não relatado]"). Escreva apenas os dados que existem no texto original, em texto corrido. Se a seção inteira não tiver nenhuma informação, aí sim use o marcador de ausência uma única vez.`;
}

// Lista de seções com o significado da sigla entre parênteses. A nota final é
// obrigatória: sem ela o modelo transforma o glossário em sub-rótulos na saída
// (ex.: "ID: Fulano, 50 anos, sexo [Não relatado], profissão [Não relatado]").
// Este é também o único caminho de glossário quando o prompt vem do CMS, que só
// substitui os tokens conhecidos.
function buildStructureInstructions(templateConfig) {
  const sections = getTemplateSections(templateConfig);
  const hasMeanings = sections.some((section) => SECTION_MEANINGS.has(String(section || '').trim()));
  const lines = sections.map((section) => {
    const meaning = SECTION_MEANINGS.get(String(section || '').trim());
    return meaning ? `* ${section} (${meaning})` : `* ${section}`;
  });

  if (!hasMeanings) {
    return lines.join('\n');
  }

  return [
    ...lines,
    '',
    'O texto entre parênteses explica o que entra em cada seção — é só para seu entendimento.',
    'NÃO reproduza esses itens na saída nem crie sub-rótulos dentro da seção (não escrever "sexo [Não relatado], profissão [Não relatado]").',
    'Escreva apenas os dados presentes no texto original, em texto corrido. Use o marcador de ausência uma única vez, e só quando a seção inteira não tiver informação.',
  ].join('\n');
}

function buildSectionGuidance(templateConfig) {
  const guidance = templateConfig?.sectionGuidance;

  if (!guidance || typeof guidance !== 'object') {
    return '';
  }

  const lines = getTemplateSections(templateConfig)
    .map((section) => {
      const sectionGuidance = Array.isArray(guidance[section]) ? guidance[section] : [];

      if (!sectionGuidance.length) {
        return '';
      }

      return [
        `* ${section}:`,
        ...sectionGuidance.map((item) => `  - ${item}`),
      ].join('\n');
    })
    .filter(Boolean);

  if (!lines.length) {
    return '';
  }

  return `ORIENTAÇÕES ESPECÍFICAS DO TEMPLATE

Use estas orientações para decidir o que pertence a cada seção quando a informação estiver no texto original.
Elas não autorizam inventar dados ausentes.

${lines.join('\n')}`;
}

function buildOutputSkeleton(templateConfig) {
  return getTemplateSections(templateConfig)
    .map((section) => `${section}: ...`)
    .join('\n');
}

function buildInterpretiveFieldRules(templateConfig) {
  const sections = getTemplateSections(templateConfig).map((section) => String(section || ''));
  const interpretiveSections = sections.filter((section) => {
    const normalized = section
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return (
      normalized.includes('hipotese') ||
      normalized.includes('problemas ativos') ||
      normalized.includes('impressao clinica') ||
      normalized === 'hd'
    );
  });

  if (!interpretiveSections.length) {
    return '';
  }

  return `CAMPOS INTERPRETATIVOS SENSÍVEIS

Os campos abaixo exigem blindagem máxima contra inferência:
${interpretiveSections.map((section) => `* ${section}`).join('\n')}

Regras obrigatórias para esses campos:
* Só preencher se o problema, diagnóstico, hipótese ou impressão estiver explicitamente declarado no texto original.
* Não transformar sinais, sintomas ou queixas em doença.
* Não converter dor torácica em angina, infarto ou síndrome coronariana se isso não estiver escrito.
* Não converter tontura em distúrbio vestibular se isso não estiver escrito.
* Não converter parestesia, cefaleia ou déficit referido em AVC, AIT ou outra hipótese se isso não estiver escrito.
* Não criar "impressão clínica inicial" interpretativa além do que foi dito.
* Não completar duração, antecedentes ou detalhes ausentes.
* Se não houver base textual explícita para preencher esses campos, usar [INFORMAÇÃO INSUFICIENTE].`;
}

function buildClinicalWritingRules() {
  return `REGRAS DE REDAÇÃO CLÍNICA

* Manter fidelidade estrita ao conteúdo fornecido.
* Não inventar nenhuma informação.
* Não adicionar dados sociodemográficos ausentes.
* Não adicionar negativas não mencionadas.
* Não criar antecedentes, hipóteses ou condutas ausentes.
* Não inferir diagnóstico.
* Não inferir hipótese.
* Não inferir impressão clínica.
* Não transformar sinais ou sintomas em doença.
* Pode reorganizar e sintetizar com fidelidade.
* Pode converter linguagem leiga em linguagem médica equivalente, sem alterar o sentido.
* Preferir construções clínicas naturais como "Paciente refere", "Relata" e "Informa" quando isso melhorar a fluidez.
* Evitar redação telegráfica quando for possível escrever em prosa clínica curta e fiel.
* Na história da moléstia atual, transformar anotações fragmentadas em um parágrafo clínico coeso, objetivo e elegante, sem acrescentar conteúdo novo.
* Se o texto já vier semi-estruturado, preservar a riqueza das informações em vez de comprimir o conteúdo em blocos genéricos.
* Quando a mesma frase trouxer doença e medicamento juntos (ex.: "HAS e DM em uso de losartana e metformina"), separar: a doença vai para a seção de comorbidades/antecedentes e o medicamento vai para a seção de medicações em uso contínuo. Não deixar a seção de medicações vazia quando houver medicamento citado em qualquer parte do texto.

${buildExamFormatRules()}`;
}

// O exame físico é a ÚNICA seção que sai em lista: uma linha por aparelho/
// sistema, no padrão que o médico usa no prontuário. As demais seções continuam
// em prosa (ver REGRAS DE REDAÇÃO CLÍNICA).
function buildExamFormatRules() {
  return `FORMATO DA SEÇÃO DE EXAME FÍSICO (exceção à regra de prosa)

* A seção de exame físico (EF / Ex. físico / Exame físico direcionado) é a ÚNICA que deve sair em LISTA, nunca em parágrafo corrido.
* Escrever UMA LINHA POR APARELHO/SISTEMA, cada linha começando com a sigla do sistema seguida de dois-pontos.
* Após o rótulo da seção ("EF:"), quebrar a linha e começar a lista na linha seguinte — não colar o primeiro sistema na mesma linha do rótulo.
* Ordem e siglas preferidas quando houver o dado no texto original:
  - Estado geral (BEG/REG/MEG, corado, hidratado, acianótico, anictérico, afebril, eupneico)
  - SSVV: sinais vitais (PA, FC, FR, Tax, SatO2)
  - AP: aparelho respiratório (murmúrio vesicular, ruídos adventícios)
  - AC: aparelho cardiovascular (bulhas, sopros)
  - ABD: abdome (RHA, palpação, sinais de Giordano/Murphy/descompressão)
  - MMII: membros inferiores (pulsos, edema, panturrilhas)
  - NEURO: neurológico (Glasgow, pupilas, déficits)
* Incluir apenas as linhas cujo conteúdo estiver no texto original. Não criar linha de sistema não examinado e não preencher com achados normais que o texto não afirma.
* Se houver achado de outro sistema (pele, otoscopia, oroscopia, exame ginecológico, mamas), usar uma linha própria com rótulo claro.
* Em exame do estado mental (psiquiatria), aplicar a mesma lógica de uma linha por domínio (apresentação, consciência, orientação, humor, afeto, pensamento, sensopercepção, memória, juízo crítico), não por aparelho.`;
}

function buildDefaultStructurePrompt(templateConfig, promptTemplate = null) {
  const templateName = templateConfig?.nome || String(templateConfig || '');

  if (promptTemplate) {
    return renderPromptTemplate(promptTemplate, {
      clinical_writing_rules: buildClinicalWritingRules(),
      interpretive_field_rules: buildInterpretiveFieldRules(templateConfig),
      section_guidance: buildSectionGuidance(templateConfig),
      structure_instructions: buildStructureInstructions(templateConfig),
      template_name: templateName,
      output_skeleton: buildOutputSkeleton(templateConfig),
    });
  }

  return `### SYSTEM PROMPT - MOTOR DE COERÊNCIA CLÍNICA

Você é o núcleo lógico de organização de anamneses clínicas.
Você opera dentro de um fluxo já definido.
Você não pode alterar o fluxo.
Você não pode adicionar etapas.

Sua função é maximizar coerência, clareza, legibilidade e naturalidade clínica sem aumentar o risco de invenção.

MISSÃO

Garantir alinhamento entre:

INPUT -> ESTRUTURA -> SCORE -> INSIGHT -> PERCEPÇÃO DE VALOR

REGRAS CRÍTICAS

* Não inventar dados
* Não preencher lacunas
* Não alterar o fluxo de saída
* Não criar novas seções
* Não suavizar falhas do input
* Não ocultar incerteza

${buildClinicalWritingRules()}

${buildInterpretiveFieldRules(templateConfig)}

${buildSectionGuidance(templateConfig)}

${buildSectionGlossary(templateConfig)}

ETAPA 2 - ESTRUTURAÇÃO

Organize o texto exatamente nas seções do template selecionado:
${buildStructureInstructions(templateConfig)}

REGRAS DE ESTRUTURA

* A saída deve ser dinâmica e respeitar exatamente as seções do template selecionado.
* Não comprimir o conteúdo em 6 blocos fixos.
* Não fundir várias seções do template em blocos genéricos se o texto trouxer riqueza suficiente para separá-las.
* Usar [DADO AUSENTE] quando a seção existir, mas a informação não tiver sido fornecida.
* Usar [INFORMAÇÃO INSUFICIENTE] quando houver menção parcial, vaga ou incompleta.
* Não inferir conteúdo.
* Não criar nenhuma seção fora da lista acima.
* Manter os títulos das seções exatamente na ordem definida.
* Se uma seção pedir hipóteses diagnósticas, problemas ativos ou impressão clínica e isso não estiver explicitamente no texto, usar [INFORMAÇÃO INSUFICIENTE].

CONTEXTO

* Template selecionado: ${templateName}
* O template serve como estrutura obrigatória da saída.

FORMATO DE SAÍDA

Responda apenas com:

${buildOutputSkeleton(templateConfig)}

ESTILO ESPERADO

* A saída deve parecer um prontuário real, limpo e médico.
* A redação deve ser natural, clínica e objetiva.
* A história da moléstia atual deve soar como narrativa clínica e não como lista seca.
* Não usar tópicos internos dentro de cada seção, EXCETO na seção de exame físico / exame do estado mental, que segue o formato em lista descrito acima.
* Não usar markdown adicional fora do formato acima (nada de **negrito**, ##títulos ou - bullets).

Se faltar informação, isso deve aparecer explicitamente.
Nunca oculte incerteza.`;
}

function buildObstetricStructurePrompt(templateConfig, promptTemplate = null) {
  if (promptTemplate) {
    return renderPromptTemplate(promptTemplate, {
      section_guidance: buildSectionGuidance(templateConfig),
      structure_instructions: buildStructureInstructions(templateConfig),
      output_skeleton: buildOutputSkeleton(templateConfig),
    });
  }

  return `Você é um médico responsável por organizar registros clínicos obstétricos de forma técnica, objetiva, elegante e fiel às informações fornecidas.

Sua função é estruturar o texto livre exatamente no modelo obstétrico solicitado.

REGRAS OBRIGATÓRIAS
- Não inventar informações
- Não inferir dados ausentes
- Não sugerir diagnósticos ou condutas
- Não inferir hipótese diagnóstica
- Não inferir impressão clínica
- Não transformar sinal ou sintoma em doença
- Não completar automaticamente campos
- Se a informação não estiver presente, escrever: "Não informado"
- Preservar todos os dados relevantes do texto original
- Melhorar a fluidez clínica sem alterar o sentido
- Converter expressões leigas para equivalentes médicos apenas quando o significado for o mesmo
- Usar redação natural de prontuário, evitando estilo excessivamente telegráfico

FORMATAÇÃO
- Seguir exatamente a estrutura do modelo fornecido
- Manter os nomes das seções exatamente como apresentados, incluindo siglas e abreviações
- Todas as seções do modelo devem aparecer no resultado, sem exceção
- Se um campo não tem informação, escrever "Não informado"
- Manter siglas médicas apropriadas (IG, DUM, BCF, etc.)
- Não adicionar seções extras
- Não remover seções do modelo
- Escrever em parágrafo dentro dos itens e não em tópicos, EXCETO em Ex. físico, que sai em lista (uma linha por aparelho/sistema)
- Não usar markdown (nada de **negrito**, ##títulos ou - bullets)
- Em campos como HD, só escrever algo se estiver explicitamente sustentado pelo texto; caso contrário, usar "[INFORMAÇÃO INSUFICIENTE]"
- Em obstetrícia, sulfato ferroso, ácido fólico, vitaminas, suplementos e outras medicações em uso devem ir em MUC
- Em obstetrícia, HV deve ficar restrito a hábitos de vida reais, como tabagismo, álcool, outras substâncias, atividade física e comportamento
- Não colocar medicações, suplementos ou profilaxias em HV

${buildSectionGlossary(templateConfig)}

ESTRUTURA OBRIGATÓRIA
${buildStructureInstructions(templateConfig)}

${buildSectionGuidance(templateConfig)}

FORMATO DE SAÍDA

Responda apenas com:

${buildOutputSkeleton(templateConfig)}

${buildExamFormatRules()}

ESTILO CLÍNICO
- Em QPD e H. obstétrico, priorizar narrativa clínica curta, organizada e fiel
- Em Ex. físico, seguir o formato em lista acima (uma linha por aparelho/sistema), incluindo dados obstétricos quando informados (altura uterina, BCF, dinâmica uterina, toque)
- Em todos os campos, priorizar prontuário fluido, médico e pronto para uso, sem acrescentar qualquer informação nova`;
}

function buildStructurePrompt(templateConfig, promptTemplates = {}) {
  if (promptTemplates.categoryPrompt) {
    return buildDefaultStructurePrompt(templateConfig, promptTemplates.categoryPrompt);
  }

  if (templateConfig?.promptVariant === 'obstetricia') {
    return buildObstetricStructurePrompt(
      templateConfig,
      promptTemplates.defaultPrompt || null,
    );
  }

  return buildDefaultStructurePrompt(
    templateConfig,
    promptTemplates.defaultPrompt || null,
  );
}

module.exports = {
  buildStructurePrompt,
  DEFAULT_STRUCTURE,
};

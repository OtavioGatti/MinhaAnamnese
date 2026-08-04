# -*- coding: utf-8 -*-
"""Lote 10 — alergia/urticária, feridas, gestação e restantes."""
from create_new import executar

C = ['Adulto', 'APS', 'Ambulatorial']
CP = ['Adulto', 'APS', 'Ambulatorial', 'PS']
CC = ['Pediatria', 'APS', 'Ambulatorial', 'PS']
ALERG = ['Alergia e Imunologia', 'Clínica Médica', 'Medicina de Emergência', 'APS']

ANAFILAXIA = (
 '-Dificuldade respiratória\n-Estridor\n-Sibilância\n-Edema de lábios, língua ou glote\n'
 '-Rouquidão\n-Disfagia\n-Hipotensão\n-Taquicardia\n-Tontura ou síncope\n-Vômitos com urticária\n'
 '-Dor abdominal intensa com urticária\n-Progressão rápida das lesões')

CLINICOS = {
'URTICÁRIA — ADULTO': {
 'especialidade': ALERG, 'contexto': CP, 'nivel_risco': ['Moderado', 'Alto'],
 'resumo_clinico':
  '-Erupção de placas eritematosas pruriginosas, fugazes, que mudam de lugar e duram menos de 24 horas cada.\n'
  '-Pode ser aguda (até 6 semanas) ou crônica, e acompanhar-se de angioedema.\n'
  '-Anti-histamínico é o tratamento de primeira linha; corticoide fica reservado a casos intensos e por curto período.\n'
  '-Urticária com comprometimento respiratório ou hipotensão configura anafilaxia e exige adrenalina intramuscular imediata.\n'
  '-Na maioria dos casos agudos a causa não é identificada e o quadro é autolimitado.',
 'quando_usar':
  '-Adulto com placas urticariformes pruriginosas, sem sinais de anafilaxia.\n'
  '-Necessidade de controle sintomático e orientação sobre sinais de alarme.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não tratar apenas com anti-histamínico se houver dificuldade respiratória, edema de glote ou hipotensão: aplicar adrenalina intramuscular.\n'
  '-Não postergar adrenalina em anafilaxia: ela é a primeira medida, antes de corticoide e anti-histamínico.\n'
  '-Não ignorar lesões que duram mais de 24 horas no mesmo local, deixam mancha ou doem: podem indicar vasculite urticariforme.\n'
  '-Não manter corticoide sistêmico de forma prolongada.\n'
  '-Não ignorar angioedema sem urticária em uso de inibidor da enzima conversora de angiotensina.',
 'conduta_procedimento':
  '-Avaliar imediatamente via aérea, respiração, circulação e presença de angioedema.\n'
  '-Aplicar adrenalina intramuscular sem demora se houver critério de anafilaxia.\n'
  '-Caracterizar duração das lesões, prurido, gatilhos, medicamentos, alimentos e infecções recentes.\n'
  '-Revisar uso de anti-inflamatórios, antibióticos e inibidores da enzima conversora de angiotensina.\n'
  '-Prescrever anti-histamínico de segunda geração em dose regular, com possibilidade de escalonamento.\n'
  '-Reservar corticoide oral por curto período para casos intensos.\n'
  '-Orientar sinais de alarme e retorno imediato diante de dispneia ou edema de face.\n'
  '-Reavaliar em 1 a 2 semanas; investigar causa se o quadro persistir além de 6 semanas.',
 'sinais_alerta': ANAFILAXIA + '\n-Lesões fixas por mais de 24 horas\n-Lesões dolorosas ou que deixam mancha\n-Febre com artralgia',
 'criterios_encaminhamento':
  '-Encaminhar à emergência imediatamente em anafilaxia ou angioedema de via aérea.\n'
  '-Encaminhar à alergia e imunologia em urticária crônica ou refratária ao anti-histamínico.\n'
  '-Encaminhar para investigação de vasculite se as lesões forem fixas, dolorosas ou deixarem mancha.\n'
  '-Encaminhar se houver angioedema recorrente sem urticária.\n'
  '-Reavaliar em 1 a 2 semanas.',
 'observacoes_clinicas':
  '-Adrenalina intramuscular é a primeira medida na anafilaxia, antes de corticoide e anti-histamínico.\n'
  '-Lesão urticariforme que dura mais de 24 horas no mesmo local não é urticária comum.\n'
  '-Angioedema sem urticária em uso de inibidor da enzima conversora de angiotensina exige suspensão do medicamento.',
},

'URTICÁRIA — CRIANÇA': {
 'especialidade': ['Pediatria', 'Alergia e Imunologia', 'Medicina de Emergência', 'APS'],
 'contexto': CC, 'nivel_risco': ['Moderado', 'Alto'],
 'resumo_clinico':
  '-Urticária é frequente na infância e, na maioria das vezes, desencadeada por infecção viral.\n'
  '-Cursa com placas pruriginosas fugazes, que mudam de lugar e podem vir com angioedema.\n'
  '-O tratamento de base é anti-histamínico, com doses ajustadas ao peso.\n'
  '-Anafilaxia exige adrenalina intramuscular imediata, independentemente da idade.\n'
  '-Alimento e medicamento são gatilhos importantes a investigar quando há relação temporal clara.',
 'quando_usar':
  '-Criança com lesões urticariformes pruriginosas, sem sinais de anafilaxia.\n'
  '-Necessidade de controle sintomático e orientação familiar.\n'
  '-Uso em APS, ambulatório e pronto atendimento pediátrico.',
 'quando_nao_usar':
  '-Não postergar adrenalina intramuscular diante de dificuldade respiratória, edema de glote, vômitos com urticária ou hipotensão.\n'
  '-Não usar dose de adulto: calcular por peso.\n'
  '-Não manter corticoide sistêmico prolongado.\n'
  '-Não indicar dieta restritiva ampla sem investigação adequada.\n'
  '-Não ignorar lesões fixas, dolorosas ou com febre e artralgia.',
 'conduta_procedimento':
  '-Avaliar imediatamente via aérea, respiração, circulação e presença de angioedema.\n'
  '-Aplicar adrenalina intramuscular sem demora se houver critério de anafilaxia.\n'
  '-Caracterizar duração das lesões, prurido e relação temporal com alimento, medicamento ou infecção.\n'
  '-Conferir peso para cálculo das doses.\n'
  '-Prescrever anti-histamínico em dose adequada à idade e ao peso.\n'
  '-Reservar corticoide por curto período em casos intensos.\n'
  '-Orientar a família sobre sinais de alarme e retorno imediato.\n'
  '-Reavaliar em 1 a 2 semanas; encaminhar se persistir além de 6 semanas.',
 'sinais_alerta': ANAFILAXIA + '\n-Prostração\n-Sonolência\n-Palidez\n-Lesões fixas com febre e artralgia',
 'criterios_encaminhamento':
  '-Encaminhar à emergência imediatamente em anafilaxia ou angioedema de via aérea.\n'
  '-Encaminhar à alergia pediátrica em urticária crônica, recorrente ou com gatilho alimentar suspeito.\n'
  '-Encaminhar para investigação se houver lesões fixas com febre e artralgia.\n'
  '-Reavaliar em 1 a 2 semanas.',
 'observacoes_clinicas':
  '-Infecção viral é o gatilho mais comum de urticária aguda na infância.\n'
  '-Adrenalina intramuscular é a primeira medida na anafilaxia, sem exceção.\n'
  '-Restrições alimentares amplas sem investigação prejudicam a nutrição da criança.',
},

'DERMATITE DE CONTATO / REAÇÃO ALÉRGICA LEVE — ADULTO': {
 'especialidade': ['Dermatologia', 'Alergia e Imunologia', 'Clínica Médica', 'APS'],
 'contexto': CP, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Reação inflamatória cutânea por contato com irritante ou alérgeno, com eritema, prurido, vesículas e descamação.\n'
  '-A forma irritativa surge rapidamente após exposição; a alérgica exige sensibilização prévia e aparece em 24 a 72 horas.\n'
  '-A distribuição das lesões costuma sugerir o agente causal.\n'
  '-O tratamento combina afastamento do agente, corticoide tópico e anti-histamínico para o prurido.\n'
  '-Reação sistêmica com dispneia ou edema de glote configura anafilaxia e muda completamente a conduta.',
 'quando_usar':
  '-Adulto com lesões eczematosas pruriginosas em área de contato, sem sinais sistêmicos.\n'
  '-Reação alérgica cutânea leve, sem comprometimento respiratório ou hemodinâmico.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não tratar como reação leve se houver dispneia, edema de glote, hipotensão ou vômitos: tratar como anafilaxia.\n'
  '-Não usar corticoide tópico potente na face, dobras ou genitália por período prolongado.\n'
  '-Não ignorar sinais de infecção secundária, com crostas melicéricas e secreção.\n'
  '-Não ignorar lesões extensas com descolamento cutâneo ou acometimento de mucosas: suspeitar de reação grave a medicamento.\n'
  '-Não manter o contato com o agente suspeito durante o tratamento.',
 'conduta_procedimento':
  '-Avaliar via aérea, respiração e circulação para excluir reação sistêmica grave.\n'
  '-Caracterizar distribuição das lesões e correlacionar com exposições recentes.\n'
  '-Investigar cosméticos, produtos de limpeza, metais, plantas, medicamentos tópicos e exposição ocupacional.\n'
  '-Afastar o agente suspeito e orientar barreira ou proteção quando a exposição for inevitável.\n'
  '-Prescrever corticoide tópico de potência adequada à região e por período limitado.\n'
  '-Associar anti-histamínico para controle do prurido.\n'
  '-Tratar infecção secundária quando presente.\n'
  '-Reavaliar em 1 a 2 semanas; considerar teste de contato se houver recorrência.',
 'sinais_alerta':
  '-Dispneia\n-Edema de lábios, língua ou glote\n-Hipotensão\n-Lesões extensas com descolamento cutâneo\n'
  '-Acometimento de mucosas\n-Febre com exantema após novo medicamento\n-Infecção secundária extensa\n'
  '-Acometimento periorbitário importante\n-Dor cutânea desproporcional',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em reação sistêmica, descolamento cutâneo ou acometimento de mucosas.\n'
  '-Encaminhar à dermatologia em quadro recorrente, extenso ou refratário, para teste de contato.\n'
  '-Encaminhar à alergia se houver suspeita de alergia medicamentosa relevante.\n'
  '-Reavaliar em 1 a 2 semanas.',
 'observacoes_clinicas':
  '-Identificar e afastar o agente é o que resolve; o corticoide apenas controla a inflamação.\n'
  '-A distribuição das lesões é a principal pista do agente causal.\n'
  '-Exantema com febre e acometimento de mucosas após medicamento é sinal de reação grave.',
},

'PICADA DE INSETO COM REAÇÃO LOCAL — ADULTO': {
 'especialidade': ALERG, 'contexto': CP, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Reação inflamatória local após picada de inseto, com pápula, eritema, edema, calor e prurido.\n'
  '-A reação local extensa pode ultrapassar 10 cm e durar dias, sem indicar necessariamente alergia sistêmica.\n'
  '-A principal complicação é infecção bacteriana secundária por coçadura.\n'
  '-Reação sistêmica com urticária generalizada, dispneia ou hipotensão configura anafilaxia.\n'
  '-Ferroada de abelha exige remoção do ferrão o mais rápido possível.',
 'quando_usar':
  '-Adulto com reação local após picada, sem sinais sistêmicos.\n'
  '-Necessidade de controle de prurido, dor e edema.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não tratar como reação local se houver urticária generalizada, dispneia, edema de glote ou hipotensão: aplicar adrenalina intramuscular.\n'
  '-Não ignorar sinais de celulite: dor progressiva, eritema em expansão, febre e linfangite.\n'
  '-Não ignorar múltiplas ferroadas, que podem causar toxicidade sistêmica.\n'
  '-Não ignorar picadas em face, pescoço ou boca, pelo risco de obstrução de via aérea.\n'
  '-Não manter corticoide sistêmico de forma prolongada.',
 'conduta_procedimento':
  '-Avaliar via aérea, respiração e circulação; procurar sinais de reação sistêmica.\n'
  '-Remover o ferrão quando presente, o mais rápido possível.\n'
  '-Caracterizar número de picadas, local e tempo de evolução.\n'
  '-Aplicar compressa fria e elevar o membro acometido.\n'
  '-Prescrever anti-histamínico para o prurido e analgesia conforme necessidade.\n'
  '-Considerar corticoide por curto período em reação local extensa.\n'
  '-Delimitar o eritema e orientar retorno se houver progressão, febre ou dor crescente.\n'
  '-Avaliar situação vacinal antitetânica quando houver ferimento.',
 'sinais_alerta': ANAFILAXIA + '\n-Picada em face, pescoço ou boca\n-Múltiplas ferroadas\n-Eritema em expansão com febre\n-Linfangite\n-Necrose local',
 'criterios_encaminhamento':
  '-Encaminhar à emergência imediatamente em reação sistêmica ou múltiplas ferroadas.\n'
  '-Encaminhar à emergência em picada de via aérea superior com edema.\n'
  '-Encaminhar se houver celulite extensa, febre ou necrose local.\n'
  '-Encaminhar à alergia se houver história de reação sistêmica prévia, para avaliação e prescrição de adrenalina autoinjetável.',
 'observacoes_clinicas':
  '-Reação local extensa não significa, por si só, risco de anafilaxia futura.\n'
  '-História prévia de reação sistêmica muda o risco e justifica avaliação especializada.\n'
  '-Infecção secundária por coçadura é a complicação mais comum.',
},

'ESCORIAÇÕES / FERIDAS LEVES — ADULTO': {
 'especialidade': ['Cirurgia Geral', 'Medicina de Emergência', 'Clínica Médica', 'APS'],
 'contexto': CP, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Lesões cutâneas superficiais por atrito ou trauma leve, com perda parcial da epiderme.\n'
  '-A limpeza adequada com soro fisiológico e a remoção de corpos estranhos são as etapas mais importantes.\n'
  '-A cobertura mantém o meio úmido e favorece a cicatrização.\n'
  '-A avaliação da situação vacinal antitetânica é obrigatória em qualquer ferimento.\n'
  '-Antibiótico sistêmico não é indicado de rotina em ferida limpa e superficial.',
 'quando_usar':
  '-Adulto com escoriação ou ferida superficial limpa, sem perda tecidual extensa.\n'
  '-Ausência de sinais de infecção ou comprometimento profundo.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não manejar como ferida leve se houver lesão profunda, exposição de tendão, osso ou articulação.\n'
  '-Não ignorar sangramento ativo importante ou déficit neurovascular distal.\n'
  '-Não deixar de avaliar a situação vacinal antitetânica.\n'
  '-Não usar antibiótico sistêmico de rotina em ferida limpa.\n'
  '-Não ignorar mordeduras, que têm risco infeccioso específico e conduta própria.',
 'conduta_procedimento':
  '-Avaliar mecanismo do trauma, profundidade, extensão e presença de corpo estranho.\n'
  '-Verificar perfusão, sensibilidade e movimento distais à lesão.\n'
  '-Realizar limpeza abundante com soro fisiológico e remover corpos estranhos.\n'
  '-Avaliar necessidade de sutura ou de encaminhamento cirúrgico.\n'
  '-Aplicar cobertura adequada e orientar trocas conforme o tipo de curativo.\n'
  '-Avaliar e atualizar a vacinação antitetânica conforme protocolo.\n'
  '-Prescrever analgesia conforme necessidade.\n'
  '-Orientar sinais de infecção e retornar em 48 a 72 horas se houver piora.',
 'sinais_alerta':
  '-Exposição de tendão, osso ou articulação\n-Sangramento ativo importante\n-Déficit neurovascular distal\n'
  '-Corpo estranho não removível\n-Mordedura\n-Ferida muito contaminada\n-Eritema em expansão\n'
  '-Secreção purulenta\n-Febre\n-Diabetes ou imunossupressão\n-Vacinação antitetânica desatualizada',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em ferida profunda, sangramento importante ou déficit neurovascular.\n'
  '-Encaminhar à cirurgia se houver corpo estranho não removível ou necessidade de exploração.\n'
  '-Encaminhar se houver sinais de infecção que não respondem ao tratamento local.\n'
  '-Reavaliar em 48 a 72 horas.',
 'observacoes_clinicas':
  '-Limpeza adequada é mais importante que antisséptico ou antibiótico tópico.\n'
  '-A avaliação antitetânica é obrigatória em todo ferimento.\n'
  '-Meio úmido favorece a cicatrização; ressecar a ferida atrasa o processo.',
},

'QUEIMADURA SOLAR LEVE — ADULTO': {
 'especialidade': ['Dermatologia', 'Clínica Médica', 'Medicina de Emergência', 'APS'],
 'contexto': CP, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Queimadura de primeiro grau ou segundo grau superficial causada por radiação ultravioleta.\n'
  '-Cursa com eritema, dor, calor e, em casos mais intensos, bolhas superficiais.\n'
  '-O tratamento é sintomático: resfriamento, hidratação da pele, analgesia e proteção solar.\n'
  '-Queimadura extensa pode cursar com desidratação e sintomas sistêmicos.\n'
  '-Exposição solar cumulativa aumenta risco de câncer de pele e justifica orientação preventiva.',
 'quando_usar':
  '-Adulto com eritema doloroso após exposição solar, com ou sem bolhas pequenas.\n'
  '-Área acometida limitada, sem sinais sistêmicos.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente se a área acometida for extensa ou houver sinais sistêmicos.\n'
  '-Não tratar como queimadura leve se houver bolhas extensas, pele acinzentada ou perda de sensibilidade.\n'
  '-Não romper bolhas intencionalmente.\n'
  '-Não usar produtos caseiros oclusivos como manteiga ou pasta de dente.\n'
  '-Não ignorar desidratação, febre, confusão ou hipotensão.',
 'conduta_procedimento':
  '-Estimar a superfície corporal acometida e a profundidade da queimadura.\n'
  '-Avaliar sinais vitais, hidratação e sintomas sistêmicos.\n'
  '-Resfriar a área com água em temperatura ambiente ou compressa fria, sem gelo direto.\n'
  '-Hidratar a pele e usar cobertura adequada quando houver bolhas rompidas.\n'
  '-Prescrever analgesia; considerar anti-inflamatório respeitando contraindicações.\n'
  '-Orientar hidratação oral abundante.\n'
  '-Orientar fotoproteção e evitar nova exposição até a recuperação.\n'
  '-Reavaliar se houver piora, sinais de infecção ou febre.',
 'sinais_alerta':
  '-Queimadura extensa\n-Bolhas extensas\n-Pele acinzentada ou esbranquiçada\n-Perda de sensibilidade local\n'
  '-Febre\n-Calafrios\n-Confusão\n-Hipotensão\n-Desidratação\n-Vômitos\n'
  '-Acometimento de face, mãos, pés ou genitália\n-Sinais de infecção',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em queimadura extensa, sinais sistêmicos ou desidratação.\n'
  '-Encaminhar se houver acometimento importante de face, mãos, pés ou genitália.\n'
  '-Encaminhar a centro de queimados conforme extensão e profundidade.\n'
  '-Encaminhar se houver sinais de infecção secundária.',
 'observacoes_clinicas':
  '-Não romper bolhas: elas funcionam como barreira biológica.\n'
  '-Produtos caseiros oclusivos aumentam risco de infecção e dificultam a avaliação.\n'
  '-Orientação de fotoproteção é parte do atendimento, não apenas conselho geral.',
},

'PROFILAXIA ANTITETÂNICA EM FERIMENTOS — ADULTO': {
 'especialidade': ['Infectologia', 'Medicina de Emergência', 'Clínica Médica', 'APS'],
 'contexto': CP, 'nivel_risco': ['Moderado', 'Alto'],
 'resumo_clinico':
  '-O tétano é doença grave e evitável, causada pela toxina do Clostridium tetani em ferimentos contaminados.\n'
  '-A conduta depende de dois fatores: o tipo de ferimento e o histórico vacinal do paciente.\n'
  '-Ferimentos profundos, sujos, com terra, fezes, tecido necrótico ou corpo estranho são considerados de risco.\n'
  '-A limpeza e o desbridamento do ferimento são tão importantes quanto a imunização.\n'
  '-A imunoglobulina antitetânica é indicada em ferimento de risco com esquema vacinal incompleto ou desconhecido.',
 'quando_usar':
  '-Adulto com qualquer ferimento, para avaliação da necessidade de vacina e imunoglobulina.\n'
  '-Ferimento com terra, fezes, corpo estranho, mordedura ou tecido necrótico.\n'
  '-Uso em pronto atendimento, emergência e APS.',
 'quando_nao_usar':
  '-Não aplicar a conduta sem antes limpar e desbridar adequadamente o ferimento.\n'
  '-Não dispensar imunoglobulina em ferimento de risco com esquema incompleto ou desconhecido.\n'
  '-Não assumir esquema completo sem confirmação: na dúvida, considerar incompleto.\n'
  '-Não aplicar vacina e imunoglobulina no mesmo local anatômico.\n'
  '-Não ignorar sinais de tétano instalado: trismo, rigidez e espasmos exigem emergência.',
 'conduta_procedimento':
  '-Caracterizar o ferimento: profundidade, contaminação, tempo decorrido e presença de corpo estranho.\n'
  '-Classificar como ferimento de baixo risco ou de risco para tétano.\n'
  '-Confirmar histórico vacinal: número de doses e data da última.\n'
  '-Realizar limpeza abundante com soro fisiológico e desbridar tecido desvitalizado.\n'
  '-Indicar vacina dupla adulto conforme o esquema e o tempo desde a última dose.\n'
  '-Indicar imunoglobulina antitetânica em ferimento de risco com esquema incompleto ou desconhecido.\n'
  '-Aplicar vacina e imunoglobulina em locais anatômicos diferentes.\n'
  '-Encaminhar à unidade básica para completar o esquema vacinal e registrar no cartão.',
 'sinais_alerta':
  '-Trismo\n-Rigidez de nuca\n-Espasmos musculares\n-Disfagia\n-Riso sardônico\n-Opistótono\n'
  '-Ferimento profundo muito contaminado\n-Tecido necrótico extenso\n-Corpo estranho retido\n'
  '-Mordedura\n-Esquema vacinal desconhecido\n-Imunossupressão',
 'criterios_encaminhamento':
  '-Encaminhar imediatamente à emergência em qualquer suspeita de tétano instalado.\n'
  '-Encaminhar à cirurgia se houver necessidade de desbridamento amplo ou remoção de corpo estranho.\n'
  '-Encaminhar à unidade básica para completar o esquema vacinal.\n'
  '-Encaminhar se houver ferimento de risco em paciente imunossuprimido.',
 'observacoes_clinicas':
  '-A conduta depende sempre da combinação entre tipo de ferimento e histórico vacinal.\n'
  '-Limpeza e desbridamento reduzem a carga bacteriana e são parte essencial da profilaxia.\n'
  '-Na dúvida sobre o esquema vacinal, considerar como incompleto.\n'
  '-Vacina e imunoglobulina devem ser aplicadas em locais diferentes.',
},

'ONICOMICOSE — ADULTO': {
 'especialidade': ['Dermatologia', 'Clínica Médica', 'APS'],
 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Infecção fúngica das unhas, com espessamento, alteração de cor, fragilidade e descolamento do leito.\n'
  '-É mais comum nos pés e frequentemente associada a dermatofitose interdigital.\n'
  '-O tratamento sistêmico é prolongado, de meses, e exige adesão e monitoramento.\n'
  '-A confirmação micológica é recomendada antes de iniciar tratamento oral prolongado.\n'
  '-Terbinafina e itraconazol têm interações e potencial hepatotóxico que exigem avaliação prévia.',
 'quando_usar':
  '-Adulto com alteração ungueal compatível, com impacto estético, funcional ou risco associado.\n'
  '-Paciente com condições que aumentam o risco de complicação, como diabetes.\n'
  '-Uso em APS e ambulatório.',
 'quando_nao_usar':
  '-Não iniciar antifúngico oral prolongado sem confirmação diagnóstica quando o exame estiver disponível.\n'
  '-Não iniciar sem revisar interações medicamentosas e função hepática.\n'
  '-Não usar itraconazol em insuficiência cardíaca.\n'
  '-Não ignorar lesão ungueal isolada, escurecida e progressiva, que exige afastar melanoma subungueal.\n'
  '-Não esperar melhora rápida: a unha cresce lentamente e o resultado leva meses.',
 'conduta_procedimento':
  '-Caracterizar unhas acometidas, extensão e tempo de evolução.\n'
  '-Examinar espaços interdigitais e plantas, procurando dermatofitose associada.\n'
  '-Coletar material para exame micológico quando disponível.\n'
  '-Revisar medicamentos em uso e avaliar função hepática antes do tratamento sistêmico.\n'
  '-Considerar tratamento tópico em acometimento limitado e sistêmico em doença extensa.\n'
  '-Tratar a dermatofitose interdigital associada para reduzir recidiva.\n'
  '-Orientar secagem dos pés, calçados ventilados e não compartilhar alicates.\n'
  '-Reavaliar em 3 meses e monitorar conforme o esquema escolhido.',
 'sinais_alerta':
  '-Lesão ungueal isolada escurecida e progressiva\n-Sangramento subungueal sem trauma\n'
  '-Distrofia ungueal com dor importante\n-Celulite periungueal\n-Diabetes com neuropatia\n'
  '-Imunossupressão\n-Hepatopatia\n-Insuficiência cardíaca\n-Uso de múltiplos medicamentos com interação',
 'criterios_encaminhamento':
  '-Encaminhar com urgência à dermatologia em lesão ungueal escurecida e progressiva, para afastar melanoma.\n'
  '-Encaminhar à dermatologia em falha terapêutica, doença extensa ou dúvida diagnóstica.\n'
  '-Encaminhar diabético com neuropatia e alteração ungueal para avaliação de pé em risco.\n'
  '-Encaminhar se houver hepatopatia ou interações que contraindiquem o tratamento habitual.\n'
  '-Reavaliar em 3 meses.',
 'observacoes_clinicas':
  '-O tratamento é longo e a melhora só aparece com o crescimento da unha.\n'
  '-Tratar a micose interdigital associada reduz a recidiva.\n'
  '-Lesão ungueal pigmentada progressiva exige afastar melanoma subungueal.',
},

'CINETOSE — ADULTO': {
 'especialidade': ['Clínica Médica', 'Otorrinolaringologia', 'APS', 'Medicina de Família'],
 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Conjunto de sintomas desencadeados pelo conflito entre estímulos visuais, vestibulares e proprioceptivos durante o movimento.\n'
  '-Cursa com náuseas, vômitos, palidez, sudorese fria, tontura e mal-estar durante viagens.\n'
  '-A profilaxia é mais eficaz que o tratamento após o início dos sintomas.\n'
  '-Anti-histamínicos são a base do tratamento e causam sonolência, com impacto na direção veicular.\n'
  '-Medidas comportamentais reduzem a intensidade dos sintomas.',
 'quando_usar':
  '-Adulto com história de sintomas durante viagens de carro, barco, ônibus ou avião.\n'
  '-Necessidade de profilaxia antes de deslocamento previsto.\n'
  '-Uso em APS e ambulatório.',
 'quando_nao_usar':
  '-Não atribuir à cinetose tontura que ocorre fora de contexto de movimento.\n'
  '-Não ignorar vertigem com hipoacusia, zumbido ou sinais neurológicos.\n'
  '-Não prescrever anti-histamínico sedativo a quem vai dirigir ou operar máquinas.\n'
  '-Não usar em paciente com glaucoma de ângulo fechado ou retenção urinária sem avaliação.\n'
  '-Não ignorar vômitos persistentes com desidratação.',
 'conduta_procedimento':
  '-Caracterizar os sintomas e sua relação temporal com o movimento.\n'
  '-Excluir causas vestibulares e neurológicas quando os sintomas ocorrerem fora do contexto de viagem.\n'
  '-Orientar profilaxia com antecedência adequada ao início da viagem.\n'
  '-Orientar medidas comportamentais: olhar o horizonte, sentar na frente, evitar leitura e ventilar o ambiente.\n'
  '-Alertar sobre sonolência e restrição para dirigir.\n'
  '-Orientar hidratação e refeições leves antes do deslocamento.\n'
  '-Reavaliar se os sintomas ocorrerem fora do contexto de movimento.',
 'sinais_alerta':
  '-Tontura fora do contexto de movimento\n-Hipoacusia\n-Zumbido\n-Déficit neurológico focal\n'
  '-Cefaleia intensa\n-Diplopia\n-Vômitos persistentes com desidratação\n-Síncope',
 'criterios_encaminhamento':
  '-Encaminhar para investigação se a tontura ocorrer fora do contexto de movimento.\n'
  '-Encaminhar com urgência se houver déficit neurológico, hipoacusia súbita ou cefaleia intensa.\n'
  '-Encaminhar à emergência em vômitos persistentes com desidratação.',
 'observacoes_clinicas':
  '-A profilaxia antes da viagem é mais eficaz que o tratamento após o início dos sintomas.\n'
  '-Anti-histamínicos sedativos contraindicam dirigir.\n'
  '-Medidas comportamentais simples reduzem bastante a intensidade dos sintomas.',
},

'ASMA / CRISE ASMÁTICA — CRIANÇA': {
 'especialidade': ['Pediatria', 'Pneumologia', 'Medicina de Emergência', 'APS'],
 'contexto': CC, 'nivel_risco': ['Moderado', 'Alto'],
 'resumo_clinico':
  '-Doença inflamatória crônica das vias aéreas, com episódios de sibilância, tosse, dispneia e opressão torácica.\n'
  '-A crise é tratada com broncodilatador de curta ação e corticoide sistêmico quando indicado.\n'
  '-A avaliação da gravidade usa esforço respiratório, saturação, fala e nível de consciência.\n'
  '-Doses são calculadas por peso e a técnica inalatória precisa ser verificada e ensinada.\n'
  '-Tórax silencioso, cianose e sonolência indicam crise grave com risco de parada respiratória.',
 'quando_usar':
  '-Criança com sibilância, tosse e dispneia de padrão asmático.\n'
  '-Crise leve a moderada, com boa resposta inicial ao broncodilatador.\n'
  '-Uso em APS, ambulatório e pronto atendimento pediátrico.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente se houver cianose, sonolência, tórax silencioso ou incapacidade de falar.\n'
  '-Não postergar broncodilatador e oxigênio em crise grave.\n'
  '-Não usar dose de adulto: calcular por peso.\n'
  '-Não liberar sem verificar a técnica inalatória e garantir plano de ação escrito.\n'
  '-Não atribuir toda sibilância a asma sem considerar corpo estranho, bronquiolite ou cardiopatia.',
 'conduta_procedimento':
  '-Avaliar frequência respiratória, saturação, tiragem, batimento de asa nasal, fala e nível de consciência.\n'
  '-Classificar a gravidade da crise antes de definir a conduta.\n'
  '-Administrar broncodilatador de curta ação, repetindo conforme resposta e protocolo.\n'
  '-Oferecer oxigênio se a saturação estiver reduzida.\n'
  '-Indicar corticoide sistêmico conforme gravidade, com dose calculada por peso.\n'
  '-Reavaliar após cada série de broncodilatador e documentar a resposta.\n'
  '-Ensinar e verificar a técnica inalatória, preferindo espaçador.\n'
  '-Fornecer plano de ação escrito, revisar adesão à manutenção e identificar gatilhos.\n'
  '-Programar reavaliação em 24 a 48 horas após a crise.',
 'sinais_alerta':
  '-Cianose\n-Sonolência ou confusão\n-Tórax silencioso\n-Incapacidade de falar frases\n'
  '-Saturação reduzida apesar do oxigênio\n-Tiragem intensa\n-Frequência respiratória muito elevada\n'
  '-Bradicardia\n-Exaustão\n-Ausência de resposta ao broncodilatador\n-Crise grave prévia com internação em UTI',
 'criterios_encaminhamento':
  '-Encaminhar à emergência imediatamente em cianose, sonolência, tórax silencioso ou incapacidade de falar.\n'
  '-Encaminhar se não houver resposta adequada após o tratamento inicial.\n'
  '-Encaminhar à pneumologia pediátrica em crises frequentes, internações de repetição ou controle inadequado.\n'
  '-Reavaliar em 24 a 48 horas após a crise.',
 'observacoes_clinicas':
  '-Tórax silencioso não significa melhora: indica pouca movimentação de ar e crise grave.\n'
  '-Espaçador melhora muito a eficácia do broncodilatador inalatório na criança.\n'
  '-A alta após crise exige plano de ação escrito e revisão da manutenção.',
},

'NÁUSEAS E VÔMITOS NA GESTAÇÃO — GESTANTE': {
 'especialidade': ['Obstetrícia', 'Ginecologia', 'Clínica Médica', 'APS'],
 'contexto': ['Adulto', 'APS', 'Ambulatorial', 'PS'],
 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Náuseas e vômitos são muito frequentes no primeiro trimestre e costumam melhorar após a 12ª a 16ª semana.\n'
  '-A forma leve a moderada é manejada com medidas dietéticas e antieméticos seguros na gestação.\n'
  '-A hiperêmese gravídica é a forma grave, com desidratação, perda de peso e distúrbio eletrolítico.\n'
  '-A segurança do medicamento na gestação é o critério central da escolha.\n'
  '-Vômitos que iniciam após o primeiro trimestre exigem investigar outras causas.',
 'quando_usar':
  '-Gestante com náuseas e vômitos no primeiro trimestre, sem sinais de desidratação.\n'
  '-Necessidade de controle sintomático com medicação segura.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente se houver desidratação, perda de peso importante, cetonúria ou distúrbio eletrolítico.\n'
  '-Não usar medicamento sem verificar a segurança na gestação.\n'
  '-Não atribuir à gestação vômitos que começam após o primeiro trimestre sem investigar outras causas.\n'
  '-Não ignorar dor abdominal intensa, febre, cefaleia ou alteração visual.\n'
  '-Não ignorar sinais de pré-eclâmpsia em gestação avançada.',
 'conduta_procedimento':
  '-Caracterizar frequência dos vômitos, aceitação alimentar, perda de peso e diurese.\n'
  '-Avaliar sinais vitais, hidratação, mucosas e peso comparado ao inicial.\n'
  '-Investigar outras causas quando o quadro começar após o primeiro trimestre.\n'
  '-Solicitar exames conforme necessidade, incluindo eletrólitos e cetonúria em casos moderados.\n'
  '-Orientar refeições fracionadas, evitar jejum prolongado e afastar odores desencadeantes.\n'
  '-Prescrever antiemético com perfil de segurança adequado à gestação.\n'
  '-Orientar hidratação oral fracionada e sinais de retorno.\n'
  '-Reavaliar em 48 a 72 horas ou antes se houver piora.',
 'sinais_alerta':
  '-Desidratação\n-Perda de peso importante\n-Incapacidade de ingerir líquidos\n-Cetonúria\n'
  '-Distúrbio eletrolítico\n-Taquicardia\n-Hipotensão\n-Vômitos iniciados após o primeiro trimestre\n'
  '-Dor abdominal intensa\n-Febre\n-Cefaleia com alteração visual\n-Icterícia',
 'criterios_encaminhamento':
  '-Encaminhar à emergência obstétrica em desidratação, perda de peso importante ou incapacidade de ingestão oral.\n'
  '-Encaminhar em suspeita de hiperêmese gravídica para hidratação venosa e reposição.\n'
  '-Encaminhar para investigação se os vômitos começarem após o primeiro trimestre.\n'
  '-Encaminhar com urgência em cefaleia com alteração visual ou dor abdominal intensa.\n'
  '-Reavaliar em 48 a 72 horas.',
 'observacoes_clinicas':
  '-A segurança do medicamento na gestação é o critério que orienta a escolha.\n'
  '-Vômitos de início após o primeiro trimestre não devem ser atribuídos automaticamente à gestação.\n'
  '-Refeições fracionadas e evitar jejum prolongado reduzem bastante os sintomas.',
},

'PRÉ-NATAL / SUPLEMENTAÇÃO — GESTANTE': {
 'especialidade': ['Obstetrícia', 'Ginecologia', 'APS', 'Medicina de Família'],
 'contexto': ['Adulto', 'APS', 'Ambulatorial'],
 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-A suplementação no pré-natal reduz desfechos adversos maternos e fetais.\n'
  '-O ácido fólico previne defeitos do tubo neural e é mais eficaz quando iniciado antes da concepção e mantido no primeiro trimestre.\n'
  '-O ferro previne e trata anemia gestacional, condição frequente e associada a desfechos adversos.\n'
  '-Doses maiores de ácido fólico são indicadas em situações específicas, como antecedente de defeito do tubo neural.\n'
  '-A suplementação complementa, mas não substitui, o acompanhamento pré-natal completo.',
 'quando_usar':
  '-Gestante em acompanhamento pré-natal, para suplementação de rotina.\n'
  '-Mulher planejando gestação, para início preconcepcional do ácido fólico.\n'
  '-Uso em APS e ambulatório.',
 'quando_nao_usar':
  '-Não substituir o acompanhamento pré-natal e seus exames pela suplementação isolada.\n'
  '-Não ignorar anemia importante, que exige investigação e tratamento específico.\n'
  '-Não manter dose padrão sem reavaliar em situações que exigem dose maior de ácido fólico.\n'
  '-Não ignorar intolerância gastrointestinal ao ferro que comprometa a adesão.\n'
  '-Não ignorar sinais de alerta obstétricos durante o acompanhamento.',
 'conduta_procedimento':
  '-Confirmar idade gestacional e revisar antecedentes obstétricos e comorbidades.\n'
  '-Verificar uso de medicamentos que aumentam a necessidade de ácido fólico.\n'
  '-Solicitar exames de rotina do pré-natal, incluindo hemograma.\n'
  '-Prescrever ácido fólico e ferro conforme protocolo e situação clínica.\n'
  '-Orientar administração do ferro longe de leite, café e chá, associando fonte de vitamina C.\n'
  '-Explicar efeitos esperados do ferro: escurecimento das fezes e constipação.\n'
  '-Orientar alimentação adequada e sinais de alerta obstétricos.\n'
  '-Reavaliar adesão e hemograma conforme o cronograma do pré-natal.',
 'sinais_alerta':
  '-Palidez importante\n-Dispneia aos esforços\n-Taquicardia\n-Sangramento vaginal\n'
  '-Dor abdominal intensa\n-Cefaleia com alteração visual\n-Edema súbito de face e mãos\n'
  '-Redução dos movimentos fetais\n-Febre\n-Perda de líquido vaginal',
 'criterios_encaminhamento':
  '-Encaminhar à emergência obstétrica em sangramento, dor abdominal intensa, cefaleia com alteração visual ou perda de líquido.\n'
  '-Encaminhar ao pré-natal de alto risco conforme comorbidades e antecedentes.\n'
  '-Encaminhar para investigação se houver anemia que não responde à reposição.\n'
  '-Manter acompanhamento conforme o cronograma do pré-natal.',
 'observacoes_clinicas':
  '-O ácido fólico tem maior benefício quando iniciado antes da concepção.\n'
  '-Antecedente de defeito do tubo neural exige dose maior, definida no pré-natal.\n'
  '-Orientar a tomada correta do ferro melhora a adesão e a absorção.',
},
}

if __name__ == '__main__':
    executar(CLINICOS)

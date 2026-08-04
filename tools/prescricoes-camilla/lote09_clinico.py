# -*- coding: utf-8 -*-
"""Lote 09 — urologia, vascular, ORL/otologia e pediatria."""
from create_new import executar

C = ['Adulto', 'APS', 'Ambulatorial']
CP = ['Adulto', 'APS', 'Ambulatorial', 'PS']
CC = ['Pediatria', 'APS', 'Ambulatorial']

CLINICOS = {
'INFECÇÃO URINÁRIA (ITU) — ADULTO': {
 'especialidade': ['Urologia', 'Infectologia', 'Clínica Médica', 'APS'],
 'contexto': CP, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Infecção do trato urinário, mais frequentemente por Escherichia coli.\n'
  '-A cistite cursa com disúria, polaciúria, urgência e desconforto suprapúbico, sem febre alta.\n'
  '-Febre, calafrios, dor lombar e Giordano positivo indicam pielonefrite, que muda a conduta.\n'
  '-A escolha do antibiótico considera o perfil local de resistência, gestação e função renal.\n'
  '-ITU em homem, gestante ou com sonda tem manejo diferente e limiar menor para investigação.',
 'quando_usar':
  '-Adulto com sintomas urinários baixos compatíveis com cistite.\n'
  '-Paciente estável, sem febre alta, sem dor lombar e sem vômitos.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não tratar como cistite simples se houver febre, calafrios, dor lombar, Giordano positivo ou vômitos: manejar como pielonefrite.\n'
  '-Não manejar ambulatorialmente se houver hipotensão, taquicardia, confusão ou sinais de sepse.\n'
  '-Não usar esquema curto em homem, gestante, paciente com sonda ou anormalidade do trato urinário.\n'
  '-Não tratar bacteriúria assintomática fora das exceções (gestação e alguns procedimentos urológicos).\n'
  '-Não ignorar cálculo ou obstrução associados, que exigem desobstrução.',
 'conduta_procedimento':
  '-Caracterizar disúria, polaciúria, urgência, hematúria, dor lombar e febre.\n'
  '-Aferir sinais vitais e pesquisar Giordano.\n'
  '-Excluir gestação em mulher em idade fértil quando pertinente.\n'
  '-Solicitar urina tipo 1 e urocultura conforme indicação, especialmente em falha, recorrência, homem ou gestante.\n'
  '-Escolher antibiótico conforme perfil local de resistência, função renal e gestação.\n'
  '-Prescrever analgesia urinária quando houver disúria intensa.\n'
  '-Orientar hidratação e sinais de retorno.\n'
  '-Reavaliar em 48 a 72 horas se não houver melhora; investigar recorrência.',
 'sinais_alerta':
  '-Febre alta\n-Calafrios\n-Dor lombar\n-Giordano positivo\n-Vômitos\n-Hipotensão\n-Taquicardia\n'
  '-Confusão mental\n-Gestação\n-Sonda vesical\n-Cálculo ou obstrução conhecida\n-Imunossupressão\n'
  '-Falha após 48 a 72 horas de antibiótico',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em suspeita de pielonefrite com vômitos, instabilidade ou sinais de sepse.\n'
  '-Encaminhar com urgência se houver suspeita de obstrução urinária associada à infecção.\n'
  '-Encaminhar gestante para manejo obstétrico.\n'
  '-Encaminhar à urologia em ITU de repetição, ITU em homem ou anormalidade do trato urinário.\n'
  '-Reavaliar em 48 a 72 horas.',
 'observacoes_clinicas':
  '-Febre com dor lombar muda o diagnóstico de cistite para pielonefrite e o esquema terapêutico.\n'
  '-Bacteriúria assintomática só é tratada em situações específicas, como gestação.\n'
  '-ITU em homem exige investigação de fator complicador.',
},

'HIPERPLASIA PROSTÁTICA BENIGNA — ADULTO': {
 'especialidade': ['Urologia', 'Clínica Médica', 'APS', 'Medicina de Família'],
 'contexto': C, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Aumento benigno da próstata que causa sintomas do trato urinário inferior em homens acima dos 50 anos.\n'
  '-Cursa com jato fraco, hesitação, esvaziamento incompleto, noctúria e urgência.\n'
  '-Alfabloqueadores aliviam sintomas rapidamente; inibidores da 5-alfa-redutase reduzem o volume prostático ao longo de meses.\n'
  '-Retenção urinária aguda, hematúria significativa e insuficiência renal pós-renal são complicações relevantes.\n'
  '-O rastreio de câncer de próstata é discussão separada e deve ser individualizada.',
 'quando_usar':
  '-Homem com sintomas do trato urinário inferior compatíveis, sem sinais de complicação.\n'
  '-Necessidade de tratamento sintomático e acompanhamento.\n'
  '-Uso em APS e ambulatório.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente se houver retenção urinária aguda, que exige desobstrução.\n'
  '-Não ignorar hematúria macroscópica, que exige investigação.\n'
  '-Não ignorar creatinina elevada ou hidronefrose, que sugerem obstrução com repercussão renal.\n'
  '-Não iniciar alfabloqueador sem alertar sobre hipotensão postural, sobretudo em idoso.\n'
  '-Não ignorar sintomas irritativos com dor e febre, que sugerem prostatite ou infecção.',
 'conduta_procedimento':
  '-Caracterizar sintomas obstrutivos e irritativos e o impacto na qualidade de vida.\n'
  '-Realizar exame físico com toque retal conforme avaliação.\n'
  '-Solicitar urina tipo 1, creatinina e discutir PSA de forma individualizada.\n'
  '-Avaliar resíduo pós-miccional e ultrassom conforme disponibilidade e indicação.\n'
  '-Revisar medicamentos que pioram o esvaziamento, como anticolinérgicos e descongestionantes.\n'
  '-Iniciar alfabloqueador para alívio sintomático; considerar inibidor da 5-alfa-redutase se próstata volumosa.\n'
  '-Orientar sobre hipotensão postural e sobre a demora de meses para efeito do inibidor da 5-alfa-redutase.\n'
  '-Reavaliar em 4 a 12 semanas.',
 'sinais_alerta':
  '-Retenção urinária aguda\n-Hematúria macroscópica\n-Creatinina elevada\n-Hidronefrose\n'
  '-Infecção urinária de repetição\n-Cálculo vesical\n-Perda de peso\n-Dor óssea\n'
  '-Nódulo endurecido ao toque retal\n-Febre com dor perineal',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em retenção urinária aguda.\n'
  '-Encaminhar à urologia em hematúria, retenção recorrente, cálculo vesical, insuficiência renal pós-renal ou falha do tratamento clínico.\n'
  '-Encaminhar se houver nódulo prostático suspeito ao toque retal.\n'
  '-Reavaliar em 4 a 12 semanas.',
 'observacoes_clinicas':
  '-Alfabloqueador alivia sintomas em dias; inibidor da 5-alfa-redutase leva meses e reduz o volume prostático.\n'
  '-Hipotensão postural é efeito adverso relevante em idosos.\n'
  '-Anticolinérgicos e descongestionantes podem precipitar retenção urinária.',
},

'INSUFICIÊNCIA VENOSA CRÔNICA — ADULTO': {
 'especialidade': ['Angiologia', 'Cirurgia Vascular', 'Clínica Médica', 'APS'],
 'contexto': C, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Disfunção do retorno venoso dos membros inferiores, com hipertensão venosa crônica.\n'
  '-Cursa com peso, dor, edema vespertino, telangiectasias, varizes, hiperpigmentação e, em fases avançadas, úlcera venosa.\n'
  '-A compressão elástica é o pilar do tratamento e melhora sintomas e cicatrização.\n'
  '-A compressão exige avaliação da perfusão arterial antes de ser indicada.\n'
  '-Medidas de elevação, exercício e controle de peso complementam o tratamento.',
 'quando_usar':
  '-Adulto com sintomas de estase venosa, varizes ou alterações tróficas de membros inferiores.\n'
  '-Indicação de terapia compressiva e medidas comportamentais.\n'
  '-Uso em APS e ambulatório.',
 'quando_nao_usar':
  '-Não indicar compressão sem avaliar perfusão arterial: em doença arterial periférica significativa ela é contraindicada.\n'
  '-Não tratar como insuficiência venosa edema unilateral agudo com dor e empastamento: avaliar trombose venosa profunda.\n'
  '-Não ignorar úlcera com sinais de infecção, celulite ou piora rápida.\n'
  '-Não ignorar edema bilateral com dispneia ou ortopneia, que sugere causa cardíaca, renal ou hepática.',
 'conduta_procedimento':
  '-Caracterizar sintomas, padrão do edema e evolução ao longo do dia.\n'
  '-Examinar pulsos periféricos, pele, presença de varizes, hiperpigmentação e úlceras.\n'
  '-Avaliar índice tornozelo-braço ou perfusão arterial antes de indicar compressão.\n'
  '-Excluir trombose venosa profunda em edema unilateral agudo e doloroso.\n'
  '-Indicar meia de compressão com grau adequado e orientar colocação pela manhã.\n'
  '-Orientar elevação dos membros, caminhada, controle de peso e cuidados com a pele.\n'
  '-Tratar dermatite de estase e úlcera conforme necessário.\n'
  '-Reavaliar em 4 a 8 semanas.',
 'sinais_alerta':
  '-Edema unilateral agudo com dor\n-Empastamento de panturrilha\n-Úlcera com secreção purulenta\n'
  '-Celulite\n-Febre\n-Dor isquêmica em repouso\n-Ausência de pulsos periféricos\n'
  '-Palidez ou cianose de extremidade\n-Dispneia ou ortopneia associadas\n-Úlcera que não cicatriza',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em suspeita de trombose venosa profunda ou isquemia arterial aguda.\n'
  '-Encaminhar à cirurgia vascular ou angiologia em varizes sintomáticas, úlcera venosa ou doença arterial associada.\n'
  '-Encaminhar se a úlcera não cicatrizar com tratamento adequado.\n'
  '-Reavaliar em 4 a 8 semanas.',
 'observacoes_clinicas':
  '-Compressão é o pilar do tratamento, mas exige avaliação arterial prévia.\n'
  '-Edema unilateral agudo e doloroso deve fazer pensar em trombose venosa profunda, não em estase crônica.\n'
  '-Adesão à meia elástica é o principal determinante do resultado.',
},

'VARIZES DOS MEMBROS INFERIORES — ADULTO': {
 'especialidade': ['Angiologia', 'Cirurgia Vascular', 'Clínica Médica', 'APS'],
 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Dilatação e tortuosidade das veias superficiais dos membros inferiores, decorrentes de refluxo venoso.\n'
  '-Cursa com peso, dor, cansaço e edema vespertino, com piora ao final do dia e em ortostatismo prolongado.\n'
  '-O tratamento conservador combina compressão elástica, elevação, exercício e controle de peso.\n'
  '-Flebotônicos podem aliviar sintomas, mas não corrigem o refluxo.\n'
  '-Complicações incluem varicoflebite, sangramento de variz e úlcera venosa.',
 'quando_usar':
  '-Adulto com varizes sintomáticas de membros inferiores, sem complicação aguda.\n'
  '-Indicação de tratamento conservador e orientação.\n'
  '-Uso em APS e ambulatório.',
 'quando_nao_usar':
  '-Não indicar compressão sem avaliar perfusão arterial.\n'
  '-Não tratar como varizes simples edema unilateral agudo com dor: avaliar trombose venosa profunda.\n'
  '-Não ignorar cordão endurecido, doloroso e eritematoso, que sugere varicoflebite.\n'
  '-Não ignorar sangramento de variz, que exige compressão imediata e elevação.\n'
  '-Não postergar avaliação vascular quando houver úlcera ou alterações tróficas.',
 'conduta_procedimento':
  '-Caracterizar sintomas, tempo de evolução e fatores de piora.\n'
  '-Examinar em ortostatismo, avaliando trajetos varicosos, edema, pele e pulsos.\n'
  '-Excluir trombose venosa profunda em quadro agudo unilateral.\n'
  '-Avaliar perfusão arterial antes de indicar compressão.\n'
  '-Indicar meia de compressão, elevação dos membros e caminhada regular.\n'
  '-Considerar flebotônico para alívio sintomático, explicando a limitação do efeito.\n'
  '-Encaminhar para avaliação vascular quando houver indicação de tratamento definitivo.\n'
  '-Reavaliar em 8 a 12 semanas.',
 'sinais_alerta':
  '-Edema unilateral agudo com dor\n-Empastamento de panturrilha\n-Cordão venoso endurecido e doloroso\n'
  '-Sangramento de variz\n-Úlcera de membro inferior\n-Alterações tróficas progressivas\n'
  '-Dor isquêmica em repouso\n-Ausência de pulsos',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em sangramento de variz não controlado ou suspeita de trombose venosa profunda.\n'
  '-Encaminhar à cirurgia vascular em varizes sintomáticas refratárias, varicoflebite ou úlcera venosa.\n'
  '-Encaminhar se houver doença arterial associada que contraindique compressão.\n'
  '-Reavaliar em 8 a 12 semanas.',
 'observacoes_clinicas':
  '-Flebotônico alivia sintomas, mas não corrige o refluxo venoso.\n'
  '-Compressão elástica é a medida conservadora mais eficaz.\n'
  '-Sangramento de variz é controlado com compressão direta e elevação do membro.',
},

'EPISTAXE LEVE — ADULTO': {
 'especialidade': ['Otorrinolaringologia', 'Medicina de Emergência', 'Clínica Médica', 'APS'],
 'contexto': CP, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Sangramento nasal, na maioria das vezes anterior, originado do plexo de Kiesselbach.\n'
  '-Causas comuns incluem trauma digital, ar seco, rinite, uso de corticoide nasal e hipertensão.\n'
  '-A maioria dos casos é controlada com compressão digital correta por 10 a 15 minutos.\n'
  '-Sangramento posterior é mais volumoso, de difícil controle e exige avaliação especializada.\n'
  '-Uso de anticoagulante ou antiagregante aumenta a dificuldade de controle.',
 'quando_usar':
  '-Adulto com epistaxe anterior de pequeno volume, sem instabilidade.\n'
  '-Primeiro atendimento com medidas locais de controle.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente se houver sangramento volumoso, instabilidade hemodinâmica ou sangramento posterior.\n'
  '-Não ignorar epistaxe recorrente sem causa aparente, que exige investigação.\n'
  '-Não ignorar uso de anticoagulante, coagulopatia ou plaquetopenia.\n'
  '-Não orientar inclinar a cabeça para trás: isso favorece deglutição de sangue e vômitos.\n'
  '-Não ignorar hipertensão grave associada.',
 'conduta_procedimento':
  '-Avaliar sinais vitais, volume estimado do sangramento e estabilidade.\n'
  '-Orientar posição sentada com leve inclinação para frente.\n'
  '-Realizar compressão digital da asa nasal contra o septo por 10 a 15 minutos ininterruptos.\n'
  '-Aplicar compressa fria e considerar vasoconstritor tópico conforme protocolo.\n'
  '-Inspecionar a fossa nasal após o controle para identificar o ponto sangrante.\n'
  '-Aferir e tratar hipertensão significativa.\n'
  '-Revisar uso de anticoagulante e antiagregante; solicitar exames se houver suspeita de coagulopatia.\n'
  '-Orientar umidificação, evitar manipulação e retorno se houver recorrência.',
 'sinais_alerta':
  '-Sangramento volumoso ou que não cede após compressão adequada\n-Sangramento posterior\n'
  '-Hipotensão\n-Taquicardia\n-Palidez\n-Uso de anticoagulante\n-Coagulopatia conhecida\n'
  '-Plaquetopenia\n-Epistaxe recorrente unilateral\n-Obstrução nasal unilateral persistente\n-Trauma facial',
 'criterios_encaminhamento':
  '-Encaminhar à emergência se o sangramento não ceder, for volumoso ou houver instabilidade.\n'
  '-Encaminhar à otorrinolaringologia em epistaxe posterior, recorrente ou com necessidade de cauterização.\n'
  '-Encaminhar para investigação se houver epistaxe recorrente unilateral com obstrução nasal.\n'
  '-Encaminhar se houver coagulopatia ou dificuldade de controle por anticoagulação.',
 'observacoes_clinicas':
  '-A compressão correta, mantida sem interrupção por 10 a 15 minutos, resolve a maioria dos casos.\n'
  '-Inclinar a cabeça para trás é erro comum e favorece náuseas e aspiração.\n'
  '-Epistaxe unilateral recorrente com obstrução nasal exige afastar lesão estrutural.',
},

'LABIRINTITE — ADULTO': {
 'especialidade': ['Otorrinolaringologia', 'Neurologia', 'Clínica Médica', 'Medicina de Emergência'],
 'contexto': CP, 'nivel_risco': ['Moderado'],
 'resumo_clinico':
  '-Inflamação do labirinto, geralmente pós-viral, com vertigem, náuseas, vômitos e desequilíbrio.\n'
  '-Diferencia-se da neurite vestibular pela presença de hipoacusia e zumbido associados.\n'
  '-O quadro é de instalação aguda, com vertigem contínua que dura dias, diferente da vertigem posicional breve.\n'
  '-O tratamento é sintomático e por período curto: supressores vestibulares prolongados atrasam a compensação.\n'
  '-Sinais neurológicos centrais exigem excluir causa vascular do sistema nervoso central.',
 'quando_usar':
  '-Adulto com vertigem aguda contínua, náuseas e desequilíbrio, com hipoacusia ou zumbido associados.\n'
  '-Ausência de sinais neurológicos focais.\n'
  '-Uso em pronto atendimento, APS e ambulatório.',
 'quando_nao_usar':
  '-Não assumir causa periférica se houver déficit neurológico focal, diplopia, disartria, ataxia importante ou cefaleia intensa.\n'
  '-Não manter supressor vestibular por tempo prolongado: ele atrasa a compensação central.\n'
  '-Não ignorar hipoacusia súbita, que exige avaliação otorrinolaringológica urgente.\n'
  '-Não ignorar fatores de risco cardiovascular em paciente idoso com vertigem aguda.\n'
  '-Não confundir com vertigem posicional paroxística benigna, que é breve e desencadeada por movimento.',
 'conduta_procedimento':
  '-Caracterizar início, duração, fatores desencadeantes, hipoacusia, zumbido e sintomas neurológicos.\n'
  '-Aferir sinais vitais e realizar exame neurológico completo, incluindo marcha e coordenação.\n'
  '-Avaliar nistagmo e realizar manobras diagnósticas quando aplicável.\n'
  '-Realizar otoscopia e avaliação auditiva quando possível.\n'
  '-Considerar neuroimagem se houver sinal central, fator de risco vascular ou dúvida diagnóstica.\n'
  '-Prescrever sintomáticos por período curto, com hidratação se houver vômitos.\n'
  '-Orientar retorno gradual à atividade, que favorece a compensação vestibular.\n'
  '-Reavaliar em 7 dias; encaminhar se houver persistência.',
 'sinais_alerta':
  '-Déficit neurológico focal\n-Diplopia\n-Disartria\n-Ataxia importante\n-Cefaleia intensa\n'
  '-Nistagmo vertical ou que muda de direção\n-Incapacidade de deambular\n-Hipoacusia súbita\n'
  '-Idade avançada com fatores de risco vascular\n-Vômitos incoercíveis com desidratação',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em suspeita de causa central: déficit focal, ataxia importante ou nistagmo atípico.\n'
  '-Encaminhar com urgência à otorrinolaringologia em hipoacusia súbita.\n'
  '-Encaminhar se houver vômitos incoercíveis com desidratação.\n'
  '-Encaminhar à otorrinolaringologia ou neurologia se os sintomas persistirem além de 2 a 4 semanas.\n'
  '-Reavaliar em 7 dias.',
 'observacoes_clinicas':
  '-Hipoacusia e zumbido diferenciam labirintite de neurite vestibular.\n'
  '-Supressor vestibular deve ser usado por poucos dias: o uso prolongado atrasa a compensação.\n'
  '-Vertigem aguda em idoso com risco vascular exige atenção especial para causa central.',
},

'ANEMIA FERROPRIVA — CRIANÇA': {
 'especialidade': ['Pediatria', 'Hematologia', 'APS', 'Medicina de Família'],
 'contexto': CC, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Anemia por deficiência de ferro, a carência nutricional mais comum na infância.\n'
  '-Cursa com palidez, irritabilidade, cansaço, inapetência e, quando prolongada, impacto no desenvolvimento.\n'
  '-Fatores de risco incluem prematuridade, baixo peso ao nascer, desmame precoce, dieta pobre em ferro e parasitoses.\n'
  '-O tratamento é reposição de ferro por vários meses, mantida após a normalização da hemoglobina para repor estoques.\n'
  '-A dose é calculada por peso e a resposta é monitorada laboratorialmente.',
 'quando_usar':
  '-Criança com palidez, hemograma compatível com anemia ferropriva ou fator de risco nutricional.\n'
  '-Necessidade de reposição terapêutica ou profilática.\n'
  '-Uso em APS e ambulatório pediátrico.',
 'quando_nao_usar':
  '-Não repor ferro indefinidamente sem confirmar o diagnóstico e monitorar a resposta.\n'
  '-Não ignorar sangramento, hepatoesplenomegalia, adenomegalia ou petéquias, que sugerem outra causa.\n'
  '-Não ignorar falha de resposta após 4 semanas de tratamento correto: reavaliar diagnóstico e adesão.\n'
  '-Não usar dose de adulto: calcular por peso.\n'
  '-Não ignorar anemia grave com repercussão hemodinâmica.',
 'conduta_procedimento':
  '-Avaliar palidez, curva de crescimento, alimentação e antecedentes perinatais.\n'
  '-Investigar sangramento, parasitose e consumo excessivo de leite de vaca.\n'
  '-Solicitar hemograma e, quando disponível, ferritina e cinética do ferro.\n'
  '-Conferir peso para o cálculo da dose de ferro elementar.\n'
  '-Orientar administração longe de leite e derivados; associar fonte de vitamina C quando possível.\n'
  '-Explicar efeitos esperados: escurecimento das fezes, desconforto abdominal e constipação.\n'
  '-Tratar parasitose associada quando indicado e orientar alimentação rica em ferro.\n'
  '-Reavaliar hemograma em 4 semanas e manter reposição por 2 a 3 meses após a normalização.',
 'sinais_alerta':
  '-Palidez intensa\n-Taquicardia\n-Dispneia\n-Prostração\n-Sopro cardíaco novo\n-Petéquias ou equimoses\n'
  '-Hepatoesplenomegalia\n-Adenomegalia\n-Sangramento visível\n-Perda de peso\n'
  '-Falha de resposta após 4 semanas\n-Atraso do desenvolvimento',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em anemia grave com repercussão hemodinâmica.\n'
  '-Encaminhar à hematologia pediátrica se houver falha de resposta, citopenias, organomegalia ou suspeita de outra causa.\n'
  '-Encaminhar para investigação de sangramento quando houver suspeita.\n'
  '-Reavaliar hemograma em 4 semanas.',
 'observacoes_clinicas':
  '-A reposição deve continuar por 2 a 3 meses após normalizar a hemoglobina, para repor os estoques.\n'
  '-Leite de vaca em excesso reduz a absorção de ferro e pode causar perda intestinal oculta.\n'
  '-Falha de resposta em 4 semanas exige revisar adesão, dose e diagnóstico.',
},

'CÓLICA / GASES DO LACTENTE — CRIANÇA': {
 'especialidade': ['Pediatria', 'APS', 'Medicina de Família'],
 'contexto': CC, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Cólica do lactente é choro excessivo e recorrente em bebê saudável, com bom ganho de peso.\n'
  '-Costuma iniciar nas primeiras semanas, ter pico por volta de 6 semanas e resolver por volta dos 3 a 4 meses.\n'
  '-O exame físico é normal e o crescimento é adequado: esses dois pontos sustentam o diagnóstico.\n'
  '-O manejo é principalmente orientação, acolhimento e medidas de conforto.\n'
  '-Simeticona tem eficácia limitada, mas é frequentemente usada por ser segura.',
 'quando_usar':
  '-Lactente com choro excessivo, sem sinais de alerta, com ganho de peso adequado e exame normal.\n'
  '-Necessidade de orientação familiar e medidas de conforto.\n'
  '-Uso em APS e ambulatório pediátrico.',
 'quando_nao_usar':
  '-Não atribuir a cólica se houver febre, vômitos biliosos, sangue nas fezes, distensão importante ou parada de eliminação.\n'
  '-Não atribuir a cólica se houver baixo ganho de peso ou perda ponderal.\n'
  '-Não ignorar choro agudo e inconsolável de início súbito, que exige exame completo e busca de causa.\n'
  '-Não indicar troca de fórmula ou dieta materna restritiva sem avaliação criteriosa.\n'
  '-Não prescrever medicações sedativas.',
 'conduta_procedimento':
  '-Caracterizar padrão do choro, horário, duração e fatores de melhora.\n'
  '-Avaliar curva de peso, aleitamento, técnica de mamada e pega.\n'
  '-Realizar exame físico completo, incluindo abdome, região inguinal, otoscopia e busca de fio de cabelo em dedos.\n'
  '-Excluir sinais de alerta antes de firmar o diagnóstico.\n'
  '-Orientar técnicas de conforto: colo, contato pele a pele, ambiente calmo, massagem e eructação após mamadas.\n'
  '-Acolher a família, reconhecer o desgaste e orientar rede de apoio.\n'
  '-Explicar o caráter autolimitado e a resolução esperada por volta dos 3 a 4 meses.\n'
  '-Reavaliar conforme necessidade e sempre que houver mudança do padrão.',
 'sinais_alerta':
  '-Febre\n-Vômitos biliosos ou em jato\n-Sangue nas fezes\n-Distensão abdominal importante\n'
  '-Parada de eliminação de gases e fezes\n-Baixo ganho de peso\n-Perda de peso\n-Letargia\n'
  '-Choro agudo inconsolável de início súbito\n-Abaulamento inguinal\n-Palidez',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em vômitos biliosos, sangue nas fezes, distensão importante ou suspeita de obstrução.\n'
  '-Encaminhar à emergência em abaulamento inguinal com dor, por suspeita de hérnia encarcerada.\n'
  '-Encaminhar à pediatria em baixo ganho de peso ou dúvida diagnóstica.\n'
  '-Reavaliar sempre que o padrão do choro mudar.',
 'observacoes_clinicas':
  '-Ganho de peso adequado e exame normal são os pilares que sustentam o diagnóstico.\n'
  '-Acolher a família reduz ansiedade e intervenções desnecessárias.\n'
  '-Restrições dietéticas maternas amplas raramente são necessárias e podem prejudicar a amamentação.',
},

'SÍNDROME VIRAL — CRIANÇA': {
 'especialidade': ['Pediatria', 'Infectologia', 'APS', 'Medicina de Emergência'],
 'contexto': ['Pediatria', 'APS', 'Ambulatorial', 'PS'],
 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Quadro infeccioso agudo de origem viral, com febre, sintomas respiratórios altos, exantema ou sintomas gastrointestinais.\n'
  '-É a causa mais comum de febre aguda na infância e costuma ser autolimitado.\n'
  '-O tratamento é sintomático, com antitérmico, hidratação e observação da evolução.\n'
  '-Antibiótico não tem indicação na ausência de foco bacteriano.\n'
  '-A avaliação do estado geral e da hidratação é mais importante que o valor absoluto da temperatura.',
 'quando_usar':
  '-Criança com febre e sintomas virais, em bom estado geral e sem sinais de alerta.\n'
  '-Necessidade de manejo sintomático e orientação de sinais de retorno.\n'
  '-Uso em APS, ambulatório e pronto atendimento pediátrico.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente lactente menor de 3 meses com febre: exige avaliação específica.\n'
  '-Não atribuir a quadro viral se houver prostração, gemência, petéquias, rigidez de nuca ou desidratação.\n'
  '-Não prescrever antibiótico sem foco bacteriano identificado.\n'
  '-Não usar anti-inflamatório sem cautela quando houver suspeita de dengue ou desidratação.\n'
  '-Não usar dose de adulto: calcular por peso.',
 'conduta_procedimento':
  '-Caracterizar febre, tempo de evolução, sintomas associados e contatos.\n'
  '-Aferir sinais vitais, avaliar estado geral, hidratação, perfusão e nível de atividade.\n'
  '-Procurar foco bacteriano: otoscopia, orofaringe, ausculta, exame de pele e abdome.\n'
  '-Avaliar diurese, aceitação de líquidos e presença de vômitos.\n'
  '-Conferir peso para cálculo das doses dos sintomáticos.\n'
  '-Prescrever antitérmico e antiemético conforme necessidade, com hidratação oral.\n'
  '-Orientar sinais de retorno imediato e reavaliação se a febre persistir além de 3 a 5 dias.\n'
  '-Reavaliar conforme evolução.',
 'sinais_alerta':
  '-Idade menor que 3 meses com febre\n-Prostração\n-Gemência\n-Irritabilidade inconsolável\n'
  '-Petéquias ou púrpura\n-Rigidez de nuca\n-Convulsão\n-Desidratação\n-Recusa de líquidos\n'
  '-Dificuldade respiratória\n-Cianose\n-Febre por mais de 5 dias\n-Palidez ou má perfusão',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em prostração, petéquias, rigidez de nuca, convulsão, desidratação ou dificuldade respiratória.\n'
  '-Encaminhar todo lactente menor de 3 meses com febre para avaliação.\n'
  '-Encaminhar se a febre persistir por mais de 5 dias ou se houver piora após melhora inicial.\n'
  '-Reavaliar em 48 a 72 horas se não houver melhora.',
 'observacoes_clinicas':
  '-O estado geral e a hidratação orientam mais a conduta do que o valor da temperatura.\n'
  '-Antibiótico não trata quadro viral e expõe a efeitos adversos e resistência.\n'
  '-Petéquias com febre exigem avaliação imediata pelo risco de doença meningocócica.',
},
}

if __name__ == '__main__':
    executar(CLINICOS)

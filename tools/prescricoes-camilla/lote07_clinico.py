# -*- coding: utf-8 -*-
"""Lote 07 — gastroenterologia e endocrinologia."""
from create_new import executar

GA = ['Gastroenterologia', 'Clínica Médica', 'APS', 'Medicina de Família']
EN = ['Endocrinologia', 'Clínica Médica', 'APS', 'Medicina de Família']
C = ['Adulto', 'APS', 'Ambulatorial']
CP = ['Adulto', 'APS', 'Ambulatorial', 'PS']

CLINICOS = {
'DISPEPSIA FUNCIONAL / SÍNDROME DISPÉPTICA — ADULTO': {
 'especialidade': GA, 'contexto': C, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Dor ou desconforto epigástrico recorrente, com plenitude pós-prandial, saciedade precoce ou queimação, sem doença estrutural que explique o quadro.\n'
  '-O manejo inicial inclui inibidor de bomba de prótons, procinético quando há plenitude, e ajuste de hábitos.\n'
  '-A pesquisa e o tratamento de Helicobacter pylori mudam a evolução em parte dos pacientes.\n'
  '-Endoscopia é indicada na presença de sinais de alarme ou em pacientes acima da faixa etária de risco definida localmente.\n'
  '-Estresse, ansiedade e padrão alimentar têm papel relevante e devem ser abordados.',
 'quando_usar':
  '-Adulto com dor epigástrica, plenitude pós-prandial ou saciedade precoce recorrentes.\n'
  '-Ausência de sinais de alarme, em paciente estável.\n'
  '-Uso em APS e ambulatório para tratamento empírico inicial e definição de investigação.',
 'quando_nao_usar':
  '-Não tratar empiricamente se houver disfagia, odinofagia, vômitos persistentes, perda de peso, anemia, sangramento ou massa palpável.\n'
  '-Não postergar endoscopia em paciente com sinais de alarme ou idade de risco.\n'
  '-Não ignorar dor epigástrica que possa representar síndrome coronariana, sobretudo em idoso, diabético ou cardiopata.\n'
  '-Não manter inibidor de bomba de prótons indefinidamente sem reavaliação.\n'
  '-Não ignorar uso crônico de anti-inflamatórios como causa.',
 'conduta_procedimento':
  '-Caracterizar sintoma predominante, relação com alimentação, duração e fatores de melhora e piora.\n'
  '-Investigar sinais de alarme e uso de anti-inflamatórios, álcool e tabaco.\n'
  '-Avaliar risco cardiovascular quando a dor epigástrica puder ser de origem coronariana.\n'
  '-Pesquisar Helicobacter pylori conforme disponibilidade e indicação.\n'
  '-Iniciar inibidor de bomba de prótons por período definido; associar procinético se houver plenitude.\n'
  '-Orientar refeições fracionadas, evitar álcool, tabaco e alimentos desencadeantes; abordar estresse.\n'
  '-Solicitar endoscopia se houver sinais de alarme, falha terapêutica ou idade de risco.\n'
  '-Reavaliar em 4 a 8 semanas e programar retirada do inibidor de bomba de prótons quando possível.',
 'sinais_alerta':
  '-Disfagia\n-Odinofagia\n-Vômitos persistentes\n-Perda de peso não intencional\n-Anemia\n'
  '-Hematêmese ou melena\n-Massa abdominal palpável\n-Icterícia\n-História familiar de câncer gástrico\n'
  '-Início após os 45 a 50 anos\n-Dor epigástrica com fatores de risco cardiovascular',
 'criterios_encaminhamento':
  '-Encaminhar à endoscopia se houver sinais de alarme, idade de risco ou falha do tratamento empírico.\n'
  '-Encaminhar à emergência se houver hematêmese, melena ou instabilidade.\n'
  '-Encaminhar à emergência se a dor epigástrica sugerir síndrome coronariana.\n'
  '-Encaminhar à gastroenterologia em sintomas refratários ou recorrentes apesar do tratamento adequado.\n'
  '-Reavaliar em 4 a 8 semanas.',
 'observacoes_clinicas':
  '-Dor epigástrica em idoso, diabético ou cardiopata exige excluir causa coronariana antes de rotular como dispepsia.\n'
  '-Inibidor de bomba de prótons deve ter duração definida e reavaliação, não uso indefinido automático.\n'
  '-Pesquisar e tratar H. pylori beneficia parte relevante dos pacientes.',
},

'ÚLCERA PÉPTICA DUODENAL — ADULTO': {
 'especialidade': GA, 'contexto': CP, 'nivel_risco': ['Moderado'],
 'resumo_clinico':
  '-Solução de continuidade da mucosa duodenal, associada principalmente a Helicobacter pylori e ao uso de anti-inflamatórios.\n'
  '-Cursa com dor epigástrica em queimação, que tipicamente melhora com alimentação e piora à noite.\n'
  '-O tratamento inclui supressão ácida prolongada e erradicação do H. pylori quando presente.\n'
  '-As complicações relevantes são hemorragia digestiva, perfuração e obstrução.\n'
  '-A confirmação da erradicação do H. pylori é parte do cuidado.',
 'quando_usar':
  '-Adulto com dor epigástrica em queimação com padrão sugestivo, ou com úlcera duodenal confirmada.\n'
  '-Paciente estável, sem sinais de sangramento ativo ou perfuração.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente se houver hematêmese, melena, hipotensão, taquicardia ou palidez importante.\n'
  '-Não ignorar dor abdominal súbita e intensa com abdome rígido: suspeitar de perfuração.\n'
  '-Não manter anti-inflamatório sem necessidade e sem proteção gástrica.\n'
  '-Não deixar de pesquisar e erradicar H. pylori quando indicado.\n'
  '-Não ignorar vômitos persistentes com distensão, que podem indicar obstrução pilórica.',
 'conduta_procedimento':
  '-Caracterizar a dor, sua relação com alimentação e o padrão noturno.\n'
  '-Avaliar sinais vitais, palidez e sinais de sangramento.\n'
  '-Investigar uso de anti-inflamatórios, corticoide, anticoagulante, álcool e tabaco.\n'
  '-Pesquisar H. pylori e tratar com esquema de erradicação quando positivo.\n'
  '-Prescrever inibidor de bomba de prótons pelo período indicado.\n'
  '-Suspender ou substituir anti-inflamatório sempre que possível.\n'
  '-Solicitar endoscopia conforme indicação e programar confirmação de erradicação.\n'
  '-Reavaliar em 4 a 8 semanas.',
 'sinais_alerta':
  '-Hematêmese\n-Melena\n-Hipotensão\n-Taquicardia\n-Palidez importante\n-Síncope\n'
  '-Dor abdominal súbita e intensa\n-Abdome rígido\n-Vômitos persistentes com distensão\n'
  '-Perda de peso importante\n-Anemia',
 'criterios_encaminhamento':
  '-Encaminhar à emergência se houver hematêmese, melena, instabilidade ou suspeita de perfuração.\n'
  '-Encaminhar à endoscopia conforme indicação diagnóstica e para controle quando necessário.\n'
  '-Encaminhar à gastroenterologia em falha terapêutica, recorrência ou úlcera refratária.\n'
  '-Encaminhar se houver anemia sem causa definida.\n'
  '-Reavaliar em 4 a 8 semanas.',
 'observacoes_clinicas':
  '-Erradicar H. pylori reduz recorrência de forma expressiva.\n'
  '-Retirar o anti-inflamatório é parte do tratamento quando ele é o fator causal.\n'
  '-Sangramento digestivo é a complicação mais comum e exige atendimento imediato.',
},

'INFECÇÃO POR HELICOBACTER PYLORI — ADULTO': {
 'especialidade': GA, 'contexto': C, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Infecção gástrica crônica pelo Helicobacter pylori, associada a gastrite, úlcera péptica, linfoma MALT e câncer gástrico.\n'
  '-O tratamento é combinado, com inibidor de bomba de prótons associado a antibióticos por 10 a 14 dias.\n'
  '-A alergia à penicilina exige esquema alternativo sem amoxicilina.\n'
  '-A adesão ao esquema completo é determinante para a erradicação.\n'
  '-A confirmação de erradicação deve ser feita após intervalo adequado do fim do tratamento.',
 'quando_usar':
  '-Adulto com teste positivo para H. pylori e indicação de tratamento.\n'
  '-Úlcera péptica, dispepsia com pesquisa positiva, linfoma MALT ou outras indicações estabelecidas.\n'
  '-Uso em APS e ambulatório.',
 'quando_nao_usar':
  '-Não tratar sem confirmação diagnóstica quando o teste está disponível.\n'
  '-Não usar esquema com amoxicilina em paciente alérgico à penicilina.\n'
  '-Não repetir o mesmo esquema após falha sem reavaliar a escolha dos antibióticos.\n'
  '-Não realizar teste de controle logo após o tratamento: respeitar o intervalo e a suspensão do inibidor de bomba de prótons.\n'
  '-Não ignorar sinais de alarme que indiquem endoscopia.',
 'conduta_procedimento':
  '-Confirmar o diagnóstico pelo método disponível e revisar a indicação de tratamento.\n'
  '-Investigar alergia à penicilina e uso prévio de macrolídeo, que influenciam a escolha do esquema.\n'
  '-Revisar interações medicamentosas e comorbidades.\n'
  '-Prescrever o esquema completo pelo período indicado, reforçando a adesão.\n'
  '-Orientar sobre efeitos adversos comuns e sobre não interromper o tratamento por conta própria.\n'
  '-Programar teste de controle de erradicação após o intervalo recomendado.\n'
  '-Reavaliar sintomas em 4 a 8 semanas.',
 'sinais_alerta':
  '-Disfagia\n-Perda de peso\n-Anemia\n-Hematêmese ou melena\n-Vômitos persistentes\n-Massa abdominal\n'
  '-Alergia à penicilina\n-Falha de tratamento prévio\n-História familiar de câncer gástrico',
 'criterios_encaminhamento':
  '-Encaminhar à endoscopia se houver sinais de alarme ou indicação diagnóstica.\n'
  '-Encaminhar à gastroenterologia após falha de dois esquemas de erradicação.\n'
  '-Encaminhar à emergência se houver sangramento digestivo.\n'
  '-Programar controle de erradicação conforme protocolo.',
 'observacoes_clinicas':
  '-A adesão ao esquema completo é o principal determinante do sucesso.\n'
  '-Alergia à penicilina exige esquema alternativo específico.\n'
  '-O teste de controle exige suspensão prévia do inibidor de bomba de prótons para evitar falso negativo.',
},

'COLELITÍASE — ADULTO': {
 'especialidade': ['Gastroenterologia', 'Cirurgia Geral', 'Clínica Médica', 'APS'],
 'contexto': C, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Presença de cálculos na vesícula biliar, frequentemente assintomática e descoberta em exame de imagem.\n'
  '-Quando sintomática, manifesta-se por cólica biliar: dor em hipocôndrio direito ou epigástrio, de início rápido e duração limitada.\n'
  '-O tratamento definitivo da colelitíase sintomática é a colecistectomia eletiva.\n'
  '-A dissolução farmacológica com ácido ursodesoxicólico tem indicação restrita, resposta lenta e alta taxa de recidiva.\n'
  '-Dor prolongada, febre ou icterícia indicam complicação e mudam a conduta.',
 'quando_usar':
  '-Adulto com colelitíase confirmada por imagem, assintomática ou com episódios de cólica biliar.\n'
  '-Paciente estável, sem sinais de colecistite, colangite ou pancreatite.\n'
  '-Uso em APS e ambulatório para orientação, analgesia de resgate e encaminhamento cirúrgico.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente se houver dor por mais de 4 a 6 horas, febre, icterícia, colúria ou vômitos persistentes.\n'
  '-Não indicar dissolução farmacológica como alternativa padrão à cirurgia em paciente apto.\n'
  '-Não ignorar dor epigástrica irradiada para dorso com vômitos, que sugere pancreatite biliar.\n'
  '-Não postergar avaliação cirúrgica em crises recorrentes.',
 'conduta_procedimento':
  '-Caracterizar a dor: início, duração, irradiação, relação com alimentação e recorrência.\n'
  '-Avaliar sinais vitais, icterícia, Murphy e sinais de peritonite.\n'
  '-Solicitar ultrassom de abdome se ainda não realizado.\n'
  '-Solicitar exames hepáticos e lipase se houver dor prolongada, febre, icterícia ou dúvida.\n'
  '-Orientar dieta com redução de gordura durante a fase sintomática, sem prometer controle definitivo.\n'
  '-Prescrever analgesia de resgate respeitando contraindicações.\n'
  '-Encaminhar à cirurgia geral para colecistectomia eletiva quando sintomática.\n'
  '-Orientar retorno imediato diante de sinais de complicação.',
 'sinais_alerta':
  '-Dor por mais de 4 a 6 horas\n-Febre\n-Calafrios\n-Icterícia\n-Colúria\n-Acolia\n-Vômitos persistentes\n'
  '-Murphy persistente\n-Defesa abdominal\n-Hipotensão\n-Dor irradiada para dorso com vômitos',
 'criterios_encaminhamento':
  '-Encaminhar à emergência se houver dor prolongada, febre, icterícia ou sinais de complicação.\n'
  '-Encaminhar à cirurgia geral para colecistectomia eletiva na colelitíase sintomática.\n'
  '-Encaminhar à gastroenterologia se houver suspeita de coledocolitíase.\n'
  '-Reavaliar conforme recorrência das crises.',
 'observacoes_clinicas':
  '-O tratamento definitivo da colelitíase sintomática é cirúrgico em paciente apto.\n'
  '-Ácido ursodesoxicólico tem indicação restrita, resposta lenta e recidiva frequente.\n'
  '-Colelitíase assintomática geralmente não exige cirurgia, salvo situações específicas.',
},

'HIPOTIREOIDISMO — ADULTO': {
 'especialidade': EN, 'contexto': C, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Deficiência de hormônios tireoidianos, com causa mais comum a tireoidite de Hashimoto.\n'
  '-Cursa com fadiga, ganho de peso, intolerância ao frio, pele seca, constipação, bradicardia e alterações de humor.\n'
  '-O diagnóstico é laboratorial, com TSH elevado e T4 livre reduzido no quadro primário.\n'
  '-O tratamento é reposição com levotiroxina, com ajuste guiado pelo TSH.\n'
  '-A absorção da levotiroxina exige jejum e distância de outros medicamentos.',
 'quando_usar':
  '-Adulto com sintomas compatíveis e confirmação laboratorial de hipotireoidismo.\n'
  '-Necessidade de iniciar ou ajustar reposição hormonal.\n'
  '-Uso em APS e ambulatório.',
 'quando_nao_usar':
  '-Não iniciar reposição sem confirmação laboratorial.\n'
  '-Não iniciar dose plena em idoso ou cardiopata: começar com dose menor e titular.\n'
  '-Não ajustar a dose antes de 6 a 8 semanas, tempo necessário para o novo equilíbrio.\n'
  '-Não ignorar rebaixamento do nível de consciência com hipotermia e bradicardia: suspeitar de coma mixedematoso.\n'
  '-Não ignorar a necessidade de ajuste na gestação, que exige alvo específico e acompanhamento.',
 'conduta_procedimento':
  '-Caracterizar sintomas, tempo de evolução e impacto funcional.\n'
  '-Solicitar TSH e T4 livre; considerar anticorpo antitireoperoxidase conforme o caso.\n'
  '-Avaliar comorbidades cardiovasculares antes de definir a dose inicial.\n'
  '-Iniciar levotiroxina com dose ajustada a peso, idade e risco cardiovascular.\n'
  '-Orientar tomada em jejum, com água, aguardando cerca de 30 a 60 minutos para se alimentar.\n'
  '-Orientar distância de cálcio, ferro, inibidor de bomba de prótons e outros interferentes.\n'
  '-Repetir TSH em 6 a 8 semanas e ajustar conforme o resultado.\n'
  '-Manter acompanhamento periódico após a estabilização.',
 'sinais_alerta':
  '-Rebaixamento do nível de consciência\n-Hipotermia\n-Bradicardia importante\n-Hipotensão\n'
  '-Derrame pericárdico\n-Gestação\n-Cardiopatia isquêmica\n-Idoso frágil\n-Piora após início da reposição',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em suspeita de coma mixedematoso.\n'
  '-Encaminhar à endocrinologia em gestação, hipotireoidismo central, dificuldade de controle ou cardiopatia associada.\n'
  '-Encaminhar se houver piora clínica após o início da reposição.\n'
  '-Reavaliar com TSH em 6 a 8 semanas.',
 'observacoes_clinicas':
  '-A absorção da levotiroxina é muito sensível a alimentos e a outros medicamentos.\n'
  '-Em idoso e cardiopata, iniciar com dose reduzida e titular lentamente.\n'
  '-Na gestação a necessidade aumenta e o alvo de TSH é específico.',
},

'HIPERTIREOIDISMO — ADULTO': {
 'especialidade': EN, 'contexto': CP, 'nivel_risco': ['Moderado', 'Alto'],
 'resumo_clinico':
  '-Excesso de hormônios tireoidianos, com causa mais comum a doença de Graves.\n'
  '-Cursa com perda de peso, taquicardia, tremor, sudorese, intolerância ao calor, ansiedade e insônia.\n'
  '-O diagnóstico laboratorial mostra TSH suprimido com T4 livre elevado.\n'
  '-O tratamento combina droga antitireoidiana e betabloqueador para controle sintomático.\n'
  '-A crise tireotóxica é emergência, com febre, taquiarritmia, agitação e rebaixamento.',
 'quando_usar':
  '-Adulto com sintomas de tireotoxicose e confirmação laboratorial.\n'
  '-Paciente estável, sem sinais de crise tireotóxica.\n'
  '-Uso em APS, ambulatório e pronto atendimento para início do controle e encaminhamento.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente se houver febre alta, agitação, rebaixamento, arritmia com instabilidade ou insuficiência cardíaca: tratar como crise tireotóxica.\n'
  '-Não iniciar droga antitireoidiana sem orientar sobre o risco de agranulocitose e hepatotoxicidade.\n'
  '-Não ignorar febre com dor de garganta durante o tratamento: suspender e avaliar agranulocitose.\n'
  '-Não usar betabloqueador sem avaliar asma e insuficiência cardíaca descompensada.\n'
  '-Não deixar de considerar gestação, que muda a escolha do antitireoidiano.',
 'conduta_procedimento':
  '-Caracterizar sintomas, perda de peso, palpitações e alterações oculares.\n'
  '-Avaliar frequência cardíaca, ritmo, pressão, tremor, bócio e sinais oculares.\n'
  '-Solicitar TSH, T4 livre e, conforme disponibilidade, anticorpos e imagem tireoidiana.\n'
  '-Solicitar eletrocardiograma se houver palpitações ou taquicardia.\n'
  '-Iniciar betabloqueador para controle sintomático quando não houver contraindicação.\n'
  '-Iniciar droga antitireoidiana conforme avaliação, com hemograma e função hepática de base.\n'
  '-Orientar suspender a medicação e procurar atendimento diante de febre com odinofagia ou icterícia.\n'
  '-Encaminhar à endocrinologia para definição do tratamento definitivo.',
 'sinais_alerta':
  '-Febre alta com agitação\n-Rebaixamento do nível de consciência\n-Taquiarritmia com instabilidade\n'
  '-Fibrilação atrial\n-Insuficiência cardíaca\n-Perda de peso acentuada\n-Febre com dor de garganta durante o tratamento\n'
  '-Icterícia\n-Alteração visual ou proptose importante\n-Gestação',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em suspeita de crise tireotóxica ou arritmia com instabilidade.\n'
  '-Encaminhar imediatamente se houver febre com odinofagia durante o uso de antitireoidiano.\n'
  '-Encaminhar à endocrinologia para definição de tratamento definitivo.\n'
  '-Encaminhar à oftalmologia em orbitopatia com alteração visual.\n'
  '-Encaminhar gestante para manejo especializado.',
 'observacoes_clinicas':
  '-Agranulocitose é rara mas grave: febre com dor de garganta exige suspensão imediata e avaliação.\n'
  '-Betabloqueador controla sintomas enquanto o antitireoidiano faz efeito.\n'
  '-A escolha do antitireoidiano muda conforme o trimestre da gestação.',
},

'GOTA — ADULTO': {
 'especialidade': ['Reumatologia', 'Clínica Médica', 'APS', 'Medicina de Emergência'],
 'contexto': CP, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Artrite inflamatória causada por deposição de cristais de urato monossódico nas articulações.\n'
  '-A crise típica é monoarticular, de início súbito, com dor intensa, eritema e calor, frequentemente na primeira metatarsofalangiana.\n'
  '-O tratamento da crise usa anti-inflamatório, colchicina ou corticoide, conforme comorbidades.\n'
  '-A terapia de redução do urato é iniciada ou mantida na fase de controle, com alvo de uricemia definido.\n'
  '-A hiperuricemia assintomática isolada geralmente não é indicação de tratamento farmacológico.',
 'quando_usar':
  '-Adulto com monoartrite aguda de padrão compatível ou diagnóstico prévio de gota em crise.\n'
  '-Fase de controle para manutenção e redução do urato.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não assumir gota sem considerar artrite séptica, sobretudo se houver febre, calafrios ou porta de entrada.\n'
  '-Não usar anti-inflamatório sem cautela em doença renal, insuficiência cardíaca, úlcera, anticoagulação ou hipertensão descompensada.\n'
  '-Não iniciar ou suspender terapia de redução do urato de forma abrupta durante a crise sem profilaxia adequada.\n'
  '-Não tratar hiperuricemia assintomática isolada como se fosse gota.\n'
  '-Não ignorar função renal ao escolher a dose da colchicina.',
 'conduta_procedimento':
  '-Caracterizar início, articulação acometida, intensidade e episódios prévios.\n'
  '-Avaliar febre, porta de entrada cutânea e sinais sistêmicos para excluir artrite séptica.\n'
  '-Revisar comorbidades: doença renal, cardiovascular, hepática e uso de diurético.\n'
  '-Solicitar exames conforme necessidade; lembrar que a uricemia pode estar normal durante a crise.\n'
  '-Tratar a crise com anti-inflamatório, colchicina ou corticoide, conforme o perfil do paciente.\n'
  '-Orientar repouso e elevação do membro; considerar artrocentese quando houver dúvida diagnóstica.\n'
  '-Discutir terapia de redução do urato conforme frequência de crises, tofos e comorbidades.\n'
  '-Orientar dieta, redução de álcool e revisão de medicamentos que elevam o urato.',
 'sinais_alerta':
  '-Febre com calafrios\n-Porta de entrada cutânea\n-Monoartrite em paciente imunossuprimido\n'
  '-Prótese articular\n-Poliartrite com sinais sistêmicos\n-Doença renal avançada\n'
  '-Insuficiência cardíaca\n-Sangramento digestivo prévio\n-Falha após 48 a 72 horas de tratamento',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em suspeita de artrite séptica.\n'
  '-Encaminhar à reumatologia em crises frequentes, tofos, gota tofácea ou dificuldade de controle.\n'
  '-Encaminhar se houver doença renal avançada que limite as opções terapêuticas.\n'
  '-Reavaliar em 48 a 72 horas na crise.',
 'observacoes_clinicas':
  '-Artrite séptica é o diagnóstico que não pode ser perdido diante de monoartrite aguda.\n'
  '-Uricemia normal durante a crise não afasta gota.\n'
  '-A terapia de redução do urato exige profilaxia de crise no início.',
},

'OSTEOPOROSE — ADULTO': {
 'especialidade': ['Endocrinologia', 'Reumatologia', 'Clínica Médica', 'APS'],
 'contexto': C, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Doença esquelética com redução da massa óssea e deterioração da microarquitetura, aumentando o risco de fratura.\n'
  '-É silenciosa até a ocorrência de fratura por fragilidade, mais comum em vértebras, quadril e punho.\n'
  '-O diagnóstico usa densitometria óssea e a presença de fratura por fragilidade.\n'
  '-O tratamento combina bisfosfonato, cálcio e vitamina D, com atenção à adesão e à técnica de administração.\n'
  '-A prevenção de quedas é parte central do cuidado, tão importante quanto o medicamento.',
 'quando_usar':
  '-Adulto com diagnóstico densitométrico de osteoporose ou fratura por fragilidade.\n'
  '-Paciente com alto risco de fratura em avaliação de risco.\n'
  '-Uso em APS e ambulatório para tratamento e seguimento.',
 'quando_nao_usar':
  '-Não iniciar bisfosfonato sem corrigir deficiência de vitamina D e sem avaliar função renal.\n'
  '-Não iniciar sem avaliação odontológica quando houver necessidade de procedimento invasivo, pelo risco de osteonecrose de mandíbula.\n'
  '-Não prescrever sem orientar a técnica de administração do bisfosfonato oral.\n'
  '-Não ignorar dor dorsal aguda com perda de altura: pode ser fratura vertebral.\n'
  '-Não tratar sem investigar causas secundárias em paciente jovem ou com apresentação atípica.',
 'conduta_procedimento':
  '-Avaliar fatores de risco: idade, menopausa, tabagismo, álcool, corticoide, história familiar e quedas.\n'
  '-Medir altura e procurar cifose ou perda de estatura, que sugerem fratura vertebral.\n'
  '-Solicitar densitometria óssea e exames para causas secundárias conforme o caso.\n'
  '-Dosar cálcio, função renal e vitamina D antes de iniciar o tratamento.\n'
  '-Corrigir vitamina D e garantir aporte de cálcio antes ou junto ao bisfosfonato.\n'
  '-Orientar tomada do bisfosfonato oral em jejum, com água, permanecendo em pé ou sentado por 30 minutos.\n'
  '-Orientar avaliação odontológica prévia quando houver procedimento invasivo planejado.\n'
  '-Trabalhar prevenção de quedas, exercício com carga e revisão de medicamentos sedativos.\n'
  '-Reavaliar adesão e programar controle densitométrico conforme protocolo.',
 'sinais_alerta':
  '-Dor dorsal aguda com perda de altura\n-Fratura por trauma mínimo\n-Dor após queda\n'
  '-Perda de estatura progressiva\n-Uso crônico de corticoide\n-Doença renal avançada\n'
  '-Hipocalcemia\n-Dor mandibular após procedimento odontológico\n-Osteoporose em paciente jovem',
 'criterios_encaminhamento':
  '-Encaminhar à emergência ou ortopedia em suspeita de fratura.\n'
  '-Encaminhar à endocrinologia ou reumatologia em osteoporose grave, em paciente jovem ou com causa secundária.\n'
  '-Encaminhar à odontologia antes de iniciar bisfosfonato quando houver necessidade de procedimento invasivo.\n'
  '-Encaminhar se houver doença renal que contraindique o tratamento habitual.\n'
  '-Reavaliar adesão e resposta conforme protocolo.',
 'observacoes_clinicas':
  '-Corrigir vitamina D antes do bisfosfonato evita hipocalcemia e melhora a resposta.\n'
  '-A técnica de administração do bisfosfonato oral é essencial para eficácia e tolerância.\n'
  '-Prevenção de quedas reduz fratura tanto quanto o tratamento medicamentoso.',
},
}

if __name__ == '__main__':
    executar(CLINICOS)

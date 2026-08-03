# -*- coding: utf-8 -*-
"""Lote 04 — ginecologia e ISTs."""
from create_new import executar

G = ['Ginecologia', 'Clínica Médica', 'APS', 'Medicina de Família']
GI = ['Ginecologia', 'Infectologia', 'Clínica Médica', 'APS']
C = ['Adulto', 'APS', 'Ambulatorial']
CP = ['Adulto', 'APS', 'Ambulatorial', 'PS']

CLINICOS = {
'CANDIDÍASE VAGINAL — ADULTO': {
 'especialidade': G, 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Vulvovaginite por Candida, mais frequentemente Candida albicans.\n'
  '-Cursa com prurido vulvar intenso, corrimento branco grumoso sem odor fétido, ardor e dispareunia.\n'
  '-O pH vaginal costuma estar normal (abaixo de 4,5), diferente da vaginose bacteriana e da tricomoníase.\n'
  '-Não é considerada IST, mas episódios recorrentes exigem investigação de fatores predisponentes.\n'
  '-Diabetes, uso recente de antibiótico, gestação e imunossupressão favorecem o quadro.',
 'quando_usar':
  '-Mulher adulta com prurido vulvar e corrimento branco grumoso, sem odor fétido.\n'
  '-Episódio isolado ou pouco frequente, sem sinais de doença inflamatória pélvica.\n'
  '-Uso em APS e ambulatório para tratamento tópico ou oral.',
 'quando_nao_usar':
  '-Não tratar como candidíase se houver dor pélvica, febre, dor à mobilização do colo ou sangramento: avaliar DIP.\n'
  '-Não usar fluconazol oral na gestação: preferir tratamento tópico.\n'
  '-Não repetir tratamento empírico em recorrência sem investigar diabetes, imunossupressão e outras causas.\n'
  '-Não confundir com vaginose bacteriana (odor fétido, pH elevado) ou tricomoníase (corrimento amarelo-esverdeado).',
 'conduta_procedimento':
  '-Caracterizar prurido, aspecto e odor do corrimento, ardor miccional e dispareunia.\n'
  '-Examinar vulva e vagina; avaliar pH vaginal quando disponível.\n'
  '-Investigar diabetes, uso recente de antibiótico, corticoide, gestação e imunossupressão.\n'
  '-Excluir sinais de DIP: dor pélvica, febre, dor à mobilização do colo.\n'
  '-Prescrever antifúngico tópico ou oral conforme gestação e preferência.\n'
  '-Orientar evitar duchas, absorvente interno prolongado e roupas íntimas sintéticas apertadas.\n'
  '-Reavaliar se não houver melhora em 7 dias; investigar recorrência (4 ou mais episódios ao ano).',
 'sinais_alerta':
  '-Dor pélvica\n-Febre\n-Dor à mobilização do colo uterino\n-Sangramento vaginal anormal\n'
  '-Corrimento com odor fétido\n-Recorrência frequente\n-Gestação\n-Diabetes descompensado\n-Imunossupressão',
 'criterios_encaminhamento':
  '-Encaminhar à emergência ou ginecologia se houver suspeita de DIP.\n'
  '-Encaminhar à ginecologia em candidíase recorrente (4 ou mais episódios ao ano) ou refratária.\n'
  '-Encaminhar gestante para manejo específico.\n'
  '-Investigar diabetes e imunossupressão em quadros de repetição.\n'
  '-Reavaliar em 7 dias se não houver melhora.',
 'observacoes_clinicas':
  '-Candidíase não complicada não exige tratamento do parceiro.\n'
  '-Fluconazol oral é evitado na gestação; usar tópico.\n'
  '-Corrimento com odor fétido aponta para vaginose bacteriana, não candidíase.',
},

'VAGINOSE BACTERIANA — ADULTO': {
 'especialidade': G, 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Desequilíbrio da flora vaginal, com redução de lactobacilos e predomínio de anaeróbios, especialmente Gardnerella vaginalis.\n'
  '-Cursa com corrimento acinzentado, homogêneo e odor fétido, tipicamente pior após relação sexual.\n'
  '-O pH vaginal é maior que 4,5 e o teste das aminas costuma ser positivo.\n'
  '-Prurido e inflamação vulvar são discretos ou ausentes, diferente da candidíase.\n'
  '-Associa-se a maior risco de complicações em gestantes e de aquisição de ISTs.',
 'quando_usar':
  '-Mulher adulta com corrimento acinzentado de odor fétido, sem sinais inflamatórios importantes.\n'
  '-Quadro sem dor pélvica, febre ou sinais de DIP.\n'
  '-Uso em APS e ambulatório para tratamento oral ou vaginal.',
 'quando_nao_usar':
  '-Não tratar como vaginose se houver dor pélvica, febre ou dor à mobilização do colo: avaliar DIP.\n'
  '-Não ignorar gestação: o tratamento tem particularidades e o quadro tem impacto obstétrico.\n'
  '-Não confundir com tricomoníase, que é IST e exige tratamento do parceiro.\n'
  '-Não tratar parceiro de rotina na vaginose bacteriana isolada.',
 'conduta_procedimento':
  '-Caracterizar odor, aspecto e relação com o coito.\n'
  '-Aferir pH vaginal e realizar teste das aminas quando disponível.\n'
  '-Excluir sinais de DIP e avaliar necessidade de rastreio de outras ISTs.\n'
  '-Verificar gestação antes de definir o esquema.\n'
  '-Prescrever metronidazol oral ou tratamento vaginal conforme o caso.\n'
  '-Orientar abstinência alcoólica durante e após o uso de metronidazol e evitar duchas vaginais.\n'
  '-Reavaliar em 7 a 14 dias; investigar recorrência frequente.',
 'sinais_alerta':
  '-Dor pélvica\n-Febre\n-Dor à mobilização do colo uterino\n-Sangramento anormal\n-Gestação\n'
  '-Recorrência frequente\n-Falha após tratamento adequado\n-Suspeita de IST associada',
 'criterios_encaminhamento':
  '-Encaminhar se houver suspeita de DIP.\n'
  '-Encaminhar gestante para manejo obstétrico.\n'
  '-Encaminhar à ginecologia em recorrência frequente ou falha terapêutica.\n'
  '-Rastrear outras ISTs quando houver fator de risco.\n'
  '-Reavaliar em 7 a 14 dias.',
 'observacoes_clinicas':
  '-O odor fétido que piora após o coito é o dado clínico mais característico.\n'
  '-Não há indicação de tratar parceiro na vaginose bacteriana isolada.\n'
  '-Orientar abstinência alcoólica com metronidazol pelo efeito dissulfiram-símile.',
},

'TRICOMONÍASE — ADULTO': {
 'especialidade': GI, 'contexto': C, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Infecção sexualmente transmissível causada pelo protozoário Trichomonas vaginalis.\n'
  '-Cursa com corrimento amarelo-esverdeado, bolhoso, com odor, prurido e ardor; pode haver colo em framboesa.\n'
  '-Muitos casos são assintomáticos, especialmente em homens.\n'
  '-Por ser IST, exige tratamento do parceiro e rastreio de outras infecções.\n'
  '-Associa-se a desfechos adversos na gestação.',
 'quando_usar':
  '-Adulto com corrimento amarelo-esverdeado, prurido e ardor, com ou sem odor.\n'
  '-Diagnóstico clínico ou laboratorial de tricomoníase.\n'
  '-Uso em APS e ambulatório para tratamento do caso e do parceiro.',
 'quando_nao_usar':
  '-Não tratar apenas a paciente: sem tratar o parceiro a reinfecção é frequente.\n'
  '-Não deixar de rastrear outras ISTs, incluindo HIV, sífilis e hepatites.\n'
  '-Não tratar como vaginose ou candidíase, que têm manejo diferente.\n'
  '-Não ignorar dor pélvica e febre, que sugerem DIP.',
 'conduta_procedimento':
  '-Caracterizar corrimento, prurido, ardor, dispareunia e sintomas urinários.\n'
  '-Examinar colo e vagina; avaliar pH e exame a fresco quando disponível.\n'
  '-Excluir DIP e avaliar gestação.\n'
  '-Prescrever tratamento para a paciente e para o parceiro, mesmo assintomático.\n'
  '-Oferecer rastreio de HIV, sífilis, hepatites B e C, e clamídia e gonococo quando disponível.\n'
  '-Orientar abstinência sexual até o fim do tratamento e abstinência alcoólica com nitroimidazólicos.\n'
  '-Reavaliar em 7 a 14 dias.',
 'sinais_alerta':
  '-Dor pélvica\n-Febre\n-Dor à mobilização do colo\n-Sangramento anormal\n-Gestação\n'
  '-Reinfecção de repetição\n-Parceiro não tratado\n-Coinfecção com outra IST',
 'criterios_encaminhamento':
  '-Encaminhar se houver suspeita de DIP.\n'
  '-Encaminhar gestante para manejo obstétrico.\n'
  '-Encaminhar ao serviço de ISTs para rastreio e acompanhamento quando indicado.\n'
  '-Encaminhar em falha terapêutica ou reinfecção recorrente.\n'
  '-Reavaliar em 7 a 14 dias.',
 'observacoes_clinicas':
  '-Tricomoníase é IST: tratar o parceiro é parte do tratamento.\n'
  '-Rastrear outras ISTs sempre que houver diagnóstico confirmado.\n'
  '-Orientar abstinência alcoólica durante o uso de nitroimidazólicos.',
},

'VAGINITE MISTA — ADULTO': {
 'especialidade': G, 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Quadro em que coexistem mais de um agente vaginal, tipicamente Candida associada a anaeróbios ou a tricomonas.\n'
  '-Manifesta-se com corrimento de características mistas, prurido e odor, sem predomínio claro de um padrão.\n'
  '-O tratamento combinado busca cobrir os agentes envolvidos em um único esquema.\n'
  '-A confirmação laboratorial ajuda a evitar tratamento desnecessário e recorrências.',
 'quando_usar':
  '-Mulher adulta com corrimento de características sobrepostas, sem definição clara entre candidíase, vaginose e tricomoníase.\n'
  '-Quadro sem sinais de DIP, em paciente estável.\n'
  '-Uso em APS e ambulatório quando se opta por cobertura combinada.',
 'quando_nao_usar':
  '-Não usar como tratamento empírico padrão para toda queixa de corrimento.\n'
  '-Não tratar sem excluir DIP quando houver dor pélvica, febre ou dor à mobilização do colo.\n'
  '-Não ignorar gestação, que muda as opções terapêuticas.\n'
  '-Não deixar de tratar o parceiro se houver tricomoníase confirmada.',
 'conduta_procedimento':
  '-Caracterizar cor, odor, consistência do corrimento, prurido e ardor.\n'
  '-Aferir pH e realizar exame a fresco ou coleta quando disponível.\n'
  '-Excluir DIP e verificar gestação.\n'
  '-Optar por esquema combinado quando não for possível definir o agente e o quadro justificar.\n'
  '-Avaliar rastreio de ISTs conforme risco.\n'
  '-Orientar medidas de higiene, evitar duchas e abstinência alcoólica se usar nitroimidazólico.\n'
  '-Reavaliar em 7 a 14 dias.',
 'sinais_alerta':
  '-Dor pélvica\n-Febre\n-Dor à mobilização do colo\n-Sangramento anormal\n-Gestação\n'
  '-Recorrência frequente\n-Falha terapêutica\n-Úlcera genital associada',
 'criterios_encaminhamento':
  '-Encaminhar se houver suspeita de DIP ou úlcera genital.\n'
  '-Encaminhar gestante para manejo específico.\n'
  '-Encaminhar à ginecologia em recorrência ou falha terapêutica.\n'
  '-Reavaliar em 7 a 14 dias.',
 'observacoes_clinicas':
  '-Confirmar o agente sempre que possível reduz tratamento desnecessário e recorrência.\n'
  '-O esquema combinado é útil quando a definição do agente não é viável no momento.\n'
  '-Corrimento persistente após tratamento exige reavaliação e não repetição automática.',
},

'DOENÇA INFLAMATÓRIA PÉLVICA (DIP) — ADULTO': {
 'especialidade': GI, 'contexto': CP, 'nivel_risco': ['Moderado', 'Alto'],
 'resumo_clinico':
  '-Infecção do trato genital superior feminino, envolvendo útero, tubas e estruturas adjacentes.\n'
  '-Os agentes mais frequentes são Chlamydia trachomatis e Neisseria gonorrhoeae, com participação de anaeróbios.\n'
  '-O diagnóstico é clínico: dor pélvica associada a dor à mobilização do colo, dor uterina ou anexial.\n'
  '-O tratamento deve ser iniciado precocemente e cobrir gonococo, clamídia e anaeróbios.\n'
  '-O atraso terapêutico aumenta o risco de infertilidade, gravidez ectópica e dor pélvica crônica.',
 'quando_usar':
  '-Mulher com dor pélvica e dor à mobilização do colo, dor uterina ou anexial ao exame.\n'
  '-Quadro sem sinais de abdome agudo cirúrgico e sem instabilidade hemodinâmica.\n'
  '-Uso em APS, ambulatório e pronto atendimento para iniciar antibioticoterapia empírica.\n'
  '-Sempre associado a rastreio de ISTs e tratamento do parceiro.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente se houver febre alta, vômitos incoercíveis, suspeita de abscesso tubo-ovariano, gestação ou falha do tratamento oral.\n'
  '-Não postergar antibiótico aguardando confirmação laboratorial.\n'
  '-Não afastar gravidez ectópica sem beta-HCG em mulher em idade fértil com dor pélvica.\n'
  '-Não deixar de considerar apendicite, torção anexial e outras causas cirúrgicas.\n'
  '-Não tratar sem orientar tratamento do parceiro e abstinência sexual.',
 'conduta_procedimento':
  '-Avaliar sinais vitais, temperatura, estado geral e sinais de irritação peritoneal.\n'
  '-Realizar exame ginecológico com pesquisa de dor à mobilização do colo, dor uterina e anexial.\n'
  '-Solicitar beta-HCG obrigatoriamente em mulher em idade fértil.\n'
  '-Solicitar hemograma, PCR e rastreio de ISTs (HIV, sífilis, hepatites); coletar material cervical quando disponível.\n'
  '-Considerar ultrassom pélvico se houver suspeita de abscesso tubo-ovariano, massa anexial ou dúvida diagnóstica.\n'
  '-Iniciar antibioticoterapia empírica cobrindo gonococo, clamídia e anaeróbios.\n'
  '-Orientar tratamento do parceiro, abstinência sexual até o término e retirada de DIU apenas conforme avaliação especializada.\n'
  '-Reavaliar em 48 a 72 horas: ausência de melhora indica internação e reavaliação.',
 'sinais_alerta':
  '-Febre alta\n-Vômitos incoercíveis\n-Irritação peritoneal\n-Massa anexial palpável\n-Hipotensão\n'
  '-Taquicardia\n-Beta-HCG positivo\n-Suspeita de abscesso tubo-ovariano\n-Falha do tratamento oral em 72 horas\n'
  '-Imunossupressão\n-Uso de DIU com quadro grave',
 'criterios_encaminhamento':
  '-Encaminhar à emergência se houver febre alta, vômitos, irritação peritoneal, instabilidade ou suspeita de abscesso tubo-ovariano.\n'
  '-Encaminhar imediatamente se o beta-HCG for positivo, para excluir gravidez ectópica.\n'
  '-Encaminhar se não houver melhora em 48 a 72 horas de tratamento oral.\n'
  '-Encaminhar à ginecologia para seguimento, discussão sobre DIU e rastreio de complicações.\n'
  '-Encaminhar ao serviço de ISTs para rastreio e tratamento de parceiros.',
 'observacoes_clinicas':
  '-O diagnóstico é clínico e o tratamento deve ser iniciado precocemente: o atraso aumenta sequelas reprodutivas.\n'
  '-Beta-HCG é obrigatório para excluir gravidez ectópica.\n'
  '-A cobertura empírica deve incluir gonococo, clamídia e anaeróbios.\n'
  '-Tratar o parceiro e rastrear outras ISTs faz parte do manejo.',
},

'CERVICITE E URETRITE — ADULTO': {
 'especialidade': GI, 'contexto': CP, 'nivel_risco': ['Moderado'],
 'resumo_clinico':
  '-Inflamação do colo uterino ou da uretra, na maioria das vezes por Chlamydia trachomatis e Neisseria gonorrhoeae.\n'
  '-Cursa com corrimento mucopurulento, disúria, sangramento pós-coito e, com frequência, é assintomática.\n'
  '-O tratamento é empírico e cobre simultaneamente gonococo e clamídia.\n'
  '-Sem tratamento, pode evoluir para DIP na mulher e epididimite no homem.\n'
  '-Exige rastreio de outras ISTs e tratamento do parceiro.',
 'quando_usar':
  '-Adulto com corrimento uretral ou cervical mucopurulento, disúria ou sangramento pós-coito.\n'
  '-Parceiro de caso confirmado de gonococo ou clamídia.\n'
  '-Uso em APS, ambulatório e pronto atendimento para tratamento empírico e rastreio.',
 'quando_nao_usar':
  '-Não tratar como cervicite simples se houver dor pélvica, febre ou dor à mobilização do colo: manejar como DIP.\n'
  '-Não tratar apenas o paciente: o parceiro precisa ser tratado.\n'
  '-Não deixar de rastrear HIV, sífilis e hepatites.\n'
  '-Não ignorar dor testicular, que sugere epididimite e exige avaliação.',
 'conduta_procedimento':
  '-Caracterizar corrimento, disúria, dispareunia, sangramento e tempo de evolução.\n'
  '-Realizar exame ginecológico ou urológico; coletar material quando disponível.\n'
  '-Excluir DIP na mulher e epididimite ou orquite no homem.\n'
  '-Solicitar beta-HCG em mulher em idade fértil quando pertinente.\n'
  '-Iniciar tratamento empírico cobrindo gonococo e clamídia.\n'
  '-Oferecer rastreio de HIV, sífilis e hepatites B e C.\n'
  '-Orientar tratamento do parceiro, abstinência sexual durante o tratamento e uso de preservativo.\n'
  '-Reavaliar em 7 dias; investigar reinfecção se houver recorrência.',
 'sinais_alerta':
  '-Dor pélvica\n-Febre\n-Dor à mobilização do colo\n-Dor ou aumento testicular\n-Gestação\n'
  '-Úlcera genital associada\n-Artrite ou lesões cutâneas (infecção gonocócica disseminada)\n'
  '-Falha terapêutica\n-Parceiro não tratado',
 'criterios_encaminhamento':
  '-Encaminhar se houver suspeita de DIP, epididimite ou infecção gonocócica disseminada.\n'
  '-Encaminhar gestante para manejo obstétrico.\n'
  '-Encaminhar ao serviço de ISTs para rastreio, notificação e tratamento de parceiros.\n'
  '-Encaminhar em falha terapêutica ou recorrência.\n'
  '-Reavaliar em 7 dias.',
 'observacoes_clinicas':
  '-O tratamento empírico deve cobrir gonococo e clamídia simultaneamente.\n'
  '-Grande parte dos casos é assintomática, o que reforça o rastreio de parceiros.\n'
  '-Cervicite não tratada é causa importante de DIP e sequela reprodutiva.',
},
}

if __name__ == '__main__':
    executar(CLINICOS)

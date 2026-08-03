# -*- coding: utf-8 -*-
"""Lote 08 — dor musculoesquelética, ORL e respiratório."""
from create_new import executar

MSK = ['Ortopedia', 'Clínica Médica', 'APS', 'Medicina de Família']
ORL = ['Otorrinolaringologia', 'Clínica Médica', 'APS', 'Medicina de Família']
C = ['Adulto', 'APS', 'Ambulatorial']
CP = ['Adulto', 'APS', 'Ambulatorial', 'PS']

LOMB_ALERTA = (
 '-Déficit motor progressivo\n-Anestesia em sela\n-Retenção ou incontinência urinária\n'
 '-Incontinência fecal\n-Febre\n-Perda de peso não intencional\n-História de câncer\n'
 '-Uso de drogas injetáveis\n-Imunossupressão\n-Trauma significativo\n-Dor noturna progressiva\n'
 '-Idade acima de 50 anos com dor de início recente\n-Uso crônico de corticoide')

LOMB_ENCAM = (
 '-Encaminhar à emergência em suspeita de síndrome da cauda equina: anestesia em sela, retenção urinária ou déficit progressivo.\n'
 '-Encaminhar com urgência se houver febre, perda de peso, história de câncer ou suspeita de infecção espinhal.\n'
 '-Encaminhar à ortopedia ou neurocirurgia em déficit neurológico persistente ou dor refratária após 4 a 6 semanas.\n'
 '-Encaminhar para reabilitação se houver limitação funcional persistente.\n'
 '-Reavaliar em 2 a 4 semanas.')

CLINICOS = {
'DOR MUSCULAR / LOMBALGIA — ADULTO': {
 'especialidade': MSK, 'contexto': CP, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Dor lombar de origem musculoesquelética, sem doença sistêmica subjacente na maioria dos casos.\n'
  '-A dor mecânica piora com movimento e melhora com repouso, sem irradiação em padrão radicular.\n'
  '-A evolução costuma ser favorável em semanas, com melhora significativa na maior parte dos pacientes.\n'
  '-Repouso prolongado piora o prognóstico: manter atividade conforme tolerância é parte do tratamento.\n'
  '-Exame de imagem de rotina não é indicado na ausência de sinais de alerta.',
 'quando_usar':
  '-Adulto com dor lombar ou muscular de padrão mecânico, sem sinais de alerta.\n'
  '-Dor após esforço, postura inadequada ou movimento brusco.\n'
  '-Uso em APS, ambulatório e pronto atendimento para analgesia e orientação.',
 'quando_nao_usar':
  '-Não tratar como lombalgia mecânica se houver déficit motor progressivo, anestesia em sela ou alteração esfincteriana.\n'
  '-Não ignorar febre, perda de peso, história de câncer, imunossupressão ou uso de drogas injetáveis.\n'
  '-Não solicitar imagem de rotina sem sinais de alerta.\n'
  '-Não indicar repouso prolongado no leito.\n'
  '-Não usar anti-inflamatório sem cautela em doença renal, gastrite, úlcera, anticoagulação ou hipertensão descompensada.',
 'conduta_procedimento':
  '-Caracterizar início, fator desencadeante, irradiação, padrão mecânico ou inflamatório e impacto funcional.\n'
  '-Pesquisar ativamente sinais de alerta: déficit, alteração esfincteriana, febre, perda de peso e câncer prévio.\n'
  '-Realizar exame neurológico de membros inferiores, incluindo força, sensibilidade, reflexos e Lasegue.\n'
  '-Evitar exame de imagem se não houver sinal de alerta.\n'
  '-Prescrever analgesia escalonada, com anti-inflamatório e relaxante muscular conforme o caso e as contraindicações.\n'
  '-Orientar manutenção da atividade conforme tolerância e retorno gradual às tarefas habituais.\n'
  '-Discutir ergonomia, fortalecimento e controle de peso na fase de recuperação.\n'
  '-Reavaliar em 2 a 4 semanas ou antes se houver piora.',
 'sinais_alerta': LOMB_ALERTA,
 'criterios_encaminhamento': LOMB_ENCAM,
 'observacoes_clinicas':
  '-Manter atividade conforme tolerância melhora o prognóstico; repouso prolongado piora.\n'
  '-Imagem sem sinal de alerta não muda conduta e pode gerar achados incidentais.\n'
  '-Relaxante muscular tem efeito sedativo e deve ser usado por período curto.',
},

'DORSALGIA — ADULTO': {
 'especialidade': MSK, 'contexto': CP, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Dor na região dorsal, frequentemente de origem muscular ou postural, associada a sobrecarga e sedentarismo.\n'
  '-Também pode originar-se de causas viscerais referidas: cardíaca, pulmonar, biliar, pancreática e aórtica.\n'
  '-Dor mecânica, que muda com movimento e posição, favorece origem musculoesquelética.\n'
  '-O tratamento combina analgesia, medidas físicas e correção postural.\n'
  '-Dor torácica posterior de início súbito e intenso exige excluir causas graves antes de rotular como dorsalgia.',
 'quando_usar':
  '-Adulto com dor dorsal de padrão mecânico, relacionada a esforço, postura ou tensão muscular.\n'
  '-Ausência de sinais de alerta cardiovascular ou sistêmico.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não tratar como dorsalgia dor torácica de início súbito, em repouso, com sudorese, dispneia ou irradiação típica.\n'
  '-Não ignorar dor lancinante irradiada para dorso com assimetria de pulsos ou hipertensão grave: suspeitar de dissecção de aorta.\n'
  '-Não ignorar febre, perda de peso, história de câncer ou imunossupressão.\n'
  '-Não ignorar déficit neurológico ou alteração esfincteriana.\n'
  '-Não usar anti-inflamatório sem avaliar contraindicações.',
 'conduta_procedimento':
  '-Caracterizar a dor: início, intensidade, relação com movimento, respiração e esforço.\n'
  '-Avaliar sinais vitais, simetria de pulsos e ausculta cardiopulmonar.\n'
  '-Excluir causas viscerais quando o padrão não for claramente mecânico; considerar eletrocardiograma conforme risco.\n'
  '-Realizar exame da coluna, palpação de musculatura paravertebral e avaliação neurológica.\n'
  '-Prescrever analgesia e relaxante muscular conforme o caso, respeitando contraindicações.\n'
  '-Orientar calor local, alongamento e correção postural.\n'
  '-Reavaliar em 2 a 4 semanas ou antes se houver piora.',
 'sinais_alerta':
  '-Dor torácica de início súbito\n-Dor em repouso com sudorese\n-Dispneia\n-Irradiação para mandíbula ou membro superior\n'
  '-Assimetria de pulsos\n-Hipertensão grave com dor lancinante\n-Febre\n-Perda de peso\n'
  '-História de câncer\n-Déficit neurológico\n-Alteração esfincteriana',
 'criterios_encaminhamento':
  '-Encaminhar à emergência se houver suspeita de síndrome coronariana, dissecção de aorta ou tromboembolismo pulmonar.\n'
  '-Encaminhar com urgência se houver febre, perda de peso, câncer prévio ou déficit neurológico.\n'
  '-Encaminhar à ortopedia ou reabilitação em dor refratária após 4 a 6 semanas.\n'
  '-Reavaliar em 2 a 4 semanas.',
 'observacoes_clinicas':
  '-A primeira tarefa diante de dor dorsal é excluir causa visceral grave.\n'
  '-Dor que muda com movimento e palpação favorece origem musculoesquelética, mas não exclui causa visceral em paciente de risco.\n'
  '-Correção postural e fortalecimento reduzem recorrência.',
},

'CEFALEIA TENSIONAL — ADULTO': {
 'especialidade': ['Neurologia', 'Clínica Médica', 'APS', 'Medicina de Família'],
 'contexto': CP, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Cefaleia primária mais comum, com dor em pressão ou aperto, bilateral, de intensidade leve a moderada.\n'
  '-Não piora com atividade física rotineira e raramente cursa com náuseas ou fotofobia importantes.\n'
  '-Estresse, privação de sono, postura e tensão cervical são desencadeantes frequentes.\n'
  '-O tratamento agudo usa analgésico simples ou anti-inflamatório, por período limitado.\n'
  '-O uso excessivo de analgésicos pode gerar cefaleia por abuso de medicação.',
 'quando_usar':
  '-Adulto com cefaleia bilateral em pressão, sem sinais de alerta neurológico.\n'
  '-Padrão recorrente já conhecido, sem mudança recente de característica.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não tratar como cefaleia primária se houver início súbito e intensidade máxima em segundos (cefaleia em trovoada).\n'
  '-Não ignorar febre com rigidez de nuca, déficit neurológico, alteração visual ou papiledema.\n'
  '-Não ignorar cefaleia que muda de padrão, piora progressivamente ou desperta o paciente.\n'
  '-Não ignorar primeira cefaleia intensa após os 50 anos ou em imunossuprimido.\n'
  '-Não manter analgésico em uso frequente sem avaliar cefaleia por abuso de medicação.',
 'conduta_procedimento':
  '-Caracterizar localização, qualidade, intensidade, duração, frequência e fatores desencadeantes.\n'
  '-Pesquisar sinais de alerta e mudança de padrão.\n'
  '-Realizar exame neurológico e aferir pressão arterial.\n'
  '-Quantificar o uso de analgésicos por semana para identificar abuso de medicação.\n'
  '-Prescrever analgesia simples ou anti-inflamatório por período limitado.\n'
  '-Orientar higiene do sono, pausas, postura e manejo do estresse.\n'
  '-Considerar profilaxia se a frequência for alta, com acompanhamento.\n'
  '-Reavaliar em 4 semanas.',
 'sinais_alerta':
  '-Início súbito com intensidade máxima imediata\n-Febre com rigidez de nuca\n-Déficit neurológico focal\n'
  '-Alteração visual\n-Papiledema\n-Crise convulsiva\n-Confusão mental\n-Piora progressiva\n'
  '-Despertar noturno pela dor\n-Primeira cefaleia após os 50 anos\n-Imunossupressão\n-Câncer prévio',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em cefaleia em trovoada, febre com rigidez de nuca, déficit focal ou alteração visual.\n'
  '-Encaminhar à neurologia se houver mudança de padrão, piora progressiva ou refratariedade.\n'
  '-Encaminhar para manejo de cefaleia por abuso de medicação quando identificada.\n'
  '-Reavaliar em 4 semanas.',
 'observacoes_clinicas':
  '-Cefaleia tensional não piora com atividade física rotineira, diferente da enxaqueca.\n'
  '-Uso de analgésico em muitos dias do mês perpetua a dor por abuso de medicação.\n'
  '-Mudança de padrão em paciente com cefaleia crônica é sinal de alerta.',
},

'CERUME IMPACTADO — ADULTO': {
 'especialidade': ORL, 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Acúmulo de cerume que obstrui o conduto auditivo externo, causando hipoacusia, plenitude, zumbido e, às vezes, tontura.\n'
  '-O tratamento inclui ceruminolítico e, quando necessário, remoção por irrigação ou instrumentação.\n'
  '-A irrigação é contraindicada se houver suspeita de perfuração timpânica ou cirurgia otológica prévia.\n'
  '-O uso de cotonete empurra o cerume e favorece a impactação.',
 'quando_usar':
  '-Adulto com hipoacusia, plenitude auricular ou zumbido, com cerume obstruindo o conduto à otoscopia.\n'
  '-Necessidade de visualizar a membrana timpânica para avaliação.\n'
  '-Uso em APS e ambulatório.',
 'quando_nao_usar':
  '-Não irrigar se houver suspeita de perfuração timpânica, otorreia, cirurgia otológica prévia ou tubo de ventilação.\n'
  '-Não insistir em remoção instrumental sem visualização adequada.\n'
  '-Não ignorar otalgia intensa, otorreia purulenta ou febre, que sugerem otite.\n'
  '-Não ignorar hipoacusia súbita, que pode ser perda neurossensorial e exige avaliação urgente.\n'
  '-Não usar cotonete para remoção.',
 'conduta_procedimento':
  '-Realizar otoscopia bilateral e caracterizar o grau de obstrução.\n'
  '-Investigar cirurgia otológica prévia, perfuração conhecida, diabetes e imunossupressão.\n'
  '-Prescrever ceruminolítico por alguns dias antes da remoção quando indicado.\n'
  '-Remover por irrigação com água morna ou por instrumentação, conforme disponibilidade e segurança.\n'
  '-Reavaliar a membrana timpânica após a remoção.\n'
  '-Orientar não usar cotonete e retornar se houver dor, otorreia ou piora auditiva.',
 'sinais_alerta':
  '-Otalgia intensa\n-Otorreia purulenta\n-Febre\n-Sangramento após tentativa de remoção\n'
  '-Hipoacusia súbita\n-Vertigem importante\n-Perfuração timpânica conhecida\n-Cirurgia otológica prévia\n'
  '-Diabetes ou imunossupressão com dor desproporcional',
 'criterios_encaminhamento':
  '-Encaminhar à otorrinolaringologia se a remoção não for possível com segurança ou houver falha.\n'
  '-Encaminhar com urgência em hipoacusia súbita para investigação de perda neurossensorial.\n'
  '-Encaminhar se houver suspeita de perfuração, otite externa maligna ou complicação após tentativa de remoção.\n'
  '-Reavaliar após a remoção.',
 'observacoes_clinicas':
  '-Ceruminolítico previamente facilita a remoção e reduz trauma.\n'
  '-Irrigação é contraindicada quando há risco de perfuração.\n'
  '-Hipoacusia que persiste após a remoção completa exige investigação adicional.',
},

'AMIGDALITE / TONSILITE — ADULTO': {
 'especialidade': ORL, 'contexto': CP, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Inflamação das tonsilas palatinas, de origem viral na maior parte dos casos e bacteriana em uma parcela menor.\n'
  '-A etiologia estreptocócica é sugerida por febre, exsudato tonsilar, adenomegalia cervical dolorosa e ausência de tosse.\n'
  '-O antibiótico reduz sintomas, transmissão e o risco de complicações supurativas e de febre reumática.\n'
  '-Trismo, voz abafada e desvio de úvula sugerem abscesso peritonsilar.\n'
  '-Dificuldade respiratória, sialorreia e dor desproporcional exigem avaliação urgente de via aérea.',
 'quando_usar':
  '-Adulto com dor de garganta, febre e alterações tonsilares.\n'
  '-Suspeita de etiologia bacteriana pelos critérios clínicos.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente se houver dificuldade respiratória, sialorreia, estridor ou incapacidade de engolir saliva.\n'
  '-Não ignorar trismo, voz abafada ou desvio de úvula: suspeitar de abscesso peritonsilar.\n'
  '-Não prescrever antibiótico de rotina quando o quadro é claramente viral.\n'
  '-Não usar amoxicilina sem considerar mononucleose, pelo risco de exantema.\n'
  '-Não ignorar desidratação por odinofagia intensa.',
 'conduta_procedimento':
  '-Caracterizar febre, odinofagia, tosse, coriza e tempo de evolução.\n'
  '-Examinar orofaringe, tonsilas, úvula e cadeias cervicais; avaliar trismo e voz.\n'
  '-Aplicar critérios clínicos para estimar probabilidade de etiologia estreptocócica.\n'
  '-Realizar teste rápido para estreptococo quando disponível.\n'
  '-Prescrever antibiótico quando houver indicação, com analgesia e hidratação em todos os casos.\n'
  '-Orientar retorno imediato se houver dificuldade para respirar, engolir saliva ou piora da dor.\n'
  '-Reavaliar em 48 a 72 horas se não houver melhora.',
 'sinais_alerta':
  '-Dificuldade respiratória\n-Estridor\n-Sialorreia\n-Incapacidade de engolir saliva\n-Trismo\n'
  '-Voz abafada\n-Desvio de úvula\n-Abaulamento de palato\n-Rigidez de nuca\n-Desidratação\n'
  '-Febre alta persistente após 72 horas de antibiótico\n-Imunossupressão',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em dificuldade respiratória, sialorreia, estridor ou suspeita de comprometimento de via aérea.\n'
  '-Encaminhar com urgência em suspeita de abscesso peritonsilar.\n'
  '-Encaminhar se houver desidratação com incapacidade de ingestão oral.\n'
  '-Encaminhar à otorrinolaringologia em amigdalites de repetição para discutir indicação cirúrgica.\n'
  '-Reavaliar em 48 a 72 horas.',
 'observacoes_clinicas':
  '-A maior parte dos casos é viral e não se beneficia de antibiótico.\n'
  '-Amoxicilina em mononucleose causa exantema característico e deve ser evitada quando há suspeita.\n'
  '-Trismo com voz abafada é sinal de abscesso peritonsilar até prova em contrário.',
},

'AMIGDALITE / TONSILITE — CRIANÇA': {
 'especialidade': ['Pediatria', 'Otorrinolaringologia', 'APS'],
 'contexto': ['Pediatria', 'APS', 'Ambulatorial', 'PS'],
 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Faringoamigdalite é muito frequente na infância e majoritariamente viral, sobretudo abaixo dos 3 anos.\n'
  '-A etiologia estreptocócica é mais provável entre 5 e 15 anos, com febre, exsudato, adenomegalia dolorosa e ausência de tosse.\n'
  '-O antibiótico previne febre reumática e reduz complicações supurativas quando a origem é estreptocócica.\n'
  '-As doses são calculadas por peso e a duração completa do esquema é essencial.\n'
  '-Sinais de obstrução de via aérea, desidratação ou prostração exigem avaliação imediata.',
 'quando_usar':
  '-Criança com dor de garganta, febre e alterações tonsilares.\n'
  '-Suspeita clínica de etiologia estreptocócica na faixa etária compatível.\n'
  '-Uso em APS, ambulatório e pronto atendimento pediátrico.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente se houver dificuldade respiratória, estridor, sialorreia ou prostração importante.\n'
  '-Não prescrever antibiótico de rotina em quadro claramente viral, especialmente em menores de 3 anos.\n'
  '-Não usar dose de adulto: calcular por peso.\n'
  '-Não interromper o antibiótico antes do término do esquema.\n'
  '-Não ignorar desidratação por recusa alimentar e de líquidos.',
 'conduta_procedimento':
  '-Caracterizar febre, odinofagia, coriza, tosse, aceitação alimentar e diurese.\n'
  '-Examinar orofaringe, tonsilas, cadeias cervicais e avaliar hidratação e estado geral.\n'
  '-Aplicar critérios clínicos conforme a idade e usar teste rápido quando disponível.\n'
  '-Conferir peso para cálculo das doses.\n'
  '-Prescrever antibiótico quando indicado, com antitérmico e analgesia em todos os casos.\n'
  '-Orientar hidratação, dieta conforme aceitação e sinais de retorno imediato.\n'
  '-Reavaliar em 48 a 72 horas se não houver melhora.',
 'sinais_alerta':
  '-Dificuldade respiratória\n-Estridor\n-Sialorreia\n-Recusa total de líquidos\n-Desidratação\n'
  '-Prostração\n-Sonolência excessiva\n-Rigidez de nuca\n-Petéquias\n-Abaulamento de palato\n'
  '-Febre alta persistente após 72 horas de antibiótico',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em dificuldade respiratória, estridor, sialorreia, desidratação ou prostração.\n'
  '-Encaminhar com urgência em suspeita de abscesso peritonsilar ou retrofaríngeo.\n'
  '-Encaminhar à otorrinolaringologia pediátrica em amigdalites de repetição ou apneia obstrutiva do sono.\n'
  '-Reavaliar em 48 a 72 horas.',
 'observacoes_clinicas':
  '-Abaixo de 3 anos a etiologia estreptocócica é incomum e o antibiótico raramente é necessário.\n'
  '-A dose por peso e a duração completa do esquema previnem febre reumática.\n'
  '-Recusa de líquidos com desidratação é motivo frequente de reavaliação em pronto atendimento.',
},

'SÍNDROME GRIPAL VIRAL — ADULTO': {
 'especialidade': ['Clínica Médica', 'Infectologia', 'APS', 'Medicina de Emergência'],
 'contexto': CP, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Quadro respiratório agudo com febre, tosse, dor de garganta, coriza, mialgia e cefaleia.\n'
  '-A maioria dos casos é viral, autolimitada e tratada com sintomáticos e hidratação.\n'
  '-Antibiótico não tem indicação na síndrome gripal viral não complicada.\n'
  '-Grupos de risco podem se beneficiar de antiviral específico quando indicado precocemente.\n'
  '-Dispneia, queda de saturação e piora após melhora inicial sugerem complicação.',
 'quando_usar':
  '-Adulto com quadro gripal agudo, sem sinais de gravidade.\n'
  '-Paciente estável, com boa saturação e sem dispneia.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente se houver dispneia, saturação reduzida, confusão, hipotensão ou cianose.\n'
  '-Não prescrever antibiótico de rotina para quadro viral.\n'
  '-Não ignorar piora após melhora inicial, que sugere infecção bacteriana secundária.\n'
  '-Não ignorar grupos de risco: idoso, gestante, puérpera, imunossuprimido, cardiopata, pneumopata e obeso.\n'
  '-Não usar anti-inflamatório sem cautela quando houver suspeita de dengue concomitante.',
 'conduta_procedimento':
  '-Caracterizar início dos sintomas, febre, tosse, dispneia e contatos.\n'
  '-Aferir sinais vitais, incluindo saturação de oxigênio e frequência respiratória.\n'
  '-Auscultar tórax e avaliar sinais de esforço respiratório.\n'
  '-Identificar pertencimento a grupo de risco para indicação de antiviral.\n'
  '-Prescrever sintomáticos, hidratação e repouso.\n'
  '-Considerar antiviral em grupos de risco, iniciado o mais precocemente possível.\n'
  '-Orientar isolamento respiratório domiciliar e etiqueta de tosse.\n'
  '-Orientar retorno imediato em caso de dispneia, queda de saturação ou piora após melhora.',
 'sinais_alerta':
  '-Dispneia\n-Saturação reduzida\n-Frequência respiratória elevada\n-Cianose\n-Confusão mental\n'
  '-Hipotensão\n-Dor torácica\n-Piora após melhora inicial\n-Febre persistente por mais de 5 a 7 dias\n'
  '-Desidratação\n-Gestação ou puerpério\n-Imunossupressão',
 'criterios_encaminhamento':
  '-Encaminhar à emergência em dispneia, queda de saturação, confusão, hipotensão ou cianose.\n'
  '-Encaminhar se houver piora após melhora inicial ou febre persistente com suspeita de pneumonia.\n'
  '-Encaminhar gestante, puérpera ou imunossuprimido com sinais de agravamento.\n'
  '-Reavaliar em 48 a 72 horas se não houver melhora.',
 'observacoes_clinicas':
  '-Antibiótico não trata quadro viral e favorece resistência.\n'
  '-Antiviral tem maior benefício quando iniciado nas primeiras 48 horas em grupo de risco.\n'
  '-Piora após melhora inicial é o padrão clássico de infecção bacteriana secundária.',
},

'TOSSE SECA PERSISTENTE — ADULTO': {
 'especialidade': ['Pneumologia', 'Clínica Médica', 'APS', 'Otorrinolaringologia'],
 'contexto': C, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Tosse seca que persiste além do período esperado de uma infecção viral aguda.\n'
  '-As causas mais frequentes em não fumantes são gotejamento pós-nasal, asma e refluxo gastroesofágico.\n'
  '-Inibidores da enzima conversora de angiotensina são causa medicamentosa comum e reversível.\n'
  '-A investigação é escalonada: identificar e tratar a causa é mais eficaz que suprimir a tosse.\n'
  '-Tosse com hemoptise, perda de peso ou febre prolongada exige investigação de tuberculose e neoplasia.',
 'quando_usar':
  '-Adulto com tosse seca persistente, sem sinais de gravidade.\n'
  '-Necessidade de alívio sintomático enquanto se investiga a causa.\n'
  '-Uso em APS e ambulatório.',
 'quando_nao_usar':
  '-Não tratar apenas sintomaticamente se houver hemoptise, perda de peso, febre prolongada ou sudorese noturna.\n'
  '-Não ignorar dispneia progressiva, dor torácica ou queda de saturação.\n'
  '-Não manter inibidor da enzima conversora de angiotensina sem considerar troca quando ele for a causa provável.\n'
  '-Não ignorar tabagismo com mudança do padrão da tosse.\n'
  '-Não usar antitussígeno em tosse produtiva com secreção abundante.',
 'conduta_procedimento':
  '-Caracterizar duração, padrão, fatores desencadeantes, tosse noturna e sintomas associados.\n'
  '-Revisar medicamentos, sobretudo inibidores da enzima conversora de angiotensina.\n'
  '-Investigar sintomas de rinite, asma e refluxo.\n'
  '-Aferir sinais vitais, saturação e auscultar tórax.\n'
  '-Solicitar radiografia de tórax quando houver sinal de alerta, tabagismo ou tosse prolongada.\n'
  '-Investigar tuberculose conforme epidemiologia e sintomas.\n'
  '-Tratar a causa identificada e usar sintomático por período limitado.\n'
  '-Reavaliar em 2 a 4 semanas.',
 'sinais_alerta':
  '-Hemoptise\n-Perda de peso não intencional\n-Febre prolongada\n-Sudorese noturna\n-Dispneia progressiva\n'
  '-Dor torácica\n-Queda de saturação\n-Rouquidão persistente\n-Disfagia\n-Tabagismo com mudança do padrão da tosse\n'
  '-Imunossupressão\n-Contato com tuberculose',
 'criterios_encaminhamento':
  '-Encaminhar para investigação de tuberculose se houver tosse prolongada com febre, sudorese noturna ou perda de peso.\n'
  '-Encaminhar com urgência em hemoptise ou suspeita de neoplasia.\n'
  '-Encaminhar à pneumologia em tosse refratária após tratamento das causas comuns.\n'
  '-Encaminhar à otorrinolaringologia se houver rouquidão persistente.\n'
  '-Reavaliar em 2 a 4 semanas.',
 'observacoes_clinicas':
  '-Identificar e tratar a causa é mais eficaz do que suprimir a tosse.\n'
  '-Inibidor da enzima conversora de angiotensina é causa frequente, reversível e frequentemente esquecida.\n'
  '-Tosse prolongada em contexto epidemiológico compatível exige investigar tuberculose.',
},
}

if __name__ == '__main__':
    executar(CLINICOS)

# -*- coding: utf-8 -*-
"""Lote 05 — ginecologia (ciclo/mama), sífilis, PEP, herpes."""
from create_new import executar

G = ['Ginecologia', 'Clínica Médica', 'APS', 'Medicina de Família']
GI = ['Infectologia', 'Clínica Médica', 'APS', 'Ginecologia']
C = ['Adulto', 'APS', 'Ambulatorial']
CP = ['Adulto', 'APS', 'Ambulatorial', 'PS']

CLINICOS = {
'DISMENORREIA — ADULTO': {
 'especialidade': G, 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Dor pélvica cíclica relacionada à menstruação, tipicamente em cólica, no baixo ventre, com irradiação lombar ou para coxas.\n'
  '-A forma primária não tem doença pélvica associada e decorre do aumento de prostaglandinas endometriais.\n'
  '-A forma secundária tem causa identificável: endometriose, adenomiose, miomas, DIP ou uso de DIU.\n'
  '-Anti-inflamatórios são o tratamento de primeira linha; contraceptivos hormonais são opção de manutenção.\n'
  '-Início após os 25 anos, piora progressiva ou dor fora do período menstrual sugerem causa secundária.',
 'quando_usar':
  '-Mulher adulta com cólica menstrual recorrente, sem sinais de doença pélvica.\n'
  '-Dor que responde parcialmente a analgésicos comuns e limita atividades.\n'
  '-Uso em APS e ambulatório para analgesia e discussão de manutenção hormonal.',
 'quando_nao_usar':
  '-Não tratar apenas sintomaticamente se houver dor progressiva, dispareunia profunda, infertilidade ou dor fora do ciclo: investigar endometriose.\n'
  '-Não ignorar febre, corrimento purulento ou dor à mobilização do colo: avaliar DIP.\n'
  '-Não usar anti-inflamatório sem cautela em doença renal, gastrite, úlcera, anticoagulação ou hipertensão descompensada.\n'
  '-Não descartar gravidez ectópica em dor pélvica aguda com atraso menstrual.',
 'conduta_procedimento':
  '-Caracterizar início, relação com o ciclo, intensidade, irradiação e impacto funcional.\n'
  '-Investigar dispareunia, sangramento intenso, infertilidade e sintomas intestinais ou urinários cíclicos.\n'
  '-Excluir gravidez com beta-HCG quando houver atraso ou dúvida.\n'
  '-Avaliar sinais de DIP e realizar exame ginecológico conforme o caso.\n'
  '-Prescrever anti-inflamatório iniciado no começo dos sintomas, respeitando contraindicações.\n'
  '-Discutir contraceptivo hormonal como manutenção quando houver recorrência importante.\n'
  '-Solicitar ultrassom pélvico se houver suspeita de causa secundária.\n'
  '-Reavaliar em 2 a 3 ciclos.',
 'sinais_alerta':
  '-Dor progressiva ao longo dos ciclos\n-Dor fora do período menstrual\n-Dispareunia profunda\n'
  '-Infertilidade\n-Sangramento muito intenso\n-Febre\n-Corrimento purulento\n-Massa pélvica\n'
  '-Início após os 25 anos\n-Atraso menstrual com dor aguda',
 'criterios_encaminhamento':
  '-Encaminhar à ginecologia se houver suspeita de endometriose, adenomiose ou mioma sintomático.\n'
  '-Encaminhar à emergência em dor aguda intensa, suspeita de gravidez ectópica ou abdome agudo.\n'
  '-Encaminhar se não houver resposta após 2 a 3 ciclos de tratamento adequado.\n'
  '-Encaminhar se houver sinais de DIP.',
 'observacoes_clinicas':
  '-Iniciar o anti-inflamatório no começo dos sintomas melhora a resposta.\n'
  '-Dismenorreia que começa após os 25 anos ou piora progressivamente sugere causa secundária.\n'
  '-Contraceptivo hormonal é opção eficaz de manutenção quando há recorrência.',
},

'AMENORREIA SECUNDÁRIA — ADULTO': {
 'especialidade': G, 'contexto': C, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Ausência de menstruação por 3 ciclos consecutivos ou 6 meses em mulher que já menstruava.\n'
  '-A primeira causa a excluir é sempre a gestação.\n'
  '-Outras causas incluem síndrome dos ovários policísticos, disfunção tireoidiana, hiperprolactinemia, amenorreia hipotalâmica e insuficiência ovariana.\n'
  '-O teste com progestágeno ajuda a avaliar impregnação estrogênica e integridade do trato de saída.\n'
  '-A investigação é escalonada e orientada pela história e pelo exame.',
 'quando_usar':
  '-Mulher em idade fértil com ausência de menstruação por 3 ciclos ou 6 meses, com gestação já excluída.\n'
  '-Uso em APS e ambulatório para investigação inicial e teste com progestágeno.',
 'quando_nao_usar':
  '-Não iniciar investigação nem progestágeno sem excluir gestação com beta-HCG.\n'
  '-Não ignorar galactorreia, cefaleia ou alteração visual: sugerem prolactinoma.\n'
  '-Não ignorar perda de peso acentuada, exercício extenuante ou transtorno alimentar.\n'
  '-Não ignorar sinais de hiperandrogenismo importante ou virilização, que exigem investigação específica.\n'
  '-Não ignorar história de curetagem ou infecção uterina, que sugere sinéquias.',
 'conduta_procedimento':
  '-Solicitar beta-HCG antes de qualquer conduta.\n'
  '-Caracterizar padrão menstrual prévio, uso de contraceptivo, peso, exercício, estresse e medicamentos.\n'
  '-Investigar galactorreia, cefaleia, alteração visual, sintomas tireoidianos, hirsutismo e acne.\n'
  '-Solicitar TSH e prolactina; considerar FSH, LH, estradiol e testosterona conforme a hipótese.\n'
  '-Realizar teste com progestágeno para avaliar impregnação estrogênica e trato de saída.\n'
  '-Solicitar ultrassom pélvico quando indicado.\n'
  '-Encaminhar conforme a causa identificada e orientar retorno com os exames.',
 'sinais_alerta':
  '-Galactorreia\n-Cefaleia persistente\n-Alteração de campo visual\n-Virilização\n-Perda de peso acentuada\n'
  '-Transtorno alimentar\n-Sintomas de hipoestrogenismo em mulher jovem\n-História de curetagem ou infecção uterina\n'
  '-Sinais de doença tireoidiana importante',
 'criterios_encaminhamento':
  '-Encaminhar à endocrinologia se houver hiperprolactinemia, disfunção tireoidiana relevante ou suspeita de tumor hipofisário.\n'
  '-Encaminhar à ginecologia se houver suspeita de sinéquias, insuficiência ovariana ou SOP com necessidade de manejo especializado.\n'
  '-Encaminhar com urgência se houver cefaleia com alteração visual.\n'
  '-Encaminhar para apoio especializado em suspeita de transtorno alimentar.',
 'observacoes_clinicas':
  '-Excluir gestação é sempre o primeiro passo.\n'
  '-TSH e prolactina são exames iniciais de alto rendimento.\n'
  '-Amenorreia hipotalâmica prolongada tem impacto ósseo e exige abordagem além do ciclo menstrual.',
},

'SANGRAMENTO UTERINO ANORMAL — ADULTO': {
 'especialidade': G, 'contexto': CP, 'nivel_risco': ['Moderado'],
 'resumo_clinico':
  '-Sangramento uterino fora do padrão habitual em volume, duração, frequência ou regularidade.\n'
  '-As causas incluem pólipos, adenomiose, leiomiomas, malignidade, coagulopatia, disfunção ovulatória, causas endometriais e iatrogênicas.\n'
  '-O tratamento agudo visa controlar o sangramento e corrigir anemia; a investigação define a causa.\n'
  '-Antifibrinolíticos e anti-inflamatórios reduzem o volume do sangramento no episódio.\n'
  '-Sangramento pós-menopausa exige investigação de malignidade.',
 'quando_usar':
  '-Mulher com sangramento aumentado, prolongado ou irregular, hemodinamicamente estável.\n'
  '-Necessidade de controle sintomático enquanto se investiga a causa.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente se houver instabilidade hemodinâmica, sangramento profuso ou anemia grave sintomática.\n'
  '-Não iniciar tratamento sem excluir gestação em mulher em idade fértil.\n'
  '-Não tratar sangramento pós-menopausa como disfuncional sem investigação de malignidade.\n'
  '-Não usar antifibrinolítico sem avaliar risco trombótico.\n'
  '-Não ignorar história pessoal ou familiar de sangramento sugestiva de coagulopatia.',
 'conduta_procedimento':
  '-Avaliar sinais vitais, palidez, tontura e magnitude do sangramento.\n'
  '-Solicitar beta-HCG em mulher em idade fértil e hemograma para avaliar anemia.\n'
  '-Caracterizar padrão do sangramento, uso de anticoagulante, hormônios e DIU.\n'
  '-Investigar sinais de coagulopatia e sintomas de disfunção tireoidiana.\n'
  '-Prescrever antifibrinolítico e anti-inflamatório para reduzir o volume, respeitando contraindicações.\n'
  '-Solicitar ultrassom pélvico; considerar avaliação endometrial conforme idade e fatores de risco.\n'
  '-Repor ferro quando houver anemia ferropriva.\n'
  '-Reavaliar em 1 a 2 semanas ou antes se houver piora.',
 'sinais_alerta':
  '-Instabilidade hemodinâmica\n-Sangramento profuso\n-Palidez importante\n-Tontura ou síncope\n'
  '-Anemia grave\n-Sangramento pós-menopausa\n-Uso de anticoagulante\n-Beta-HCG positivo\n'
  '-Massa pélvica\n-Perda de peso inexplicada',
 'criterios_encaminhamento':
  '-Encaminhar à emergência se houver instabilidade, sangramento profuso ou anemia grave sintomática.\n'
  '-Encaminhar à ginecologia todo sangramento pós-menopausa para investigação de malignidade.\n'
  '-Encaminhar se houver massa pélvica, suspeita de mioma sintomático ou falha do tratamento clínico.\n'
  '-Encaminhar à hematologia em suspeita de coagulopatia.\n'
  '-Reavaliar em 1 a 2 semanas.',
 'observacoes_clinicas':
  '-Excluir gestação é obrigatório em mulher em idade fértil.\n'
  '-Sangramento pós-menopausa é sinal de alerta até prova em contrário.\n'
  '-Corrigir anemia ferropriva faz parte do tratamento, não apenas controlar o sangramento.',
},

'MASTALGIA — ADULTO': {
 'especialidade': G, 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Dor mamária, na maioria das vezes benigna, classificada em cíclica (relacionada ao ciclo) e acíclica.\n'
  '-A forma cíclica é a mais comum, bilateral, difusa e com piora pré-menstrual.\n'
  '-Câncer de mama raramente se apresenta apenas como dor, mas nódulo, retração ou secreção sanguinolenta exigem investigação.\n'
  '-Medidas de suporte, ajuste de sutiã e analgesia resolvem a maioria dos casos.\n'
  '-Tratamento hormonal específico é reservado a casos intensos e refratários, por especialista.',
 'quando_usar':
  '-Mulher adulta com dor mamária sem nódulo palpável, sem sinais inflamatórios e sem secreção suspeita.\n'
  '-Dor cíclica com impacto na qualidade de vida.\n'
  '-Uso em APS e ambulatório para orientação e analgesia.',
 'quando_nao_usar':
  '-Não tratar apenas sintomaticamente se houver nódulo palpável, retração de pele ou mamilo, ou linfonodo axilar endurecido.\n'
  '-Não ignorar secreção papilar sanguinolenta ou espontânea unilateral.\n'
  '-Não ignorar sinais inflamatórios com febre, que sugerem mastite ou abscesso.\n'
  '-Não ignorar eritema difuso com aspecto de casca de laranja, que exige avaliação urgente.',
 'conduta_procedimento':
  '-Caracterizar dor: cíclica ou acíclica, uni ou bilateral, localizada ou difusa.\n'
  '-Realizar exame das mamas e das axilas em busca de nódulo, retração, secreção e linfonodo.\n'
  '-Revisar medicamentos que podem causar mastalgia, incluindo hormônios.\n'
  '-Orientar sutiã com bom suporte, compressas e analgesia conforme necessidade.\n'
  '-Solicitar exame de imagem conforme idade, fatores de risco e achados do exame.\n'
  '-Reservar tratamento hormonal específico a casos intensos e refratários, com especialista.\n'
  '-Reavaliar em 2 a 3 ciclos.',
 'sinais_alerta':
  '-Nódulo palpável\n-Retração de pele ou mamilo\n-Secreção papilar sanguinolenta\n-Secreção espontânea unilateral\n'
  '-Linfonodo axilar endurecido\n-Eritema com casca de laranja\n-Febre com sinais inflamatórios\n'
  '-Dor localizada persistente e progressiva',
 'criterios_encaminhamento':
  '-Encaminhar à mastologia se houver nódulo, retração, secreção suspeita ou linfonodo axilar.\n'
  '-Encaminhar com urgência se houver eritema difuso com casca de laranja.\n'
  '-Encaminhar à emergência se houver sinais de abscesso mamário.\n'
  '-Encaminhar se a dor for refratária e limitar a qualidade de vida.\n'
  '-Reavaliar em 2 a 3 ciclos.',
 'observacoes_clinicas':
  '-Dor isolada raramente é manifestação de câncer, mas o exame físico completo é obrigatório.\n'
  '-Medidas de suporte resolvem a maioria dos casos cíclicos.\n'
  '-Tratamento hormonal específico tem efeitos adversos relevantes e é reservado a casos selecionados.',
},

'SÍFILIS — ADULTO': {
 'especialidade': GI, 'contexto': CP, 'nivel_risco': ['Moderado'],
 'resumo_clinico':
  '-Infecção sistêmica por Treponema pallidum, de transmissão sexual e vertical.\n'
  '-A sífilis primária cursa com cancro duro indolor; a secundária, com exantema incluindo palmas e plantas; a latente é assintomática.\n'
  '-A penicilina benzatina é o tratamento de escolha em todas as fases, inclusive na gestação.\n'
  '-Gestante com sífilis exige tratamento adequado e oportuno para prevenir sífilis congênita.\n'
  '-O seguimento é sorológico, com controle de titulação ao longo do tempo.',
 'quando_usar':
  '-Adulto com teste treponêmico ou não treponêmico reagente.\n'
  '-Lesão genital ulcerada indolor ou exantema palmoplantar compatível.\n'
  '-Parceiro de caso confirmado.\n'
  '-Uso em APS, ambulatório e pronto atendimento para tratamento e notificação.',
 'quando_nao_usar':
  '-Não postergar o tratamento da gestante: a prevenção da sífilis congênita depende do tratamento oportuno.\n'
  '-Não substituir penicilina por alternativa na gestação: indicar dessensibilização quando houver alergia.\n'
  '-Não tratar sem definir a fase, pois o número de doses depende dela.\n'
  '-Não deixar de tratar o parceiro e de rastrear outras ISTs.\n'
  '-Não interpretar reação febril nas primeiras 24 horas como alergia: pode ser reação de Jarisch-Herxheimer.',
 'conduta_procedimento':
  '-Caracterizar lesões, tempo de evolução e exposição sexual.\n'
  '-Solicitar testes treponêmico e não treponêmico com titulação.\n'
  '-Definir a fase clínica para estabelecer o esquema e o número de doses.\n'
  '-Investigar sinais neurológicos, oculares e auditivos, que mudam a conduta.\n'
  '-Aplicar penicilina benzatina conforme a fase; observar o paciente após a aplicação.\n'
  '-Rastrear HIV, hepatites B e C e outras ISTs; testar e tratar parceiros.\n'
  '-Notificar o caso conforme a vigilância epidemiológica.\n'
  '-Programar seguimento sorológico com titulação, com atenção especial na gestação.',
 'sinais_alerta':
  '-Gestação\n-Alteração visual\n-Perda auditiva\n-Sinais neurológicos\n-Cefaleia persistente\n'
  '-Alergia à penicilina\n-Coinfecção com HIV\n-Titulação que não cai no seguimento\n-Reinfecção',
 'criterios_encaminhamento':
  '-Encaminhar imediatamente gestante para tratamento e seguimento obstétrico.\n'
  '-Encaminhar com urgência se houver alteração visual, auditiva ou neurológica.\n'
  '-Encaminhar para dessensibilização se houver alergia à penicilina, especialmente na gestação.\n'
  '-Encaminhar ao serviço de ISTs para seguimento sorológico e manejo de parceiros.\n'
  '-Encaminhar se a titulação não cair conforme esperado.',
 'observacoes_clinicas':
  '-Penicilina benzatina é o tratamento de escolha em todas as fases e a única opção adequada na gestação.\n'
  '-Reação de Jarisch-Herxheimer nas primeiras 24 horas é esperada e não indica alergia.\n'
  '-O seguimento é sorológico: a resposta se mede pela queda da titulação.\n'
  '-Sífilis é doença de notificação compulsória.',
},

'PEP / PROFILAXIA PÓS-EXPOSIÇÃO SEXUAL — ADULTO': {
 'especialidade': ['Infectologia', 'Medicina de Emergência', 'Clínica Médica', 'APS'],
 'contexto': ['Adulto', 'PS', 'Emergência', 'APS'],
 'nivel_risco': ['Alto', 'Urgente'],
 'resumo_clinico':
  '-Profilaxia antirretroviral indicada após exposição sexual de risco ao HIV.\n'
  '-Deve ser iniciada o mais precocemente possível, idealmente nas primeiras 2 horas, com limite de 72 horas após a exposição.\n'
  '-A duração é de 28 dias, com esquema definido pelo protocolo vigente.\n'
  '-O atendimento inclui avaliação de outras ISTs, contracepção de emergência e suporte psicológico.\n'
  '-Em violência sexual, o acolhimento e a notificação fazem parte do cuidado.',
 'quando_usar':
  '-Adulto com exposição sexual de risco nas últimas 72 horas.\n'
  '-Relação desprotegida com pessoa com HIV ou de status sorológico desconhecido com risco.\n'
  '-Violência sexual.\n'
  '-Uso em pronto atendimento, emergência e serviços de referência.',
 'quando_nao_usar':
  '-Não iniciar profilaxia após 72 horas da exposição: o benefício não é estabelecido.\n'
  '-Não iniciar sem testagem para HIV: pessoa já infectada precisa de tratamento, não de profilaxia.\n'
  '-Não limitar o atendimento ao antirretroviral: avaliar outras ISTs, contracepção de emergência e suporte.\n'
  '-Não retardar a primeira dose aguardando o resultado de exames.',
 'conduta_procedimento':
  '-Estabelecer o horário exato da exposição e o tempo decorrido.\n'
  '-Avaliar o tipo de exposição e o risco associado.\n'
  '-Realizar teste rápido para HIV no paciente-fonte quando possível e no exposto.\n'
  '-Iniciar a profilaxia imediatamente quando indicada, sem aguardar resultados de outros exames.\n'
  '-Solicitar sorologias para sífilis, hepatites B e C e avaliar necessidade de vacinação e imunoglobulina para hepatite B.\n'
  '-Oferecer contracepção de emergência e profilaxia para outras ISTs conforme protocolo.\n'
  '-Acolher, oferecer suporte psicológico e notificar em caso de violência sexual.\n'
  '-Agendar seguimento com testagem seriada e reforçar adesão aos 28 dias.',
 'sinais_alerta':
  '-Exposição há mais de 72 horas\n-Teste de HIV reagente no exposto\n-Violência sexual\n'
  '-Exposição de adolescente ou criança\n-Interrupção precoce do esquema\n-Efeito adverso importante\n'
  '-Sintomas de síndrome retroviral aguda no seguimento',
 'criterios_encaminhamento':
  '-Encaminhar imediatamente ao serviço de referência em HIV e ISTs.\n'
  '-Encaminhar para serviço especializado em violência sexual quando aplicável, com notificação.\n'
  '-Encaminhar se o teste de HIV for reagente, para início de tratamento.\n'
  '-Garantir seguimento com testagem seriada após a conclusão do esquema.',
 'observacoes_clinicas':
  '-Tempo é o fator crítico: iniciar o quanto antes, e nunca após 72 horas.\n'
  '-A adesão aos 28 dias completos é determinante da eficácia.\n'
  '-O atendimento vai além do antirretroviral: ISTs, contracepção, vacinação e suporte fazem parte.\n'
  '-Violência sexual exige acolhimento e notificação compulsória.',
},

'HERPES SIMPLES — ADULTO': {
 'especialidade': GI, 'contexto': C, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Infecção pelo vírus herpes simples, com vesículas agrupadas sobre base eritematosa que evoluem para erosões dolorosas.\n'
  '-O primeiro episódio costuma ser mais intenso e prolongado, podendo cursar com febre e adenomegalia.\n'
  '-As recorrências são mais brandas e frequentemente precedidas de pródromo de ardor ou formigamento.\n'
  '-O antiviral reduz duração e intensidade, com maior benefício quando iniciado precocemente.\n'
  '-O herpes genital é IST e exige orientação sobre transmissão, inclusive em períodos assintomáticos.',
 'quando_usar':
  '-Adulto com vesículas agrupadas dolorosas em região labial, genital ou perianal.\n'
  '-Primeiro episódio ou recorrência, em paciente imunocompetente.\n'
  '-Uso em APS, ambulatório e pronto atendimento.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente se houver lesão extensa, disseminada ou acometimento sistêmico.\n'
  '-Não ignorar acometimento ocular: exige avaliação oftalmológica urgente.\n'
  '-Não subestimar o quadro em imunossuprimido, que pode evoluir de forma atípica e grave.\n'
  '-Não deixar de avaliar gestação, pelo risco de herpes neonatal.\n'
  '-Não confundir com impetigo, aftas, cancro sifilítico ou dermatite de contato.',
 'conduta_procedimento':
  '-Caracterizar pródromo, localização, número de episódios e fatores desencadeantes.\n'
  '-Examinar mucosas, região genital e perianal; procurar adenomegalia.\n'
  '-Avaliar imunossupressão e gestação.\n'
  '-Iniciar antiviral o mais precocemente possível, idealmente nas primeiras 72 horas.\n'
  '-Prescrever analgesia e orientar higiene local, evitando manipulação das lesões.\n'
  '-Em herpes genital, rastrear outras ISTs e orientar sobre transmissão.\n'
  '-Discutir terapia supressiva quando houver recorrências frequentes.\n'
  '-Reavaliar se não houver melhora em 7 a 10 dias.',
 'sinais_alerta':
  '-Acometimento ocular\n-Lesões extensas ou disseminadas\n-Febre alta com prostração\n-Imunossupressão\n'
  '-Gestação, especialmente próxima ao parto\n-Sinais neurológicos\n-Retenção urinária\n'
  '-Dor desproporcional\n-Infecção bacteriana secundária',
 'criterios_encaminhamento':
  '-Encaminhar com urgência à oftalmologia em suspeita de acometimento ocular.\n'
  '-Encaminhar à emergência se houver lesões disseminadas, sinais neurológicos ou retenção urinária.\n'
  '-Encaminhar gestante para manejo obstétrico, especialmente próximo ao parto.\n'
  '-Encaminhar imunossuprimido para avaliação especializada.\n'
  '-Encaminhar para discutir terapia supressiva em recorrências frequentes.',
 'observacoes_clinicas':
  '-O antiviral tem maior benefício quando iniciado nas primeiras 72 horas ou já no pródromo.\n'
  '-A transmissão pode ocorrer na ausência de lesões visíveis.\n'
  '-Herpes genital exige rastreio de outras ISTs e orientação ao parceiro.\n'
  '-Gestação próxima ao parto muda a conduta pelo risco de herpes neonatal.',
},
}

if __name__ == '__main__':
    executar(CLINICOS)

# -*- coding: utf-8 -*-
"""Lote 06 — parasitoses e ectoparasitoses (adulto e criança)."""
from create_new import executar

P = ['Infectologia', 'Clínica Médica', 'APS', 'Medicina de Família']
PED = ['Pediatria', 'Infectologia', 'APS', 'Medicina de Família']
C = ['Adulto', 'APS', 'Ambulatorial']
CC = ['Pediatria', 'APS', 'Ambulatorial']

CLINICOS = {
'ENTEROBÍASE / OXIURÍASE — ADULTO': {
 'especialidade': P, 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Infestação intestinal por Enterobius vermicularis, o oxiúro, muito frequente e de fácil transmissão.\n'
  '-O sintoma característico é prurido anal de predomínio noturno, quando a fêmea deposita ovos na região perianal.\n'
  '-A transmissão é fecal-oral, direta ou por fômites, e a reinfestação é comum.\n'
  '-O tratamento deve incluir todos os moradores da casa e ser repetido após 2 semanas para cobrir o ciclo.\n'
  '-Medidas de higiene são parte essencial do tratamento, não apenas orientação acessória.',
 'quando_usar':
  '-Adulto com prurido anal noturno, com ou sem visualização de vermes.\n'
  '-Contato domiciliar de caso confirmado.\n'
  '-Uso em APS e ambulatório para tratamento e orientação de medidas domiciliares.',
 'quando_nao_usar':
  '-Não tratar apenas o paciente: sem tratar os contatos domiciliares a reinfestação é a regra.\n'
  '-Não omitir a segunda dose após 2 semanas: ela cobre os ovos que eclodiram depois da primeira.\n'
  '-Não ignorar prurido anal com sangramento, dor ou massa: avaliar hemorroida, fissura ou outra causa.\n'
  '-Não ignorar corrimento ou sintomas urinários em mulheres, que podem indicar migração do parasita.',
 'conduta_procedimento':
  '-Caracterizar prurido, horário de piora, irritabilidade e insônia.\n'
  '-Investigar sintomas semelhantes em outros moradores, especialmente crianças.\n'
  '-Examinar região perianal; considerar teste da fita adesiva pela manhã se houver dúvida.\n'
  '-Tratar o paciente e todos os contatos domiciliares simultaneamente.\n'
  '-Programar a repetição da dose após 2 semanas.\n'
  '-Orientar lavagem de roupas de cama e íntimas, unhas curtas, higiene das mãos e banho matinal.\n'
  '-Reavaliar se o prurido persistir após o esquema completo.',
 'sinais_alerta':
  '-Sangramento anal\n-Dor anal importante\n-Massa ou abaulamento perianal\n-Corrimento vaginal associado\n'
  '-Sintomas urinários persistentes\n-Perda de peso\n-Falha após tratamento completo de todos os contatos\n'
  '-Imunossupressão',
 'criterios_encaminhamento':
  '-Encaminhar se houver sangramento, dor anal importante ou massa perianal.\n'
  '-Encaminhar à ginecologia se houver sintomas genitourinários persistentes atribuídos à migração.\n'
  '-Encaminhar em falha terapêutica após esquema completo e tratamento de contatos.\n'
  '-Reavaliar após o término do esquema.',
 'observacoes_clinicas':
  '-Tratar toda a casa ao mesmo tempo e repetir a dose em 2 semanas são os dois pontos que definem o sucesso.\n'
  '-Higiene das mãos, unhas curtas e troca de roupa de cama reduzem muito a reinfestação.\n'
  '-Prurido anal noturno é o dado clínico mais característico.',
},

'ENTEROBÍASE / OXIURÍASE — CRIANÇA': {
 'especialidade': PED, 'contexto': CC, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Parasitose intestinal muito comum na infância, especialmente em ambiente coletivo como creche e escola.\n'
  '-Cursa com prurido anal noturno, irritabilidade, sono agitado e, em meninas, prurido ou corrimento vulvar.\n'
  '-A transmissão fecal-oral facilita surtos familiares e escolares.\n'
  '-O tratamento inclui toda a família e é repetido após 2 semanas.\n'
  '-A dose é ajustada ao peso e à idade da criança.',
 'quando_usar':
  '-Criança com prurido anal noturno, sono agitado ou visualização de vermes.\n'
  '-Contato domiciliar ou escolar de caso confirmado.\n'
  '-Uso em APS e ambulatório pediátrico.',
 'quando_nao_usar':
  '-Não tratar apenas a criança: toda a família deve ser tratada simultaneamente.\n'
  '-Não omitir a repetição da dose após 2 semanas.\n'
  '-Não usar dose de adulto: ajustar ao peso e à idade.\n'
  '-Não ignorar sangramento anal, dor importante ou perda de peso.\n'
  '-Não ignorar prurido vulvar persistente após o tratamento, que exige reavaliação.',
 'conduta_procedimento':
  '-Caracterizar prurido, sono, irritabilidade e sintomas vulvares.\n'
  '-Investigar casos semelhantes na família e na escola.\n'
  '-Examinar região perianal e vulvar; considerar teste da fita adesiva pela manhã.\n'
  '-Conferir peso para o cálculo da dose.\n'
  '-Tratar a criança e toda a família simultaneamente, com repetição em 2 semanas.\n'
  '-Orientar unhas curtas, higiene das mãos, banho matinal e troca de roupas de cama.\n'
  '-Reavaliar se houver persistência dos sintomas.',
 'sinais_alerta':
  '-Sangramento anal\n-Dor anal importante\n-Perda de peso\n-Palidez\n-Distensão abdominal importante\n'
  '-Prurido vulvar persistente após tratamento\n-Corrimento vulvar purulento\n-Falha após esquema completo',
 'criterios_encaminhamento':
  '-Encaminhar à pediatria ou gastroenterologia pediátrica em falha terapêutica ou sintomas atípicos.\n'
  '-Encaminhar se houver sangramento, dor importante ou perda de peso.\n'
  '-Encaminhar à ginecologia pediátrica se houver corrimento vulvar persistente.\n'
  '-Reavaliar após o término do esquema.',
 'observacoes_clinicas':
  '-Tratar a família inteira e repetir a dose em 2 semanas evita o ciclo de reinfestação.\n'
  '-A dose precisa ser calculada por peso.\n'
  '-Surtos em creche e escola são frequentes e justificam orientação coletiva.',
},

'PARASITOSE INTESTINAL — CRIANÇA': {
 'especialidade': PED, 'contexto': CC, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Infestação intestinal por helmintos ou protozoários, comum em áreas com saneamento inadequado.\n'
  '-Pode ser assintomática ou cursar com dor abdominal, diarreia, distensão, prurido anal e baixo ganho de peso.\n'
  '-Infestação intensa pode causar anemia ferropriva e desnutrição, com impacto no crescimento.\n'
  '-O tratamento antiparasitário é ajustado ao peso e à idade, e frequentemente associa-se reposição de ferro.\n'
  '-Saneamento, água tratada e higiene são determinantes para evitar recorrência.',
 'quando_usar':
  '-Criança com dor abdominal recorrente, diarreia, distensão, prurido anal ou baixo ganho ponderal.\n'
  '-Exame parasitológico positivo ou contexto epidemiológico compatível.\n'
  '-Uso em APS e ambulatório pediátrico.',
 'quando_nao_usar':
  '-Não tratar empiricamente de forma repetida sem investigar outras causas de dor abdominal ou baixo ganho de peso.\n'
  '-Não ignorar palidez importante, que exige investigação de anemia.\n'
  '-Não usar dose de adulto: ajustar ao peso.\n'
  '-Não ignorar distensão importante, vômitos e parada de eliminação de gases, que sugerem obstrução por áscaris.\n'
  '-Não ignorar diarreia sanguinolenta ou febre alta persistente.',
 'conduta_procedimento':
  '-Caracterizar sintomas digestivos, apetite, curva de crescimento e condições de saneamento.\n'
  '-Examinar abdome, avaliar palidez e estado nutricional.\n'
  '-Solicitar exame parasitológico de fezes e hemograma quando indicado.\n'
  '-Conferir peso para cálculo da dose do antiparasitário.\n'
  '-Tratar conforme o agente identificado ou com esquema de amplo espectro quando justificado.\n'
  '-Repor ferro se houver anemia ferropriva e acompanhar a curva de crescimento.\n'
  '-Orientar água tratada ou fervida, higiene das mãos e cuidados com alimentos.\n'
  '-Reavaliar em 2 a 4 semanas.',
 'sinais_alerta':
  '-Palidez importante\n-Perda de peso ou baixo ganho ponderal\n-Distensão abdominal importante\n'
  '-Vômitos persistentes\n-Parada de eliminação de gases e fezes\n-Diarreia sanguinolenta\n'
  '-Febre alta persistente\n-Prolapso retal\n-Desnutrição',
 'criterios_encaminhamento':
  '-Encaminhar à emergência se houver suspeita de obstrução intestinal ou abdome agudo.\n'
  '-Encaminhar à pediatria ou gastroenterologia pediátrica em falha terapêutica, desnutrição ou anemia importante.\n'
  '-Encaminhar se houver diarreia sanguinolenta ou prolapso retal.\n'
  '-Reavaliar em 2 a 4 semanas.',
 'observacoes_clinicas':
  '-Anemia ferropriva associada é comum e precisa ser tratada junto com a parasitose.\n'
  '-A dose é sempre calculada por peso na criança.\n'
  '-Sem melhora das condições de água e higiene, a recorrência é esperada.',
},

'LARVA MIGRANS CUTÂNEA — ADULTO': {
 'especialidade': ['Dermatologia', 'Infectologia', 'Clínica Médica', 'APS'],
 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Dermatose causada pela migração de larvas de ancilostomídeos de cães e gatos na epiderme humana.\n'
  '-Manifesta-se por lesão linear ou serpiginosa, eritematosa, muito pruriginosa e de progressão diária.\n'
  '-A exposição típica é contato de pele com areia ou solo contaminado, especialmente em praias.\n'
  '-É autolimitada em semanas a meses, mas o tratamento abrevia o quadro e alivia o prurido.\n'
  '-A infecção bacteriana secundária por coçadura é a complicação mais comum.',
 'quando_usar':
  '-Adulto com lesão linear serpiginosa pruriginosa de progressão diária, com história de contato com areia ou solo.\n'
  '-Lesões localizadas, sem sinais sistêmicos.\n'
  '-Uso em APS e ambulatório.',
 'quando_nao_usar':
  '-Não tratar apenas como larva migrans se houver sinais de infecção bacteriana importante: tratar também a infecção.\n'
  '-Não ignorar lesões muito numerosas ou disseminadas, que exigem reavaliação diagnóstica.\n'
  '-Não confundir com escabiose, dermatite de contato, tinea ou miíase.\n'
  '-Não usar ivermectina sem considerar contraindicações, incluindo gestação e baixo peso.',
 'conduta_procedimento':
  '-Caracterizar a lesão, sua progressão diária e a exposição de risco.\n'
  '-Examinar principalmente pés, nádegas, coxas e tronco.\n'
  '-Avaliar sinais de infecção bacteriana secundária.\n'
  '-Prescrever tratamento tópico em lesões poucas e localizadas; oral em lesões múltiplas ou extensas.\n'
  '-Tratar infecção secundária quando presente e prescrever anti-histamínico para o prurido.\n'
  '-Orientar evitar contato direto da pele com areia ou solo possivelmente contaminado.\n'
  '-Reavaliar em 1 a 2 semanas.',
 'sinais_alerta':
  '-Infecção bacteriana secundária extensa\n-Celulite\n-Febre\n-Lesões muito numerosas ou disseminadas\n'
  '-Sintomas respiratórios associados\n-Imunossupressão\n-Falha após tratamento adequado',
 'criterios_encaminhamento':
  '-Encaminhar se houver celulite extensa, febre ou sinais sistêmicos.\n'
  '-Encaminhar à dermatologia ou infectologia em lesões disseminadas, dúvida diagnóstica ou falha terapêutica.\n'
  '-Encaminhar se houver sintomas respiratórios associados.\n'
  '-Reavaliar em 1 a 2 semanas.',
 'observacoes_clinicas':
  '-O quadro é autolimitado, mas o tratamento reduz duração e prurido.\n'
  '-A complicação mais comum é infecção bacteriana por coçadura.\n'
  '-Ivermectina oral exige atenção a gestação, amamentação e baixo peso.',
},

'LARVA MIGRANS CUTÂNEA — CRIANÇA': {
 'especialidade': PED, 'contexto': CC, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Migração de larvas de ancilostomídeos na pele da criança, geralmente após brincar em areia ou solo contaminado.\n'
  '-Lesão linear serpiginosa muito pruriginosa, com progressão diária, mais comum em pés e nádegas.\n'
  '-A coçadura frequente favorece infecção bacteriana secundária.\n'
  '-O tratamento tópico costuma ser suficiente em lesões localizadas; a dose oral é ajustada ao peso.\n'
  '-Orientar medidas preventivas na areia e no solo reduz recorrência.',
 'quando_usar':
  '-Criança com lesão serpiginosa pruriginosa e história de contato com areia ou solo.\n'
  '-Lesões localizadas, sem sinais sistêmicos.\n'
  '-Uso em APS e ambulatório pediátrico.',
 'quando_nao_usar':
  '-Não ignorar sinais de infecção bacteriana secundária, que exigem antibiótico.\n'
  '-Não usar dose de adulto: ajustar ao peso.\n'
  '-Não usar ivermectina oral em criança de baixo peso sem avaliação.\n'
  '-Não confundir com escabiose, impetigo ou dermatite de contato.',
 'conduta_procedimento':
  '-Caracterizar lesão, progressão e exposição.\n'
  '-Examinar pés, nádegas, coxas e tronco; avaliar sinais de infecção secundária.\n'
  '-Conferir peso para cálculo da dose quando houver indicação de tratamento oral.\n'
  '-Prescrever tópico em lesões localizadas e oral em lesões múltiplas.\n'
  '-Tratar infecção secundária e prescrever anti-histamínico para o prurido.\n'
  '-Orientar uso de calçado e evitar contato direto com areia possivelmente contaminada.\n'
  '-Reavaliar em 1 a 2 semanas.',
 'sinais_alerta':
  '-Infecção bacteriana secundária\n-Celulite\n-Febre\n-Lesões numerosas\n-Prurido incapacitante\n'
  '-Baixo peso para uso de ivermectina\n-Falha após tratamento adequado',
 'criterios_encaminhamento':
  '-Encaminhar se houver celulite, febre ou sinais sistêmicos.\n'
  '-Encaminhar à pediatria ou dermatologia em lesões extensas ou falha terapêutica.\n'
  '-Reavaliar em 1 a 2 semanas.',
 'observacoes_clinicas':
  '-A dose oral deve ser calculada por peso, com atenção ao limite para ivermectina.\n'
  '-Infecção bacteriana secundária por coçadura é a complicação mais frequente.\n'
  '-Medidas preventivas simples reduzem bastante a recorrência.',
},

'TENÍASE — ADULTO': {
 'especialidade': P, 'contexto': C, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Infestação intestinal por Taenia solium ou Taenia saginata, adquirida pelo consumo de carne crua ou malcozida.\n'
  '-Costuma ser oligossintomática, com desconforto abdominal, náuseas e eliminação de proglotes nas fezes.\n'
  '-A importância maior está na Taenia solium, cujos ovos podem causar neurocisticercose por autoinfestação ou contaminação fecal-oral.\n'
  '-O tratamento é medicamentoso e a orientação sobre cozimento da carne é essencial.\n'
  '-Cefaleia persistente ou crise convulsiva em paciente com teníase exige investigação de neurocisticercose.',
 'quando_usar':
  '-Adulto com eliminação de proglotes, desconforto abdominal ou exame parasitológico positivo.\n'
  '-História de consumo de carne crua ou malcozida.\n'
  '-Uso em APS e ambulatório.',
 'quando_nao_usar':
  '-Não tratar sem investigar neurocisticercose se houver cefaleia persistente, crise convulsiva ou sinal neurológico focal.\n'
  '-Não ignorar alterações visuais, que podem indicar cisticercose ocular.\n'
  '-Não deixar de orientar cozimento adequado da carne e higiene, para evitar reinfestação e transmissão.\n'
  '-Não confundir proglotes com outros achados nas fezes sem confirmação.',
 'conduta_procedimento':
  '-Caracterizar sintomas digestivos e eliminação de proglotes.\n'
  '-Investigar hábito alimentar e condições de saneamento.\n'
  '-Perguntar ativamente sobre cefaleia, crise convulsiva e alterações visuais.\n'
  '-Solicitar exame parasitológico de fezes.\n'
  '-Tratar com antiparasitário conforme o esquema indicado.\n'
  '-Orientar cozimento completo da carne, higiene das mãos e água tratada.\n'
  '-Reavaliar após o tratamento e investigar neurocisticercose se houver sintoma neurológico.',
 'sinais_alerta':
  '-Cefaleia persistente\n-Crise convulsiva\n-Déficit neurológico focal\n-Alteração visual\n'
  '-Vômitos persistentes\n-Confusão mental\n-Perda de peso importante\n-Dor abdominal intensa',
 'criterios_encaminhamento':
  '-Encaminhar com urgência para investigação neurológica se houver convulsão, cefaleia persistente ou déficit focal.\n'
  '-Encaminhar à oftalmologia em alteração visual com suspeita de cisticercose ocular.\n'
  '-Encaminhar à infectologia em falha terapêutica ou dúvida diagnóstica.\n'
  '-Reavaliar após o tratamento.',
 'observacoes_clinicas':
  '-O risco relevante da Taenia solium é a neurocisticercose, não a infestação intestinal em si.\n'
  '-Sempre perguntar sobre cefaleia e convulsão em paciente com teníase.\n'
  '-Cozimento adequado da carne é a principal medida preventiva.',
},

'PEDICULOSE — CRIANÇA': {
 'especialidade': PED, 'contexto': CC, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Infestação do couro cabeludo por Pediculus humanus capitis, muito comum em idade escolar.\n'
  '-Cursa com prurido, escoriações por coçadura e presença de lêndeas aderidas à haste do cabelo.\n'
  '-A transmissão é por contato direto cabeça a cabeça e, com menor frequência, por objetos pessoais.\n'
  '-O tratamento tópico deve ser repetido após 7 a 10 dias para atingir as ninfas eclodidas.\n'
  '-A remoção mecânica das lêndeas com pente fino é parte do tratamento.',
 'quando_usar':
  '-Criança com prurido no couro cabeludo e lêndeas ou piolhos visíveis.\n'
  '-Contato domiciliar ou escolar de caso confirmado.\n'
  '-Uso em APS e ambulatório pediátrico.',
 'quando_nao_usar':
  '-Não tratar apenas a criança: avaliar e tratar contatos domiciliares infestados.\n'
  '-Não omitir a segunda aplicação após 7 a 10 dias.\n'
  '-Não usar formulações de adulto ou produtos não recomendados para a faixa etária.\n'
  '-Não ignorar impetiginização do couro cabeludo com crostas, secreção e adenomegalia.\n'
  '-Não confundir lêndeas com caspa ou resíduos de produto capilar.',
 'conduta_procedimento':
  '-Examinar couro cabeludo com boa iluminação, sobretudo região retroauricular e nuca.\n'
  '-Diferenciar lêndeas viáveis, aderidas à haste, de descamação.\n'
  '-Avaliar sinais de infecção bacteriana secundária e adenomegalia cervical.\n'
  '-Prescrever tratamento tópico adequado à idade, com repetição em 7 a 10 dias.\n'
  '-Orientar remoção mecânica com pente fino em cabelo úmido, repetida ao longo dos dias.\n'
  '-Examinar e tratar contatos domiciliares infestados.\n'
  '-Orientar não compartilhar pente, boné e travesseiro; evitar afastamento escolar desnecessário.\n'
  '-Reavaliar em 2 semanas.',
 'sinais_alerta':
  '-Impetiginização do couro cabeludo\n-Crostas extensas com secreção\n-Adenomegalia cervical dolorosa\n'
  '-Febre\n-Prurido incapacitante\n-Falha após duas aplicações corretas\n-Anemia em infestação maciça',
 'criterios_encaminhamento':
  '-Encaminhar se houver infecção bacteriana secundária importante ou adenomegalia com febre.\n'
  '-Encaminhar à pediatria ou dermatologia em falha após tratamento correto e repetido.\n'
  '-Reavaliar em 2 semanas.',
 'observacoes_clinicas':
  '-A repetição da aplicação em 7 a 10 dias é o que evita a recidiva pelas ninfas.\n'
  '-A remoção mecânica com pente fino aumenta a eficácia.\n'
  '-Afastamento escolar prolongado não é necessário e prejudica a criança.',
},

'PEDICULOSE PUBIANA — ADULTO': {
 'especialidade': ['Infectologia', 'Dermatologia', 'Clínica Médica', 'APS'],
 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Infestação da região pubiana por Pthirus pubis, com transmissão predominantemente sexual.\n'
  '-Cursa com prurido pubiano, escoriações e máculas azuladas (máculas cerúleas) em alguns casos.\n'
  '-Pode acometer também axilas, cílios e sobrancelhas, sobretudo em infestações intensas.\n'
  '-Por ser de transmissão sexual, indica rastreio de outras ISTs e tratamento do parceiro.\n'
  '-O tratamento tópico é repetido após 7 a 10 dias.',
 'quando_usar':
  '-Adulto com prurido pubiano e identificação de parasitas ou lêndeas.\n'
  '-Parceiro de caso confirmado.\n'
  '-Uso em APS e ambulatório.',
 'quando_nao_usar':
  '-Não tratar sem oferecer rastreio de outras ISTs.\n'
  '-Não tratar apenas o paciente: o parceiro sexual precisa ser tratado.\n'
  '-Não usar produtos de uso capilar comum na região ocular: acometimento de cílios exige manejo específico.\n'
  '-Não ignorar acometimento em criança, que exige avaliação cuidadosa do contexto.',
 'conduta_procedimento':
  '-Examinar região pubiana, perianal, axilas, cílios e sobrancelhas.\n'
  '-Investigar parceiros sexuais recentes.\n'
  '-Oferecer rastreio de HIV, sífilis e hepatites.\n'
  '-Prescrever tratamento tópico com repetição em 7 a 10 dias.\n'
  '-Orientar lavagem de roupas de cama e íntimas em água quente.\n'
  '-Orientar tratamento do parceiro e abstinência sexual até a resolução.\n'
  '-Reavaliar em 2 semanas.',
 'sinais_alerta':
  '-Acometimento de cílios ou sobrancelhas\n-Infecção bacteriana secundária\n-Acometimento em criança\n'
  '-Coinfecção com outra IST\n-Falha após tratamento correto\n-Prurido incapacitante',
 'criterios_encaminhamento':
  '-Encaminhar à oftalmologia se houver acometimento de cílios.\n'
  '-Encaminhar ao serviço de ISTs para rastreio e manejo de parceiros.\n'
  '-Encaminhar para avaliação protetiva se houver acometimento em criança.\n'
  '-Encaminhar em falha terapêutica.\n'
  '-Reavaliar em 2 semanas.',
 'observacoes_clinicas':
  '-Pediculose pubiana é marcador de exposição sexual e justifica rastreio de ISTs.\n'
  '-Acometimento de cílios exige tratamento específico, não o produto tópico comum.\n'
  '-A repetição do tratamento em 7 a 10 dias cobre as ninfas eclodidas.',
},
}

if __name__ == '__main__':
    executar(CLINICOS)

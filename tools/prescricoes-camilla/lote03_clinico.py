# -*- coding: utf-8 -*-
"""Lote 03 — micoses e dermatoses."""
from create_new import executar

D = ['Dermatologia', 'Clínica Médica', 'APS']
C = ['Adulto', 'APS', 'Ambulatorial']

CLINICOS = {
'DERMATOFITOSE INTERDIGITAL / PÉ DE ATLETA — ADULTO': {
 'especialidade': D, 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Infecção fúngica dos espaços interdigitais dos pés, geralmente por dermatófitos.\n'
  '-Cursa com descamação, maceração, fissuras e prurido, principalmente entre o 4º e o 5º pododáctilo.\n'
  '-Calor, umidade, oclusão e uso prolongado de calçado fechado favorecem o quadro.\n'
  '-É porta de entrada frequente para erisipela e celulite de membro inferior.\n'
  '-Responde bem a antifúngico tópico associado a medidas de secagem.',
 'quando_usar':
  '-Adulto com descamação, maceração ou fissura interdigital com prurido.\n'
  '-Quadro localizado, sem sinais de infecção bacteriana secundária.\n'
  '-Uso em APS e ambulatório, inclusive como tratamento de porta de entrada em erisipela de repetição.',
 'quando_nao_usar':
  '-Não tratar apenas como micose se houver eritema em placa com borda elevada, dor e febre: avaliar erisipela.\n'
  '-Não ignorar secreção purulenta, celulite ou linfangite associadas.\n'
  '-Não manejar apenas topicamente em diabético com neuropatia, imunossuprimido ou vasculopata.\n'
  '-Não confundir com psoríase, dermatite de contato ou eczema disidrótico.',
 'conduta_procedimento':
  '-Examinar todos os espaços interdigitais, plantas, bordas dos pés e unhas.\n'
  '-Investigar diabetes, neuropatia, insuficiência venosa e episódios prévios de erisipela.\n'
  '-Procurar onicomicose associada, que é fonte de recidiva.\n'
  '-Prescrever antifúngico tópico e orientar secagem cuidadosa dos espaços interdigitais.\n'
  '-Orientar troca diária de meias, calçados ventilados e não andar descalço em áreas úmidas coletivas.\n'
  '-Tratar infecção bacteriana secundária quando presente.\n'
  '-Reavaliar em 2 a 4 semanas.',
 'sinais_alerta':
  '-Eritema em placa com borda elevada\n-Febre\n-Dor intensa\n-Secreção purulenta\n-Linfangite\n'
  '-Celulite associada\n-Úlcera\n-Diabetes com neuropatia\n-Imunossupressão\n-Vasculopatia periférica',
 'criterios_encaminhamento':
  '-Encaminhar se houver suspeita de erisipela, celulite ou linfangite.\n'
  '-Encaminhar diabético com neuropatia ou vasculopata com lesão interdigital para avaliação de pé em risco.\n'
  '-Encaminhar à dermatologia em casos extensos, recorrentes ou refratários.\n'
  '-Reavaliar em 2 a 4 semanas.',
 'observacoes_clinicas':
  '-Tratar a dermatofitose interdigital reduz recorrência de erisipela de membro inferior.\n'
  '-A secagem dos espaços interdigitais é parte do tratamento, não apenas orientação acessória.\n'
  '-Onicomicose associada não tratada é causa comum de recidiva.',
},

'TINEA / MICOSE DE PELE OU COURO CABELUDO — ADULTO': {
 'especialidade': D, 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Dermatofitose da pele glabra ou do couro cabeludo, com placas anulares, borda descamativa e clareamento central.\n'
  '-No couro cabeludo pode causar descamação, alopecia em placas e, em formas inflamatórias, quérion.\n'
  '-Lesões cutâneas localizadas respondem a antifúngico tópico.\n'
  '-Acometimento de couro cabeludo, pelos ou lesões extensas exige antifúngico sistêmico.\n'
  '-Corticoide tópico isolado modifica a lesão e dificulta o diagnóstico (tinea incognita).',
 'quando_usar':
  '-Adulto com placa anular descamativa de crescimento centrífugo.\n'
  '-Descamação do couro cabeludo com alopecia em placa.\n'
  '-Uso em APS e ambulatório para definir tratamento tópico ou sistêmico.',
 'quando_nao_usar':
  '-Não tratar apenas topicamente lesão de couro cabeludo ou com acometimento de pelos.\n'
  '-Não usar corticoide tópico isolado.\n'
  '-Não ignorar lesão muito inflamatória, dolorosa e com pus (quérion), que exige tratamento sistêmico e avaliação especializada.\n'
  '-Não confundir com eczema numular, psoríase, pitiríase rosada ou dermatite seborreica.',
 'conduta_procedimento':
  '-Caracterizar a lesão: bordas, descamação, evolução centrífuga e acometimento de pelos ou unhas.\n'
  '-Perguntar sobre contato com animais, esporte de contato e casos semelhantes na família.\n'
  '-Investigar uso prévio de corticoide tópico, que altera a apresentação.\n'
  '-Prescrever antifúngico tópico em lesões cutâneas localizadas.\n'
  '-Indicar antifúngico sistêmico em acometimento de couro cabeludo, pelos, lesões extensas ou refratárias.\n'
  '-Orientar não compartilhar toalhas, pentes e bonés.\n'
  '-Reavaliar em 2 a 4 semanas; considerar exame micológico se não houver resposta.',
 'sinais_alerta':
  '-Acometimento de couro cabeludo\n-Alopecia em placa\n-Quérion (massa inflamatória dolorosa)\n'
  '-Lesões extensas ou múltiplas\n-Imunossupressão\n-Diabetes descompensado\n'
  '-Falha após 4 semanas de tratamento\n-Infecção bacteriana secundária',
 'criterios_encaminhamento':
  '-Encaminhar à dermatologia em acometimento de couro cabeludo, quérion, lesões extensas ou refratárias.\n'
  '-Encaminhar se houver imunossupressão ou dúvida diagnóstica que exija exame micológico.\n'
  '-Encaminhar se houver infecção bacteriana secundária importante.\n'
  '-Reavaliar em 2 a 4 semanas.',
 'observacoes_clinicas':
  '-Antifúngico sistêmico é necessário quando há acometimento de pelos ou couro cabeludo.\n'
  '-Uso prévio de corticoide tópico descaracteriza a lesão (tinea incognita).\n'
  '-Investigar e tratar a fonte, incluindo animais domésticos, reduz recorrência.',
},

'PITIRÍASE VERSICOLOR — ADULTO': {
 'especialidade': D, 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Micose superficial causada por leveduras do gênero Malassezia, parte da flora cutânea normal.\n'
  '-Cursa com máculas hipo ou hipercrômicas, com descamação fina, em tronco, pescoço e raiz dos membros.\n'
  '-Calor, sudorese e oleosidade favorecem a proliferação; recidiva é comum.\n'
  '-A repigmentação da pele é lenta e pode levar meses após a cura micológica.',
 'quando_usar':
  '-Adulto com máculas descamativas hipo ou hipercrômicas em tronco e raiz dos membros.\n'
  '-Quadro estético ou pruriginoso leve, sem sinais sistêmicos.\n'
  '-Uso em APS e ambulatório para tratamento tópico ou oral e orientação sobre recidiva.',
 'quando_nao_usar':
  '-Não interpretar a persistência da mancha clara após o tratamento como falha: a repigmentação é lenta.\n'
  '-Não confundir com vitiligo, pitiríase alba, hanseníase indeterminada ou eczemátide.\n'
  '-Não ignorar lesões com alteração de sensibilidade, que exigem investigação de hanseníase.\n'
  '-Não usar corticoide tópico como tratamento.',
 'conduta_procedimento':
  '-Caracterizar distribuição, descamação furfurácea e sinal do estiramento.\n'
  '-Testar sensibilidade das lesões para afastar hanseníase quando houver dúvida.\n'
  '-Investigar sudorese excessiva, uso de oleosos corporais e recidivas prévias.\n'
  '-Prescrever antifúngico tópico; reservar oral para casos extensos ou recorrentes.\n'
  '-Explicar que a diferença de cor persiste por semanas a meses após a cura.\n'
  '-Orientar medidas de recidiva e reavaliar em 4 semanas.',
 'sinais_alerta':
  '-Alteração de sensibilidade na lesão\n-Lesão com borda infiltrada\n-Espessamento de nervo periférico\n'
  '-Lesões muito extensas\n-Imunossupressão\n-Recidiva frequente apesar do tratamento correto',
 'criterios_encaminhamento':
  '-Encaminhar para investigação de hanseníase se houver alteração de sensibilidade ou lesão infiltrada.\n'
  '-Encaminhar à dermatologia em casos extensos, recorrentes ou com dúvida diagnóstica.\n'
  '-Encaminhar se houver imunossupressão associada.\n'
  '-Reavaliar em 4 semanas.',
 'observacoes_clinicas':
  '-A recidiva é comum porque o agente faz parte da flora normal da pele.\n'
  '-A repigmentação lenta não indica falha do tratamento.\n'
  '-Sempre testar sensibilidade quando houver mácula hipocrômica, para não perder hanseníase.',
},

'PSORÍASE LEVE — ADULTO': {
 'especialidade': D, 'contexto': C, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Doença inflamatória crônica e imunomediada, com placas eritemato-descamativas bem delimitadas e escamas prateadas.\n'
  '-Predomina em superfícies extensoras, couro cabeludo, região sacral e unhas.\n'
  '-Cursa com períodos de melhora e piora; estresse, infecções, trauma e alguns medicamentos são gatilhos.\n'
  '-Formas leves e localizadas são manejadas com tópicos, hidratação e queratolíticos.\n'
  '-Pode associar-se a artrite psoriásica e a maior risco cardiovascular e metabólico.',
 'quando_usar':
  '-Adulto com placas eritemato-descamativas típicas, acometendo área corporal limitada.\n'
  '-Doença estável, sem eritrodermia, pústulas generalizadas ou artrite incapacitante.\n'
  '-Uso em APS e ambulatório para tratamento tópico e orientação de manutenção.',
 'quando_nao_usar':
  '-Não manejar apenas topicamente se houver acometimento extenso, eritrodermia ou psoríase pustulosa generalizada.\n'
  '-Não ignorar dor, rigidez matinal e edema articular: podem indicar artrite psoriásica.\n'
  '-Não suspender corticoide sistêmico abruptamente nem usá-lo de rotina, pelo risco de rebote grave.\n'
  '-Não confundir com dermatite seborreica, eczema numular, tinea ou líquen plano.',
 'conduta_procedimento':
  '-Estimar a área acometida e examinar couro cabeludo, unhas, região sacral e dobras.\n'
  '-Investigar dor e rigidez articular, dactilite e história familiar.\n'
  '-Revisar medicamentos que podem desencadear ou agravar o quadro.\n'
  '-Avaliar risco cardiovascular e metabólico, incluindo pressão, glicemia, lipídios e peso.\n'
  '-Prescrever hidratante e queratolítico; associar corticoide tópico por período limitado conforme a área.\n'
  '-Orientar sobre cronicidade, gatilhos e adesão à manutenção.\n'
  '-Reavaliar em 4 a 8 semanas.',
 'sinais_alerta':
  '-Eritrodermia\n-Pústulas generalizadas\n-Febre com lesões extensas\n-Artrite com limitação funcional\n'
  '-Dactilite\n-Acometimento extenso e progressivo\n-Impacto emocional importante\n-Imunossupressão',
 'criterios_encaminhamento':
  '-Encaminhar à emergência se houver eritrodermia, pústulas generalizadas ou febre com lesões extensas.\n'
  '-Encaminhar à dermatologia em doença extensa, refratária ao tópico ou com grande impacto funcional.\n'
  '-Encaminhar à reumatologia se houver suspeita de artrite psoriásica.\n'
  '-Encaminhar para manejo de risco cardiovascular e metabólico quando indicado.\n'
  '-Reavaliar em 4 a 8 semanas.',
 'observacoes_clinicas':
  '-Corticoide sistêmico não é tratamento de rotina da psoríase pelo risco de rebote na retirada.\n'
  '-Hidratação e queratolítico melhoram a resposta ao tratamento tópico.\n'
  '-Rastrear artrite psoriásica e risco cardiovascular faz parte do cuidado.',
},

'DERMATITE SEBORREICA LEVE — ADULTO': {
 'especialidade': D, 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Dermatose crônica e recidivante em áreas ricas em glândulas sebáceas: couro cabeludo, face central, sobrancelhas, região retroauricular e tórax.\n'
  '-Cursa com eritema e descamação untuosa amarelada, com prurido variável.\n'
  '-Relaciona-se a Malassezia, estresse, privação de sono e clima frio.\n'
  '-O tratamento controla, mas não cura: recidivas são esperadas e exigem manutenção.\n'
  '-Quadro extenso, refratário ou de início abrupto exige atenção a imunossupressão.',
 'quando_usar':
  '-Adulto com descamação e eritema em couro cabeludo, face central ou região retroauricular.\n'
  '-Quadro leve a moderado, sem eritrodermia.\n'
  '-Uso em APS e ambulatório para tratamento tópico e plano de manutenção.',
 'quando_nao_usar':
  '-Não manejar apenas topicamente se houver eritrodermia ou acometimento extenso e refratário.\n'
  '-Não usar corticoide tópico potente de forma contínua na face.\n'
  '-Não ignorar quadro extenso e abrupto, que pode associar-se a imunossupressão.\n'
  '-Não confundir com psoríase, rosácea, dermatite de contato ou tinea da face.',
 'conduta_procedimento':
  '-Delimitar áreas acometidas e caracterizar descamação e prurido.\n'
  '-Investigar fatores desencadeantes: estresse, sono, clima e uso de cosméticos.\n'
  '-Considerar avaliação de imunossupressão em quadro extenso, abrupto ou refratário.\n'
  '-Prescrever antifúngico tópico ou xampu; associar corticoide de baixa potência por curto período se houver inflamação.\n'
  '-Orientar manutenção com xampu antifúngico em frequência reduzida.\n'
  '-Reavaliar em 4 semanas.',
 'sinais_alerta':
  '-Eritrodermia\n-Acometimento extenso de início abrupto\n-Refratariedade ao tratamento\n'
  '-Imunossupressão conhecida ou suspeita\n-Infecção secundária\n-Lesões com sangramento ou dor',
 'criterios_encaminhamento':
  '-Encaminhar à dermatologia em quadro extenso, refratário ou com dúvida diagnóstica.\n'
  '-Encaminhar para investigação se houver suspeita de imunossupressão.\n'
  '-Encaminhar à emergência se houver eritrodermia.\n'
  '-Reavaliar em 4 semanas.',
 'observacoes_clinicas':
  '-O tratamento controla e não cura: a manutenção é parte do plano.\n'
  '-Corticoide potente contínuo na face causa atrofia e dermatite perioral.\n'
  '-Quadro extenso e abrupto justifica investigar imunossupressão.',
},

'MOLUSCO CONTAGIOSO — ADULTO': {
 'especialidade': D, 'contexto': C, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Infecção viral cutânea por poxvírus, com pápulas peroladas umbilicadas de 2 a 5 mm.\n'
  '-Transmite-se por contato direto, fômites e autoinoculação; em adultos, a transmissão sexual é frequente.\n'
  '-Costuma ser autolimitada, com resolução em meses a cerca de dois anos.\n'
  '-Lesões numerosas, extensas ou de difícil controle em adulto levantam a hipótese de imunossupressão.',
 'quando_usar':
  '-Adulto com pápulas peroladas umbilicadas, isoladas ou agrupadas.\n'
  '-Quadro localizado, sem sinais de infecção secundária importante.\n'
  '-Uso em APS e ambulatório para orientação, medidas de contágio e indicação de remoção.',
 'quando_nao_usar':
  '-Não ignorar lesões numerosas ou extensas em adulto: investigar imunossupressão, incluindo HIV.\n'
  '-Não tratar lesões periorbitárias sem avaliação especializada.\n'
  '-Não confundir com verruga viral, criptococose cutânea ou carcinoma basocelular.\n'
  '-Não manipular lesões em casa, pelo risco de autoinoculação e infecção secundária.',
 'conduta_procedimento':
  '-Contar e localizar as lesões; examinar região genital em adultos.\n'
  '-Investigar contato sexual recente e considerar rastreio de outras ISTs quando pertinente.\n'
  '-Avaliar sinais de imunossupressão em quadros extensos.\n'
  '-Orientar não coçar nem espremer, uso de toalhas individuais e cuidado no contato íntimo.\n'
  '-Discutir conduta expectante versus remoção conforme número, localização e incômodo.\n'
  '-Tratar infecção bacteriana secundária quando presente.\n'
  '-Reavaliar conforme evolução e necessidade de procedimento.',
 'sinais_alerta':
  '-Lesões numerosas ou extensas em adulto\n-Lesão periorbitária\n-Imunossupressão conhecida ou suspeita\n'
  '-Infecção bacteriana secundária\n-Crescimento rápido de lesão isolada\n-Sangramento ou ulceração',
 'criterios_encaminhamento':
  '-Encaminhar à dermatologia para remoção quando indicada ou em lesões extensas.\n'
  '-Encaminhar à oftalmologia em lesão periorbitária.\n'
  '-Encaminhar para investigação de imunossupressão em quadro extenso no adulto.\n'
  '-Considerar rastreio de ISTs em acometimento genital.',
 'observacoes_clinicas':
  '-A resolução espontânea é a regra em imunocompetentes, embora possa demorar.\n'
  '-Molusco extenso em adulto justifica investigar imunossupressão.\n'
  '-Evitar manipulação reduz autoinoculação e infecção secundária.',
},
}

if __name__ == '__main__':
    executar(CLINICOS)

# -*- coding: utf-8 -*-
"""Lote 01 — conteudo clinico dos guias novos."""
from create_new import executar

CLINICOS = {
'ABSCESSO / FURÚNCULO — ADULTO': {
 'especialidade': ['Dermatologia', 'Cirurgia Geral', 'Infectologia', 'APS'],
 'contexto': ['Adulto', 'APS', 'Ambulatorial', 'PS'],
 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Abscesso cutâneo é coleção purulenta na derme ou tecido subcutâneo; furúnculo é a infecção do folículo piloso que evolui com necrose central.\n'
  '-O agente mais comum é Staphylococcus aureus, incluindo cepas resistentes à meticilina na comunidade.\n'
  '-O tratamento principal do abscesso com flutuação é a drenagem; o antibiótico é complementar, não substitui o procedimento.\n'
  '-Lesões pequenas, sem flutuação e sem celulite ao redor podem responder a calor local e observação.\n'
  '-Antibiótico sistêmico é indicado quando há celulite associada, múltiplas lesões, sintomas sistêmicos, imunossupressão, diabetes ou localização de risco (face, mão, região perianal).',
 'quando_usar':
  '-Adulto com nódulo cutâneo doloroso, quente, eritematoso, com ou sem flutuação.\n'
  '-Furúnculo isolado ou abscesso localizado, em paciente estável.\n'
  '-Uso em APS, ambulatório ou pronto atendimento para orientar drenagem, analgesia e antibioticoterapia.\n'
  '-Quando é necessário decidir entre manejo local isolado e antibiótico sistêmico.',
 'quando_nao_usar':
  '-Não manejar ambulatorialmente se houver febre alta, calafrios, hipotensão, taquicardia ou sinais de sepse.\n'
  '-Não tratar como abscesso simples lesões em face central, região periorbitária, mão ou região perianal sem avaliação especializada.\n'
  '-Não postergar avaliação cirúrgica se houver crepitação, dor desproporcional, bolhas, necrose ou suspeita de fasciíte necrosante.\n'
  '-Não usar apenas antibiótico quando há flutuação evidente: a drenagem é o tratamento principal.\n'
  '-Não ignorar imunossupressão, diabetes descompensado, uso de corticoide ou neutropenia, que exigem limiar menor para encaminhamento.',
 'conduta_procedimento':
  '-Avaliar sinais vitais, extensão do eritema, presença de flutuação, linfangite e adenomegalia regional.\n'
  '-Delimitar a área de celulite com caneta para permitir comparação na reavaliação.\n'
  '-Investigar diabetes, imunossupressão, uso de drogas injetáveis, episódios prévios e colonização nasal por S. aureus.\n'
  '-Drenar quando houver flutuação: antissepsia, anestesia local, incisão no ponto de maior flutuação, quebra de loculações e lavagem.\n'
  '-Considerar cultura da secreção em falha terapêutica, imunossupressão, lesões recorrentes ou suspeita de MRSA.\n'
  '-Prescrever antibiótico sistêmico quando houver celulite associada, sintomas sistêmicos, múltiplas lesões, comorbidade de risco ou localização crítica.\n'
  '-Orientar calor local úmido e higiene, evitando espremer a lesão.\n'
  '-Reavaliar em 48 a 72 horas para confirmar redução da dor e do eritema.\n'
  '-Registrar tamanho da lesão, se houve drenagem, aspecto da secreção, antibiótico escolhido e orientação de retorno.',
 'sinais_alerta':
  '-Febre alta\n-Calafrios\n-Hipotensão\n-Taquicardia\n-Dor desproporcional ao exame\n-Crepitação\n-Bolhas ou necrose\n'
  '-Progressão rápida do eritema\n-Linfangite ascendente\n-Lesão em face central ou periorbitária\n-Lesão em mão\n'
  '-Lesão perianal\n-Diabetes descompensado\n-Imunossupressão\n-Falha após 48 a 72 horas de tratamento',
 'criterios_encaminhamento':
  '-Encaminhar à emergência se houver febre alta, calafrios, hipotensão, taquicardia ou suspeita de sepse.\n'
  '-Encaminhar com urgência se houver crepitação, bolhas, necrose, dor desproporcional ou suspeita de fasciíte necrosante.\n'
  '-Encaminhar à cirurgia se o abscesso for extenso, profundo, multiloculado ou de difícil drenagem ambulatorial.\n'
  '-Encaminhar se a lesão estiver em face central, região periorbitária, mão ou região perianal.\n'
  '-Encaminhar se não houver melhora em 48 a 72 horas ou se houver recorrência frequente.\n'
  '-Reavaliar em 48 a 72 horas todos os casos manejados ambulatorialmente.',
 'observacoes_clinicas':
  '-A drenagem é o tratamento principal do abscesso com flutuação; o antibiótico isolado tende a falhar.\n'
  '-Considerar cobertura para MRSA comunitário em falha terapêutica, abscesso recorrente ou fator de risco epidemiológico.\n'
  '-Furunculose de repetição pode exigir investigação de colonização e medidas de descolonização.\n'
  '-Evitar espremer lesões, especialmente em face, pelo risco de disseminação.',
},

'AFTAS E GENGIVITE — ADULTO': {
 'especialidade': ['Clínica Médica', 'APS', 'Medicina de Família'],
 'contexto': ['Adulto', 'APS', 'Ambulatorial'],
 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Aftas (estomatite aftosa recorrente) são úlceras orais dolorosas, rasas, de fundo esbranquiçado e halo eritematoso, geralmente autolimitadas em 7 a 14 dias.\n'
  '-Gengivite é a inflamação gengival associada a placa bacteriana, com sangramento à escovação e edema, reversível com higiene adequada.\n'
  '-A maioria dos casos é benigna e responde a higiene oral, antisséptico tópico e analgesia.\n'
  '-Aftas extensas, muito frequentes ou que não cicatrizam em 3 semanas exigem investigação de causa sistêmica.',
 'quando_usar':
  '-Adulto com úlceras orais dolorosas recorrentes e autolimitadas.\n'
  '-Gengivite com sangramento à escovação, sem abscesso ou comprometimento sistêmico.\n'
  '-Uso em APS e ambulatório para alívio sintomático e orientação de higiene oral.',
 'quando_nao_usar':
  '-Não tratar como afta simples úlcera única que persiste por mais de 3 semanas, com bordas endurecidas ou base infiltrada: investigar neoplasia.\n'
  '-Não manejar apenas localmente se houver febre, adenomegalia importante, disfagia intensa ou desidratação.\n'
  '-Não ignorar aftas muito frequentes associadas a lesões genitais, oculares, cutâneas ou sintomas gastrointestinais.\n'
  '-Não ignorar imunossupressão, neutropenia ou uso de quimioterápico, que mudam o diagnóstico diferencial.\n'
  '-Não confundir gengivite simples com abscesso dentário ou gengivite ulcerativa necrosante, que exigem outra conduta.',
 'conduta_procedimento':
  '-Caracterizar número, tamanho, localização, duração e recorrência das lesões.\n'
  '-Examinar toda a cavidade oral, incluindo língua, assoalho, palato e orofaringe.\n'
  '-Investigar febre, perda de peso, lesões em outros sítios, sintomas gastrointestinais e uso de medicamentos.\n'
  '-Avaliar higiene oral, presença de placa, tártaro e necessidade de avaliação odontológica.\n'
  '-Orientar antisséptico tópico e analgesia conforme a intensidade da dor.\n'
  '-Encaminhar à odontologia para profilaxia e tratamento periodontal na gengivite.\n'
  '-Considerar investigação laboratorial (hemograma, ferritina, B12, folato) em aftas recorrentes.\n'
  '-Reavaliar se não houver cicatrização em 2 a 3 semanas.',
 'sinais_alerta':
  '-Úlcera com mais de 3 semanas\n-Bordas endurecidas\n-Base infiltrada\n-Perda de peso\n-Febre persistente\n'
  '-Adenomegalia cervical endurecida\n-Disfagia importante\n-Desidratação\n-Lesões genitais ou oculares associadas\n'
  '-Imunossupressão\n-Neutropenia\n-Sangramento gengival espontâneo abundante',
 'criterios_encaminhamento':
  '-Encaminhar para avaliação especializada se a úlcera persistir por mais de 3 semanas ou tiver características suspeitas.\n'
  '-Encaminhar à odontologia para tratamento periodontal na gengivite ou quando houver foco dentário.\n'
  '-Encaminhar se houver aftas recorrentes com lesões genitais, oculares, cutâneas ou sintomas sistêmicos.\n'
  '-Encaminhar à emergência se houver desidratação por dor, disfagia intensa ou sinais sistêmicos.\n'
  '-Reavaliar em 2 a 3 semanas os casos que não cicatrizaram.',
 'observacoes_clinicas':
  '-A maioria das aftas é autolimitada e o tratamento é sintomático.\n'
  '-Gengivite reverte com controle de placa: a higiene oral é o tratamento principal.\n'
  '-Aftas recorrentes podem associar-se a deficiência de ferro, B12 ou folato.\n'
  '-Úlcera oral que não cicatriza em 3 semanas exige exclusão de neoplasia.',
},
}

if __name__ == '__main__':
    executar(CLINICOS)

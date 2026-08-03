# -*- coding: utf-8 -*-
"""Lote 02 — dermatologia e partes moles."""
from create_new import executar

DERM = ['Dermatologia', 'Clínica Médica', 'APS']
CTX = ['Adulto', 'APS', 'Ambulatorial']

CLINICOS = {
'ERISIPELA — ADULTO': {
 'especialidade': ['Dermatologia', 'Infectologia', 'Clínica Médica', 'APS'],
 'contexto': ['Adulto', 'APS', 'Ambulatorial', 'PS'],
 'nivel_risco': ['Moderado', 'Alto'],
 'resumo_clinico':
  '-Erisipela é infecção bacteriana da derme superficial e dos linfáticos, geralmente por Streptococcus pyogenes.\n'
  '-Manifesta-se como placa eritematosa de bordas bem delimitadas e elevadas, quente e dolorosa, com progressão rápida.\n'
  '-Febre e calafrios podem preceder o aparecimento da lesão cutânea.\n'
  '-O membro inferior é o sítio mais comum; procurar sempre a porta de entrada (micose interdigital, fissura, úlcera, trauma).\n'
  '-Diferencia-se da celulite pela borda nítida e pelo acometimento mais superficial.',
 'quando_usar':
  '-Adulto com placa eritematosa de bordas bem definidas, quente, dolorosa, de instalação aguda.\n'
  '-Febre ou calafrios associados a lesão cutânea compatível.\n'
  '-Paciente estável, sem sinais de sepse, para tratamento ambulatorial com antibiótico oral.\n'
  '-Uso em APS, ambulatório ou pronto atendimento.',
 'quando_nao_usar':
  '-Não tratar ambulatorialmente se houver hipotensão, taquicardia, confusão, febre alta persistente ou sinais de sepse.\n'
  '-Não tratar como erisipela simples se houver dor desproporcional, crepitação, bolhas hemorrágicas, necrose ou anestesia local: suspeitar de fasciíte necrosante.\n'
  '-Não manejar apenas por via oral em imunossuprimido, diabético descompensado, cirrótico ou paciente com má perfusão.\n'
  '-Não ignorar acometimento facial, que exige limiar menor para internação.\n'
  '-Não deixar de tratar a porta de entrada: sem isso a recorrência é frequente.',
 'conduta_procedimento':
  '-Avaliar sinais vitais, extensão e progressão da placa, temperatura e estado geral.\n'
  '-Delimitar a borda com caneta e datar, para comparar na reavaliação.\n'
  '-Procurar ativamente a porta de entrada: espaços interdigitais, fissuras, úlceras, feridas e onicomicose.\n'
  '-Investigar diabetes, insuficiência venosa, linfedema, obesidade, imunossupressão e episódios prévios.\n'
  '-Avaliar diferenciais: celulite, trombose venosa profunda, dermatite de contato, fasciíte necrosante e eritema migratório.\n'
  '-Iniciar antibiótico com cobertura para estreptococo; elevar o membro acometido.\n'
  '-Tratar a porta de entrada, incluindo antifúngico se houver micose interdigital.\n'
  '-Reavaliar em 48 a 72 horas: espera-se redução da febre e da progressão da borda.\n'
  '-Registrar extensão inicial, porta de entrada, antibiótico, resposta e orientação de retorno.',
 'sinais_alerta':
  '-Dor desproporcional ao exame\n-Crepitação\n-Bolhas hemorrágicas\n-Necrose\n-Anestesia sobre a lesão\n'
  '-Progressão rápida apesar do antibiótico\n-Hipotensão\n-Taquicardia\n-Confusão\n-Febre alta persistente\n'
  '-Acometimento facial\n-Imunossupressão\n-Diabetes descompensado\n-Linfedema extenso',
 'criterios_encaminhamento':
  '-Encaminhar à emergência se houver hipotensão, taquicardia, confusão, febre alta persistente ou suspeita de sepse.\n'
  '-Encaminhar com urgência cirúrgica se houver dor desproporcional, crepitação, bolhas hemorrágicas ou necrose.\n'
  '-Encaminhar para tratamento venoso se não houver melhora em 48 a 72 horas de antibiótico oral.\n'
  '-Encaminhar se houver acometimento facial, imunossupressão, diabetes descompensado ou cirrose.\n'
  '-Encaminhar à angiologia ou dermatologia em erisipela de repetição, para manejo de linfedema e profilaxia.\n'
  '-Reavaliar em 48 a 72 horas todos os casos ambulatoriais.',
 'observacoes_clinicas':
  '-A borda bem delimitada e elevada é o achado que diferencia erisipela de celulite.\n'
  '-Tratar a porta de entrada é essencial: micose interdigital não tratada é causa frequente de recorrência.\n'
  '-A melhora do eritema pode demorar mais que a da febre; a piora da borda é que indica falha.\n'
  '-Erisipela de repetição pode exigir profilaxia antibiótica prolongada, definida por especialista.',
},

'FOLICULITE — ADULTO': {
 'especialidade': DERM, 'contexto': CTX, 'nivel_risco': ['Baixo'],
 'resumo_clinico':
  '-Foliculite é a inflamação do folículo piloso, com pápulas ou pústulas centradas no pelo.\n'
  '-A causa mais comum é bacteriana, principalmente Staphylococcus aureus, mas há formas por fungos, irritação mecânica e oclusão.\n'
  '-Depilação, raspagem, roupas apertadas, oclusão e umidade são fatores desencadeantes frequentes.\n'
  '-A maioria dos casos é leve e responde a higiene, antisséptico e antibiótico tópico.\n'
  '-Foliculite após banho de piscina ou banheira aquecida sugere Pseudomonas e costuma ser autolimitada.',
 'quando_usar':
  '-Adulto com pápulas ou pústulas foliculares, pruriginosas ou discretamente dolorosas.\n'
  '-Quadro localizado, sem febre e sem celulite ao redor.\n'
  '-Uso em APS e ambulatório para tratamento tópico e orientação de medidas locais.',
 'quando_nao_usar':
  '-Não tratar como foliculite simples se houver nódulo flutuante: trata-se de furúnculo ou abscesso e pode exigir drenagem.\n'
  '-Não manejar apenas topicamente se houver celulite ao redor, febre ou sintomas sistêmicos.\n'
  '-Não ignorar lesões extensas, recorrentes ou refratárias em imunossuprimido ou diabético.\n'
  '-Não confundir com acne, pseudofoliculite da barba, miliária ou foliculite eosinofílica.\n'
  '-Não usar corticoide tópico como tratamento principal.',
 'conduta_procedimento':
  '-Caracterizar distribuição, relação com depilação, oclusão, exposição a piscina ou banheira aquecida.\n'
  '-Diferenciar de furúnculo, abscesso, acne e pseudofoliculite da barba.\n'
  '-Investigar diabetes, imunossupressão e uso recente de antibiótico ou corticoide.\n'
  '-Orientar suspensão temporária da depilação na área e uso de roupas leves.\n'
  '-Prescrever antisséptico e antibiótico tópico; reservar antibiótico oral para casos extensos ou refratários.\n'
  '-Reavaliar em 7 a 10 dias; considerar cultura se não houver resposta.',
 'sinais_alerta':
  '-Nódulo flutuante\n-Celulite ao redor\n-Febre\n-Linfangite\n-Progressão rápida\n-Dor intensa\n'
  '-Lesões extensas ou disseminadas\n-Recorrência frequente\n-Imunossupressão\n-Diabetes descompensado\n'
  '-Falta de resposta após 7 a 10 dias',
 'criterios_encaminhamento':
  '-Encaminhar se houver evolução para furúnculo ou abscesso com necessidade de drenagem.\n'
  '-Encaminhar se houver celulite associada, febre ou sintomas sistêmicos.\n'
  '-Encaminhar à dermatologia em foliculite recorrente, extensa ou refratária ao tratamento tópico.\n'
  '-Encaminhar se houver imunossupressão ou diabetes descompensado com lesões extensas.\n'
  '-Reavaliar em 7 a 10 dias.',
 'observacoes_clinicas':
  '-Medidas locais e suspensão do fator desencadeante costumam resolver os casos leves.\n'
  '-Foliculite por Pseudomonas após piscina ou banheira aquecida geralmente é autolimitada.\n'
  '-Antibiótico oral deve ser reservado a casos extensos, recorrentes ou com celulite associada.',
},

'IMPETIGO / ECTIMA — ADULTO': {
 'especialidade': ['Dermatologia', 'Infectologia', 'Clínica Médica', 'APS'],
 'contexto': ['Adulto', 'APS', 'Ambulatorial', 'PS'],
 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Impetigo é infecção cutânea superficial por Staphylococcus aureus ou Streptococcus pyogenes, com crostas melicéricas características.\n'
  '-A forma bolhosa apresenta bolhas flácidas que rompem e deixam colarete descamativo.\n'
  '-Ectima é a forma mais profunda, com ulceração recoberta por crosta aderida e cicatriz residual.\n'
  '-É altamente contagioso por contato direto e fômites.\n'
  '-Lesões localizadas respondem a antibiótico tópico; formas extensas, múltiplas ou ectima exigem antibiótico sistêmico.',
 'quando_usar':
  '-Adulto com lesões crostosas cor de mel, bolhas superficiais ou úlceras rasas com crosta aderida.\n'
  '-Quadro sem febre, sem celulite extensa e sem sintomas sistêmicos.\n'
  '-Uso em APS, ambulatório ou pronto atendimento para definir tratamento tópico ou sistêmico e orientar medidas de contágio.',
 'quando_nao_usar':
  '-Não manejar apenas topicamente se houver lesões numerosas, disseminadas, ectima ou celulite associada.\n'
  '-Não tratar ambulatorialmente se houver febre, sinais sistêmicos ou suspeita de sepse.\n'
  '-Não ignorar urina escura, edema ou hipertensão após o quadro: podem indicar glomerulonefrite pós-estreptocócica.\n'
  '-Não ignorar imunossupressão, diabetes descompensado ou dermatite de base extensa.\n'
  '-Não confundir com herpes simples, dermatite de contato, escabiose impetiginizada ou queimadura.',
 'conduta_procedimento':
  '-Caracterizar número, extensão, profundidade das lesões e presença de crosta melicérica.\n'
  '-Investigar contato próximo com caso semelhante, dermatite de base, prurido e trauma cutâneo.\n'
  '-Avaliar sinais de celulite, linfangite, adenomegalia e comprometimento sistêmico.\n'
  '-Orientar remoção suave das crostas com água e sabão antes da aplicação do tópico.\n'
  '-Indicar antibiótico tópico em lesões localizadas e antibiótico sistêmico em lesões múltiplas, extensas ou ectima.\n'
  '-Orientar medidas de contágio: higiene das mãos, toalhas individuais, unhas curtas e afastamento de atividades de contato até 24 horas de antibiótico.\n'
  '-Reavaliar em 5 a 7 dias; investigar sinais de glomerulonefrite se houver urina escura ou edema.',
 'sinais_alerta':
  '-Febre\n-Celulite associada\n-Linfangite\n-Lesões disseminadas\n-Ectima profundo\n-Dor intensa\n'
  '-Urina escura\n-Edema palpebral ou de membros\n-Hipertensão de início recente\n-Imunossupressão\n'
  '-Diabetes descompensado\n-Falha após 5 a 7 dias de tratamento',
 'criterios_encaminhamento':
  '-Encaminhar à emergência se houver febre, sinais sistêmicos, celulite extensa ou suspeita de sepse.\n'
  '-Encaminhar se houver ectima profundo, lesões disseminadas ou falha do tratamento tópico.\n'
  '-Encaminhar para investigação renal se surgirem urina escura, edema ou hipertensão após o quadro.\n'
  '-Encaminhar à dermatologia em recorrência frequente ou dermatite de base não controlada.\n'
  '-Reavaliar em 5 a 7 dias.',
 'observacoes_clinicas':
  '-A crosta melicérica é o achado clássico do impetigo não bolhoso.\n'
  '-Antibiótico tópico é suficiente na maioria das formas localizadas.\n'
  '-O tratamento antibiótico não previne glomerulonefrite pós-estreptocócica, mas reduz a transmissão.\n'
  '-Orientar afastamento de contato próximo até 24 horas após o início do antibiótico.',
},

'ESCABIOSE / SARNA — ADULTO': {
 'especialidade': ['Dermatologia', 'Infectologia', 'Clínica Médica', 'APS'],
 'contexto': CTX, 'nivel_risco': ['Baixo', 'Moderado'],
 'resumo_clinico':
  '-Escabiose é a infestação cutânea pelo Sarcoptes scabiei, transmitida por contato direto prolongado.\n'
  '-O sintoma dominante é prurido intenso, tipicamente de piora noturna.\n'
  '-As lesões predominam em espaços interdigitais, punhos, axilas, cintura, região periumbilical, genitália e mamas.\n'
  '-O tratamento deve incluir todos os contatos domiciliares, mesmo assintomáticos, e medidas com roupas e roupas de cama.\n'
  '-O prurido pode persistir por 2 a 4 semanas após o tratamento eficaz e não significa falha.',
 'quando_usar':
  '-Adulto com prurido intenso de predomínio noturno e lesões em sítios característicos.\n'
  '-História de prurido em outros moradores da casa ou contato próximo.\n'
  '-Uso em APS e ambulatório para tratamento tópico ou oral e orientação de medidas domiciliares.',
 'quando_nao_usar':
  '-Não tratar apenas o paciente: sem tratar os contatos domiciliares a reinfestação é a regra.\n'
  '-Não interpretar prurido residual até 4 semanas como falha terapêutica.\n'
  '-Não manejar como escabiose comum a forma crostosa (norueguesa), que é altamente contagiosa e exige manejo específico.\n'
  '-Não ignorar impetiginização secundária, que exige antibiótico associado.\n'
  '-Não usar ivermectina oral sem considerar contraindicações, incluindo gestação e baixo peso.',
 'conduta_procedimento':
  '-Caracterizar prurido, horário de piora, distribuição das lesões e presença de túneis.\n'
  '-Investigar contatos domiciliares, institucionalização e contato íntimo recente.\n'
  '-Avaliar sinais de infecção secundária: crostas melicéricas, pústulas, celulite.\n'
  '-Tratar simultaneamente todos os contatos domiciliares, mesmo assintomáticos.\n'
  '-Orientar lavagem de roupas de uso e de cama em água quente e secagem ao sol, ou isolamento em saco fechado por 72 horas.\n'
  '-Orientar aplicação do tópico do pescoço para baixo, incluindo dobras, região periungueal e genitália.\n'
  '-Tratar infecção secundária quando presente e prescrever anti-histamínico para o prurido.\n'
  '-Reavaliar em 2 a 4 semanas; considerar repetir o tratamento conforme esquema.',
 'sinais_alerta':
  '-Lesões crostosas extensas (escabiose crostosa)\n-Imunossupressão\n-Impetiginização com celulite\n-Febre\n'
  '-Falha após tratamento correto de todos os contatos\n-Prurido incapacitante\n-Institucionalização\n'
  '-Gestação\n-Lactente ou baixo peso',
 'criterios_encaminhamento':
  '-Encaminhar à dermatologia se houver escabiose crostosa, falha terapêutica ou dúvida diagnóstica.\n'
  '-Encaminhar se houver imunossupressão associada.\n'
  '-Encaminhar à emergência se houver celulite extensa, febre ou sinais sistêmicos.\n'
  '-Acionar vigilância se houver surto institucional.\n'
  '-Reavaliar em 2 a 4 semanas.',
 'observacoes_clinicas':
  '-Tratar todos os contatos domiciliares ao mesmo tempo é o ponto crítico para evitar reinfestação.\n'
  '-Prurido residual por até 4 semanas é esperado e tratado sintomaticamente.\n'
  '-Escabiose crostosa é altamente contagiosa e exige precaução de contato.\n'
  '-Ivermectina oral exige atenção a gestação, amamentação e baixo peso.',
},
}

if __name__ == '__main__':
    executar(CLINICOS)

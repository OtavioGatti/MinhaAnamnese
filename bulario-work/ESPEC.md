# Especificação — reescrita de bulas (Bulário MinhaAnamnese)

Você reescreve bulas para um app médico brasileiro (médicos em consultório e plantão).
O dono é médico e revisa tudo depois. Trabalhe só dentro de `bulario-work/`.

## Entradas (por lote, ex.: `bulario-work/lote3/`)
- `manifesto.json` — por slug: `principal` (bula profissional oficial), `complementares` (outras
  apresentações do mesmo princípio ativo), `fontes_de_classe` (uso restrito, ver regra 3),
  `receituario` (chave de `_normas`), `observacao`.
- `fontes.json` — marca, empresa, data de publicação e categoria da bula principal.
- `<slug>.atual.json` — o que está publicado hoje. Serve só para comparar; NÃO é fonte.
- `*.txt` — textos recortados das bulas (seções 1, 3, 4, 5, 6, 8, 9, 10).

## Regras inegociáveis
1. FONTE: todo dado clínico (dose, contraindicação, interação, categoria de gestação etc.) tem
   que estar nas bulas listadas no manifesto. Não complete com conhecimento próprio, diretrizes
   ou "prática usual". Se a bula não traz, deixe "" ou escreva "A bula não traz recomendação
   específica." — nunca invente.
2. BASE = bula principal + complementares. Some as apresentações: a posologia cobre todas,
   organizada por apresentação/via. Nenhuma apresentação com bula fornecida pode sumir.
3. FONTES DE CLASSE: use só para o alerta indicado no manifesto. Escreva o alerta no campo
   adequado e acrescente "(fonte: bula <Marca>)". Cite cada uma em "Referências".
4. VERSÃO ATUAL: se `.atual.json` tem algo que a bula contradiz, siga a bula e registre em
   "Mudanças na Revisão". Se tem um alerta/dose que NENHUMA fonte fornecida sustenta, não
   mantenha; registre "removido — sem fonte nas bulas usadas: <item>".
5. NÚMEROS exatamente como na bula (doses, mg/kg, intervalos, máximos, faixas de peso/idade,
   ClCr). Converta unidades só se trivial e mostre as duas (ex.: "0,2 mL (100 mg)").
6. DOSE DA BULA MUITO DIFERENTE DA PRÁTICA: mantenha a da bula e registre em
   "_alertas_para_revisor".
7. COMPLETUDE: cubra TODAS as vias e apresentações — oral, gotas, suspensão/xarope, injetável
   (IM/IV, diluição, velocidade/tempo de infusão), tópico, retal — com dose inicial, de
   manutenção, máxima (por dose e por dia), duração, pediatria por idade/peso e ajustes
   renal/hepático. Inclua conversões práticas que a bula der (mL, gotas, medidas). Antes de
   gravar, releia a seção 8 de cada bula e confira que cada dose numérica aparece no texto.
8. ESTILO: português do Brasil, técnico e enxuto. Frases curtas; listas com "- ". Sem markdown
   (sem **, #, tabelas). Não copie parágrafos longos literalmente: resuma fielmente.
9. TAMANHO: cada campo de texto com no máximo 1800 caracteres ("Texto Resumo" 500;
   "Mudanças na Revisão" 900).

## Saída: `bulario-work/<lote>_out/<slug>.json` — um objeto JSON com EXATAMENTE estas chaves
Texto (string): "Classe / Categoria", "Texto Resumo" (2 a 4 frases: para que serve, dose-chave,
principais riscos), "Indicações", "Mecanismo de Ação", "Posologia Adulto", "Posologia
Pediátrica" (se a bula contraindicar/não recomendar em crianças, diga isso e a idade),
"Administração", "Apresentações / Nomes Comerciais" (só formas e marcas que estão nas bulas),
"Contraindicações", "Advertências", "Efeitos Adversos" (mais comuns e graves), "Interações",
"Ajuste Renal", "Ajuste Hepático", "Uso na Gestação" (com a categoria se a bula disser),
"Lactação", "Uso Geriátrico", "Perioperatório" (só se a bula disser; senão ""),
"Monitoramento" (exames/sinais e superdose: sintomas + conduta da bula), "Tags Busca"
(nomes, sinônimos, marca, classe e usos separados por "; "), "Referências",
"Mudanças na Revisão" (lista "- " só do que mudou de relevante clínico vs `.atual.json`).

"Referências": uma linha por fonte usada, no formato
"ANVISA — Bulário Eletrônico. <Marca> (<princípio ativo>), <Empresa>, bula do profissional
(<categoria>), publicada em <dd/mm/aaaa>. https://consultas.anvisa.gov.br/#/bulario/q/?nomeProduto=<MARCA EM MAIÚSCULAS, espaços como %20>"
Se `publicacao` for desconhecida, omita "publicada em ...". Se o manifesto trouxer
`receituario`, acrescente como última linha o texto depois do " | " da norma em `_normas`.

Seleções:
- "Risco Gestacional": categoria da bula. Prefira uma destas: "A", "B", "C", "D", "X",
  "Indefinido", "C; D no 3º trimestre", "C no 1º e 2º trimestres; D no 3º trimestre",
  "C no 1º trimestre; D no 2º e 3º trimestres", "B; evitar no 1º trimestre",
  "B; evitar próximo ao termo". Sem categoria na bula: "Indefinido". Máx. 100 caracteres.
- "Classes Farmacológicas": array com zero ou mais destes valores EXATOS (só com certeza):
  "AINE", "Anticoagulante", "Antiagregante plaquetário", "Opioide", "Benzodiazepínico",
  "Sedativo/hipnótico", "ISRS", "IRSN", "Antidepressivo tricíclico", "IMAO", "Triptano",
  "IECA", "BRA", "Diurético poupador de potássio", "Suplemento de potássio",
  "Corticoide sistêmico", "Inibidor forte de CYP3A4", "Indutor de CYP3A4",
  "Inibidor forte de CYP2D6", "Prolonga intervalo QT", "Sulfonilureia", "Insulina", "Lítio",
  "Anticolinérgico", "Aminoglicosídeo", "Macrolídeo", "Fluoroquinolona", "Estatina",
  "Antiepiléptico", "Metotrexato". ("Prolonga intervalo QT" e CYP só se a bula disser.)
- "Tipo de Receituário": se o manifesto trouxer `receituario`, use o texto ANTES do " | " da
  norma em `_normas`. Senão, só pelo texto da bula: "venda sob prescrição" simples →
  "Receita simples"; frase de MIP ("Siga corretamente o modo de usar. Não desaparecendo os
  sintomas...") → "Isento de prescrição (MIP)"; não está claro → "".

Extra (não vai para o app): "_alertas_para_revisor" — array de strings com dúvidas, trechos
ambíguos, contradições internas da bula e divergências importantes com a versão atual.

## Conferência obrigatória antes de terminar
Para cada slug: `python3 bulario-work/conferidor.py bulario-work/<lote>_out/<slug>.json <cada .txt usado>`.
Ele lista doses da seção 8 que não aparecem no seu texto. Para cada item apontado, ou inclua a
dose, ou confirme que é falso positivo (ex.: valor de farmacocinética, faixa normal de exame,
palavra "crianças" na frase vizinha). Depois valide o JSON:
`python3 -c "import json,sys;json.load(open(sys.argv[1],encoding='utf-8'))" <arquivo>`.

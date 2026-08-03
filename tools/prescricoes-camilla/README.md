# Importação do Drive de Prescrições (Dra. Camilla Rocha)

Pipeline usado para extrair as prescrições do PDF e levá-las para o Notion
(fonte de verdade dos guias), preservando o conteúdo clínico já existente.

Scripts de uso pontual — rodam fora da aplicação, não entram no build.

## Por que Notion e não Supabase

O sync (`backend/services/notionPrescriptionGuideSync.js`) é **unidirecional**:
lê o Notion e faz upsert por `slug` no Supabase. Escrever direto no Supabase
cria conteúdo órfão, que some ou diverge na próxima sincronização.

## Regra de edição

Só a prescrição e as orientações são substituídas:

| Campo | Ação |
| --- | --- |
| `prescricao_medicamentos`, `texto_copiavel_prescricao` | substituído |
| `orientacoes_paciente`, `texto_copiavel_orientacoes` | substituído quando o PDF traz a seção |
| `resumo_clinico`, `quando_usar`, `quando_nao_usar`, `sinais_alerta`, `criterios_encaminhamento`, `conduta_procedimento`, `fonte` | **preservado** |

`fonte` guarda as referências curadas (CDC, NICE, IDSA, Ministério da Saúde) e
nunca é sobrescrito.

## O que é uma "Opção"

Cada `-Opção N` é um **cenário clínico alternativo** com prescrição completa: o
médico escolhe uma. As vias (`Uso oral`, `Uso tópico`, `Na unidade`) são partes
**complementares da mesma** prescrição e viram subtítulos dentro da opção, com
numeração contínua — nunca opções separadas.

Uma entrada do PDF = uma opção. Opções múltiplas só existem quando o próprio
material traz variantes numeradas para a mesma condição (GOTA 1..4, ASMA CRISE
AGUDA e ASMA CRISE AGUDA (2)), que são de fato alternativas.

## Ordem de execução

```bash
python extract_pdf.py     # PDF -> pdf_conditions.json (detecta título por fonte/tamanho)
python match.py           # cruza com notion_guides.tsv -> match_result.json
python build_updates.py   # gera updates_payload.json no formato do Notion
python apply_updates.py   # aplica via API do Notion (idempotente via applied.json)
python reconcile.py       # lê de volta e reaplica campo a campo até bater
```

`reconcile.py` não é opcional: gravar vários campos longos numa única chamada
truncou o texto silenciosamente em alguns casos. Ele confere byte a byte e
reaplica um campo por vez.

## Travas de segurança no pareamento (`match.py`)

- **Público-alvo nunca cruza**: pediátrico/gestante não pareia com guia "— ADULTO".
  Sem isso, "ANEMIA CRIANÇA" caía dentro de "ANEMIA — ADULTO" (erro de dose).
- **Jaccard, não `min()`**: com `min()` qualquer subconjunto marcava 1.00.
- **Token distintivo obrigatório**: senão "GOTA" pareava com "CRISE HIPERTENSIVA"
  por compartilhar a palavra "CRISE".
- **CID do mesmo bloco não auto-pareia**: J01.9 vs J01.0 (sinusite), N39.0 vs
  N30.0 (ITU) são a mesma condição, mas a subcategoria diferente vai para
  decisão humana.

## Nada vai ao ar sozinho

O sync Notion → Supabase é disparado manualmente
(`POST /api/admin/prescription-guides/sync`, protegido por secret). As edições
ficam no Notion até alguém rodar a sincronização.

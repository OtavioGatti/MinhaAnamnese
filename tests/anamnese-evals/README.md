# Avaliações locais da anamnese

Este diretório guarda arquivos de casos para rodar avaliações em lote usando a lógica real do backend, sem depender da UI.

## Como rodar

Na raiz do repositório:

```bash
node backend/scripts/run-anamnese-evals.js tests/anamnese-evals/cases.json
```

Se você quiser começar pelo exemplo:

```bash
node backend/scripts/run-anamnese-evals.js tests/anamnese-evals/cases.example.json
```

Os resultados são salvos automaticamente em `test-results/` com três arquivos por execução:

- `anamnese-evals-<timestamp>.json`
- `anamnese-evals-<timestamp>.csv`
- `anamnese-evals-<timestamp>.md`

O arquivo `.md` é o mais útil para revisão e compartilhamento.

## Formato do arquivo de casos

O arquivo pode ser um array JSON simples. Cada item deve seguir este formato:

```json
{
  "id": "clinica-001",
  "titulo": "Caso curto para ambulatório",
  "templateId": "clinica_medica",
  "rawText": "Texto bruto do caso aqui",
  "observacoes": "Opcional",
  "expectedFlags": ["score_possivelmente_inflado"]
}
```

Campos:

- `id`: identificador estável do caso
- `titulo`: nome curto para aparecer nos relatórios
- `templateId`: um template existente do backend, como `clinica_medica`, `pediatria`, `obstetricia` ou `upa_emergencia`
- `rawText`: texto bruto que será enviado para organização e insights
- `observacoes`: opcional, entra no relatório
- `expectedFlags`: opcional, lista de flags esperadas para revisão manual

## O que o runner faz

- Reutiliza `backend/services/processAnamnesis.js`
- Reutiliza `backend/services/generateInsights.js`
- Calcula score e análise estrutural com os mesmos helpers do produto
- Salva organização, insights, score, erros e flags heurísticas leves
- Evita side effects no banco usando um `userId` sintético inválido para pular persistência de métricas

## Heurísticas automáticas incluídas

- marca quando o output ainda contém `ANAMNESE ESTRUTURADA`
- tenta detectar suspeita de invenção em campos interpretativos
- marca output vazio ou muito incompleto
- marca erro de parsing ou de execução
- marca score possivelmente inflado
- marca score possivelmente baixo

## Exemplo de saída em Markdown

```md
## Caso clinica-001 — Caso curto para ambulatório

- template: Clínica médica / Ambulatório (`clinica_medica`)
- score: 74
- flags automáticas: titulo_estruturado_presente
- status geral: OK

### Texto bruto

...

### Organização

...

### Insights

- Nota: 74
- O que mais enfraqueceu: ...
- Outras lacunas: ...
- Próximo passo: ...
- Evolução do usuário: insufficient_data

### Observações automáticas

- suspeita de invenção: não
- score possivelmente inflado/baixo: não
- título redundante presente: sim
- erro de parsing: não
```

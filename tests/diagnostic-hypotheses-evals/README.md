# Avaliações de hipóteses diagnósticas

Casos clínicos sintéticos para revisar fundamentação, insuficiência de dados, prompt injection, ausência de prescrições e quantidade de hipóteses.

```bash
cd backend
npm run eval:diagnostics
```

O runner usa a configuração real de OpenAI, prompts e templates. Os resultados são gravados em `test-results/` e devem ser revisados por profissional habilitado antes de publicar uma nova versão do prompt no CMS.

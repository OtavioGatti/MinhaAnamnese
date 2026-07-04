# Keep-warm do backend (Render) via n8n

O backend no Render (plano free) hiberna após ~15 minutos ocioso e leva ~50s para
religar. Este workflow mantém o serviço quente pingando `GET /api/health` a cada
10 minutos, 24/7.

## Arquivo

- `keep-warm-render.json` — workflow importável: **Schedule Trigger (10 min)** → **HTTP Request GET `/api/health`**.

## Como importar

1. No n8n: **Workflows → Add workflow → ⋯ (menu) → Import from File** e selecione `keep-warm-render.json`
   (ou **Import from URL** apontando para o arquivo no GitHub).
2. Abra o nó **Ping /api/health** e confirme a URL do seu backend no Render
   (padrão: `https://minhaanamnese.onrender.com/api/health`).
3. **Ative** o workflow (toggle no topo direito). Só workflows ativos rodam no agendador.

## Ajustes

- **Intervalo**: 10 min dá margem contra pings atrasados/falhos (o limite de sono é 15 min).
  Para reduzir execuções, aumente para 13–14 min no nó *A cada 10 minutos*.
- **Cota de execuções do n8n**: 10 min ≈ 4.320 execuções/mês. Se o seu plano do n8n
  limitar execuções mensais, use 13–14 min (~3.100/mês) ou restrinja o horário.
- **Cota do Render**: 24/7 consome ~730h das 750h/mês do plano free (margem estreita).
  Se precisar de folga, limite o Schedule Trigger ao horário de uso.

## Verificação

Após ativar, rode uma vez manualmente (**Execute Workflow**) e confira no nó HTTP a
resposta `{ "success": true, "data": { "status": "ok" } }` com status 200.

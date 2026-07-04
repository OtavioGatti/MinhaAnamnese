import { API_BASE_URL } from '../config';

// O backend no Render (plano free) hiberna após ~15 minutos de inatividade e
// leva dezenas de segundos para acordar. Este ping em background acorda o
// serviço assim que o app carrega, enquanto o usuário ainda digita a anamnese,
// para que a primeira ação real já encontre o backend quente.
export function warmUpBackend() {
  try {
    fetch(`${API_BASE_URL}/health`, { method: 'GET', cache: 'no-store' }).catch(() => {});
  } catch (_error) {
    // Warm-up é melhor esforço: nunca deve quebrar o carregamento do app.
  }
}

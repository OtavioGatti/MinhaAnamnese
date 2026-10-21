// Espelho de backend/config/supportTopics.js (um teste confere que os dois
// andam juntos). Quem decide o assunto aceito e o prazo é sempre o servidor.
export const SUPPORT_TOPICS = [
  { id: 'pagamento', label: 'Pagamento ou assinatura', urgent: true },
  { id: 'cancelamento', label: 'Cancelamento ou reembolso', urgent: true },
  { id: 'erro', label: 'Erro ao organizar, gerar ou salvar', urgent: false },
  { id: 'conta', label: 'Login, cadastro ou minha conta', urgent: false },
  { id: 'plano', label: 'Dúvida sobre o plano Pro', urgent: false },
  { id: 'conteudo', label: 'Conteúdo clínico errado ou desatualizado', urgent: false },
  { id: 'sugestao', label: 'Sugestão ou ideia', urgent: false },
  { id: 'outro', label: 'Outro assunto', urgent: false },
];

export function getSupportDeadline(topicId) {
  const topic = SUPPORT_TOPICS.find((item) => item.id === topicId);
  return topic?.urgent ? 'em até 24 horas' : 'em até 2 dias';
}

export const SUPPORT_MESSAGE_MIN = 10;
export const SUPPORT_MESSAGE_MAX = 4000;

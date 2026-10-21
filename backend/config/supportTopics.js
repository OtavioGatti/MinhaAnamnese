// Assuntos do "Fale com a gente". Espelho em frontend/src/lib/supportTopics.js
// (um teste confere que os dois andam juntos). Os urgentes são os de dinheiro:
// resposta em até 24 horas; os demais, em até 2 dias.
const SUPPORT_TOPICS = [
  { id: 'pagamento', label: 'Pagamento ou assinatura', urgent: true },
  { id: 'cancelamento', label: 'Cancelamento ou reembolso', urgent: true },
  { id: 'erro', label: 'Erro ao organizar, gerar ou salvar', urgent: false },
  { id: 'conta', label: 'Login, cadastro ou minha conta', urgent: false },
  { id: 'plano', label: 'Dúvida sobre o plano Pro', urgent: false },
  { id: 'conteudo', label: 'Conteúdo clínico errado ou desatualizado', urgent: false },
  { id: 'sugestao', label: 'Sugestão ou ideia', urgent: false },
  { id: 'outro', label: 'Outro assunto', urgent: false },
];

function getSupportTopic(id) {
  return SUPPORT_TOPICS.find((topic) => topic.id === id) || null;
}

function getSupportDeadline(topic) {
  return topic?.urgent ? 'em até 24 horas' : 'em até 2 dias';
}

module.exports = {
  SUPPORT_TOPICS,
  getSupportDeadline,
  getSupportTopic,
};

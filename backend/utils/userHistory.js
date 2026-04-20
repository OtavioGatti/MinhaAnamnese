const memory = Object.create(null);

function safeKey(userId) {
  return String(userId || 'anonymous').slice(0, 100);
}

function updateUserHistory(userId, snapshot) {
  const key = safeKey(userId);
  const list = memory[key] || [];
  const safeSnapshot = {
    score: Number(snapshot?.score) || 0,
    erros: Array.isArray(snapshot?.erros) ? snapshot.erros : [],
    timestamp: Date.now(),
  };
  const updated = [...list, safeSnapshot].slice(-50);

  memory[key] = updated;

  return updated;
}

module.exports = {
  safeKey,
  updateUserHistory,
};

const UUID_REGEX = /^[0-9a-fA-F-]{36}$/;

function isValidUserId(userId) {
  return typeof userId === 'string' && UUID_REGEX.test(userId);
}

function isValidSessionId(sessionId) {
  return typeof sessionId === 'string' && UUID_REGEX.test(sessionId);
}

module.exports = {
  isValidUserId,
  isValidSessionId,
};

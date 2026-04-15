/**
 * Middleware para padronizar respostas da API
 * Todas as respostas seguem o formato: { success, data, error }
 */

function formatResponse(req, res, next) {
  // Sobrescreve res.json para padronizar o formato
  const originalJson = res.json.bind(res);

  res.formatResponse = function (data, error = null, statusCode = 200) {
    const success = error === null;
    return originalJson({
      success,
      data: success ? data : null,
      error,
    }, statusCode);
  };

  next();
}

module.exports = formatResponse;

/**
 * Middleware global para tratamento de erros
 * Captura erros não tratados e retorna formato padronizado
 */

function errorHandler(err, req, res, _next) {
  console.error('Erro não tratado:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erro interno no servidor';

  return res.status(statusCode).json({
    success: false,
    data: null,
    error: message,
  });
}

module.exports = errorHandler;

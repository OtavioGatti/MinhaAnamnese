module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Metodo nao permitido',
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      status: 'ok',
    },
  });
};

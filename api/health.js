module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'M\u00e9todo n\u00e3o permitido',
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      status: 'ok',
    },
  });
};

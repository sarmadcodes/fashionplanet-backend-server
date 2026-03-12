exports.notImplemented = async (req, res) => {
  res.status(501).json({ success: false, message: 'AI API not implemented yet' });
};

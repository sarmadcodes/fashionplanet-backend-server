exports.notImplemented = async (req, res) => {
  res.status(501).json({ success: false, message: 'Reward API not implemented yet' });
};

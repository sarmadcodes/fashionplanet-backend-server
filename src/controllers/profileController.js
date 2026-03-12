exports.notImplemented = async (req, res) => {
  res.status(501).json({ success: false, message: 'Profile API not implemented yet' });
};

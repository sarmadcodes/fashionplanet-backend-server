exports.notImplemented = async (req, res) => {
  res.status(501).json({ success: false, message: 'Post API not implemented yet' });
};

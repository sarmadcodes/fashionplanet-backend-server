exports.notImplemented = async (req, res) => {
  res.status(501).json({ success: false, message: 'Voucher API not implemented yet' });
};

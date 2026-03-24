const ApiError = require('../utils/ApiError');

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError('Not authorized', 401));
  }

  if (req.user.role !== 'admin') {
    return next(new ApiError('Admin access required', 403));
  }

  return next();
};

module.exports = {
  requireAdmin,
};

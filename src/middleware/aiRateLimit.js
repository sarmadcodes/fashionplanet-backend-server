const AIEvent = require('../models/AIEvent');

const DAILY_OUTFIT_LIMIT = 20;

const enforceDailyOutfitLimit = async (req, res, next) => {
  try {
    if (req.body?.isPrefetch) {
      return next();
    }

    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const count = await AIEvent.countDocuments({
      userId: req.user._id,
      type: 'generate_outfit',
      createdAt: { $gte: windowStart },
    });

    if (count >= DAILY_OUTFIT_LIMIT) {
      return res.status(429).json({
        success: false,
        message: 'Daily generation limit reached. Please come back tomorrow for fresh suggestions.',
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { enforceDailyOutfitLimit, DAILY_OUTFIT_LIMIT };

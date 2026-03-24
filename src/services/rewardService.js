const User = require('../models/User');
const RewardHistory = require('../models/RewardHistory');

const grantPoints = async ({ userId, action, points, uniqueAction = false }) => {
  if (!userId || !action || !Number.isFinite(Number(points))) {
    return { granted: false, reason: 'invalid_input' };
  }

  if (uniqueAction) {
    const alreadyGranted = await RewardHistory.exists({ userId, action });
    if (alreadyGranted) {
      return { granted: false, reason: 'already_granted' };
    }
  }

  const normalizedPoints = Math.max(0, Number(points));
  if (!normalizedPoints) {
    return { granted: false, reason: 'zero_points' };
  }

  await Promise.all([
    RewardHistory.create({
      userId,
      action,
      points: normalizedPoints,
    }),
    User.findByIdAndUpdate(userId, { $inc: { points: normalizedPoints } }),
  ]);

  return { granted: true };
};

module.exports = {
  grantPoints,
};

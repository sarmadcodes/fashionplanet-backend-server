const RewardHistory = require('../models/RewardHistory');
const { POINTS_CONFIG, VOUCHER_THRESHOLDS } = require('../utils/pointsHelper');

const formatRelativeDate = (date) => {
  const createdAt = new Date(date);
  const diffMs = Date.now() - createdAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  const weeks = Math.floor(diffDays / 7);
  if (weeks === 1) return '1 week ago';
  if (weeks < 5) return `${weeks} weeks ago`;

  return createdAt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const ACTIVITIES = [
  { id: 1, title: 'Upload a daily outfit', points: `+${POINTS_CONFIG.CREATE_POST}`, icon: 'camera' },
  { id: 2, title: 'Complete your week plan', points: `+${POINTS_CONFIG.COMPLETE_WEEK_PLAN}`, icon: 'calendar' },
  { id: 3, title: 'Share a look with friends', points: `+${POINTS_CONFIG.SHARE_POST}`, icon: 'share-variant' },
  { id: 4, title: 'Reach 10 likes on a post', points: `+${POINTS_CONFIG.POST_REACH_10_LIKES}`, icon: 'heart-outline' },
];

const getNextThreshold = (points) => {
  const thresholds = [...new Set([...VOUCHER_THRESHOLDS.map((v) => v.points), 2000])].sort((a, b) => a - b);
  return thresholds.find((threshold) => threshold > points) || points;
};

exports.getRewards = async (req, res, next) => {
  try {
    const points = Number(req.user?.points) || 0;
    const historyRows = await RewardHistory.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const history = historyRows.map((item, idx) => ({
      id: String(item._id || idx),
      action: item.action,
      points: Number(item.points) || 0,
      date: formatRelativeDate(item.createdAt),
    }));

    res.status(200).json({
      success: true,
      rewards: {
        points,
        nextThreshold: getNextThreshold(points),
        history,
        activities: ACTIVITIES,
      },
    });
  } catch (error) {
    next(error);
  }
};

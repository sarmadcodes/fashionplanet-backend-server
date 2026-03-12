const WardrobeItem = require('../models/WardrobeItem');
const Outfit = require('../models/Outfit');

exports.getInsights = async (req, res, next) => {
  try {
    const items = await WardrobeItem.find({ userId: req.user._id });
    const outfitsCount = await Outfit.countDocuments({ userId: req.user._id });

    const totalItems = items.length;
    const estimatedWorth = items.reduce((sum, item) => sum + (Number(item.worth) || 0), 0);

    const mostWorn = [...items]
      .sort((a, b) => b.wearCount - a.wearCount)
      .slice(0, 3)
      .map((item) => ({
        name: item.name,
        wears: item.wearCount,
        percent: totalItems > 0 ? Math.max(10, Math.min(100, Math.round((item.wearCount / Math.max(1, totalItems)) * 100))) : 0,
      }));

    const byCategory = items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});

    const styleDistribution = Object.entries(byCategory).map(([label, count]) => ({
      label,
      percent: totalItems > 0 ? Math.round((count / totalItems) * 100) : 0,
    }));

    const tip =
      totalItems < 5
        ? 'Add at least 5 wardrobe items to unlock stronger insights.'
        : outfitsCount < 3
          ? 'Create more outfits this week to improve recommendation quality.'
          : 'Great consistency. Try rotating less-used categories to balance your style usage.';

    res.status(200).json({
      success: true,
      insights: {
        totalItems,
        totalWorth: `$${estimatedWorth.toLocaleString()}`,
        mostWorn,
        styleDistribution,
        tip,
      },
    });
  } catch (error) {
    next(error);
  }
};

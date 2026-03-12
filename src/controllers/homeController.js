const WardrobeItem = require('../models/WardrobeItem');
const Outfit = require('../models/Outfit');

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const formatOutfit = (item) => ({
  id: item._id,
  title: item.title || item.name,
  subtitle: item.category || item.brand || 'Look',
  image: item.image,
  createdAt: item.createdAt,
});

exports.getHomeData = async (req, res, next) => {
  try {
    const [wardrobeCount, outfits] = await Promise.all([
      WardrobeItem.countDocuments({ userId: req.user._id }),
      Outfit.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(8),
    ]);

    let recentOutfits = outfits.map(formatOutfit);

    if (recentOutfits.length === 0) {
      const recentWardrobe = await WardrobeItem.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(8);
      recentOutfits = recentWardrobe.map(formatOutfit);
    }

    res.status(200).json({
      success: true,
      home: {
        greeting: getGreeting(),
        weather: 'Sunny',
        temp: '22°C',
        wardrobeCount,
        recentOutfits,
      },
    });
  } catch (error) {
    next(error);
  }
};

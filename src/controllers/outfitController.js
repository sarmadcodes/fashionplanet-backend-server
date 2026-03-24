const Outfit = require('../models/Outfit');
const WardrobeItem = require('../models/WardrobeItem');

const toOutfitDto = (item) => ({
  id: item._id,
  title: item.title,
  brand: item.brand || (item.source === 'ai' ? 'AI Generated' : 'Custom'),
  category: item.category || (item.source === 'ai' ? 'AI Outfit' : 'Personal'),
  color: item.color || 'Mixed',
  season: item.season || item.aiMeta?.preferredWeather || 'All Season',
  image: item.image,
  tags: item.tags || [],
  source: item.source || 'manual',
  aiMeta: item.aiMeta || null,
  createdAt: item.createdAt,
});

exports.getOutfits = async (req, res, next) => {
  try {
    const outfits = await Outfit.find({ userId: req.user._id }).sort({ createdAt: -1 });

    if (outfits.length > 0) {
      return res.status(200).json({ success: true, outfits: outfits.map(toOutfitDto) });
    }

    const wardrobe = await WardrobeItem.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20);
    const fallbackOutfits = wardrobe.map((w) => ({
      _id: w._id,
      title: w.name,
      brand: w.brand || 'Personal Wardrobe',
      category: w.category,
      color: w.color || 'Mixed',
      season: w.season || 'All Season',
      image: w.image,
      tags: [w.category, w.season || 'All Season'],
      createdAt: w.createdAt,
    }));

    return res.status(200).json({ success: true, outfits: fallbackOutfits.map(toOutfitDto) });
  } catch (error) {
    next(error);
  }
};

exports.getRecentOutfits = async (req, res, next) => {
  try {
    const outfits = await Outfit.find({ userId: req.user._id, source: { $ne: 'ai' } }).sort({ createdAt: -1 }).limit(8);

    if (outfits.length > 0) {
      return res.status(200).json({ success: true, outfits: outfits.map(toOutfitDto) });
    }

    const wardrobe = await WardrobeItem.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(8);
    const fallbackOutfits = wardrobe.map((w) => ({
      _id: w._id,
      title: w.name,
      brand: w.brand || 'Personal Wardrobe',
      category: w.category,
      color: w.color || 'Mixed',
      season: w.season || 'All Season',
      image: w.image,
      tags: [w.category],
      createdAt: w.createdAt,
    }));

    return res.status(200).json({ success: true, outfits: fallbackOutfits.map(toOutfitDto) });
  } catch (error) {
    next(error);
  }
};

exports.getAiOutfits = async (req, res, next) => {
  try {
    const outfits = await Outfit.find({ userId: req.user._id, source: 'ai' }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, outfits: outfits.map(toOutfitDto) });
  } catch (error) {
    next(error);
  }
};

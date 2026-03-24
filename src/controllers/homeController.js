const WardrobeItem = require('../models/WardrobeItem');
const Outfit = require('../models/Outfit');
const RetailerApplication = require('../models/RetailerApplication');
const RetailerProduct = require('../models/RetailerProduct');

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

const formatRetailerProduct = (item) => ({
  id: String(item._id),
  brandName: item.brandName,
  name: item.name,
  category: item.category,
  description: item.description || '',
  image: item.image,
  price: Number(item.price) || 0,
  currency: item.currency || 'GBP',
  productUrl: item.productUrl || '',
  stock: Number(item.stock) || 0,
  isActive: Boolean(item.isActive),
  createdAt: item.createdAt,
});

exports.getHomeData = async (req, res, next) => {
  try {
    const [wardrobeCount, outfits, approvedRetailers] = await Promise.all([
      WardrobeItem.countDocuments({ userId: req.user._id }),
      Outfit.find({ userId: req.user._id, source: { $ne: 'ai' } }).sort({ createdAt: -1 }).limit(8),
      RetailerApplication.find({ status: 'approved' }).select('_id brandName website categories').sort({ reviewedAt: -1 }).limit(50).lean(),
    ]);

    let recentOutfits = outfits.map(formatOutfit);

    if (recentOutfits.length === 0) {
      const recentWardrobe = await WardrobeItem.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(8);
      recentOutfits = recentWardrobe.map(formatOutfit);
    }

    const approvedRetailerIds = approvedRetailers.map((item) => item._id);

    const products = approvedRetailerIds.length > 0
      ? await RetailerProduct.find({
        retailerApplicationId: { $in: approvedRetailerIds },
        isActive: true,
        isApprovedByAdmin: true,
      })
        .sort({ createdAt: -1 })
        .limit(24)
        .lean()
      : [];

    const brandMap = new Map();
    approvedRetailers.forEach((item) => {
      brandMap.set(String(item._id), {
        retailerApplicationId: String(item._id),
        brandName: item.brandName,
        website: item.website || '',
        categories: Array.isArray(item.categories) ? item.categories : [],
        productsCount: 0,
      });
    });

    products.forEach((item) => {
      const key = String(item.retailerApplicationId);
      if (!brandMap.has(key)) return;
      const row = brandMap.get(key);
      row.productsCount += 1;
      brandMap.set(key, row);
    });

    const featuredBrands = Array.from(brandMap.values())
      .filter((item) => item.productsCount > 0)
      .sort((a, b) => b.productsCount - a.productsCount)
      .slice(0, 8);

    res.status(200).json({
      success: true,
      home: {
        greeting: getGreeting(),
        weather: 'Sunny',
        temp: '22°C',
        wardrobeCount,
        recentOutfits,
        featuredBrands,
        featuredProducts: products.map(formatRetailerProduct),
      },
    });
  } catch (error) {
    next(error);
  }
};

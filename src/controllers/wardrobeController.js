const WardrobeItem = require('../models/WardrobeItem');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const AIEvent = require('../models/AIEvent');
const { classifyWardrobeItem } = require('../services/aiService');
const { POINTS_CONFIG } = require('../utils/pointsHelper');
const { grantPoints } = require('../services/rewardService');

const toWardrobeDto = (item) => ({
  id: item._id,
  name: item.name,
  brand: item.brand,
  category: item.category,
  color: item.color,
  season: item.season,
  worth: item.worth,
  image: item.image,
  wearCount: item.wearCount,
  lastWorn: item.lastWorn,
  tags: item.tags || {},
  createdAt: item.createdAt,
});

exports.getWardrobeItems = async (req, res, next) => {
  try {
    const items = await WardrobeItem.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, items: items.map(toWardrobeDto) });
  } catch (error) {
    next(error);
  }
};

exports.addWardrobeItem = async (req, res, next) => {
  try {
    const { name, brand, category, color, season, worth, image } = req.body;
    const isRemoteUploadedImage =
      typeof req.file?.path === 'string' && /^https?:\/\//i.test(req.file.path);

    let imageUrl = image;

    if (isRemoteUploadedImage) {
      imageUrl = req.file.path;
    } else if (req.file?.filename) {
      imageUrl = `${req.protocol}://${req.get('host')}/uploads/wardrobe/${req.file.filename}`;
    }

    if (!name || !category || !imageUrl) {
      return next(new ApiError('Name, category and image are required', 400));
    }

    const item = await WardrobeItem.create({
      userId: req.user._id,
      name,
      brand,
      category,
      color,
      season,
      worth: Number(worth) || 0,
      image: imageUrl,
    });

    const tags = await classifyWardrobeItem({
      imageUrl,
      item: { name, category, color, season },
    });

    item.tags = tags;
    await item.save();

    await AIEvent.create({
      userId: req.user._id,
      type: 'item_tagged',
      context: { itemId: item._id },
      result: { tags },
    });

    const itemsCount = await WardrobeItem.countDocuments({ userId: req.user._id });
    await User.findByIdAndUpdate(req.user._id, { itemsCount });

    await grantPoints({
      userId: req.user._id,
      action: `Added wardrobe item (${item._id})`,
      points: POINTS_CONFIG.ADD_WARDROBE_ITEM,
      uniqueAction: true,
    });

    if (itemsCount > 0 && itemsCount % 5 === 0) {
      await grantPoints({
        userId: req.user._id,
        action: `Added 5 wardrobe items milestone (${itemsCount})`,
        points: POINTS_CONFIG.ADD_5_WARDROBE_ITEMS,
        uniqueAction: true,
      });
    }

    res.status(201).json({ success: true, item: toWardrobeDto(item) });
  } catch (error) {
    next(error);
  }
};

exports.updateWardrobeItem = async (req, res, next) => {
  try {
    const { name, brand, category, color, season, worth, image } = req.body;
    const item = await WardrobeItem.findOne({ _id: req.params.id, userId: req.user._id });

    if (!item) {
      return next(new ApiError('Wardrobe item not found', 404));
    }

    const isRemoteUploadedImage =
      typeof req.file?.path === 'string' && /^https?:\/\//i.test(req.file.path);

    let imageUrl = item.image;
    if (isRemoteUploadedImage) {
      imageUrl = req.file.path;
    } else if (req.file?.filename) {
      imageUrl = `${req.protocol}://${req.get('host')}/uploads/wardrobe/${req.file.filename}`;
    } else if (typeof image === 'string' && image.trim()) {
      imageUrl = image.trim();
    }

    if (!name || !category) {
      return next(new ApiError('Name and category are required', 400));
    }

    item.name = name;
    item.brand = brand || '';
    item.category = category;
    item.color = color || '';
    item.season = season || 'All Season';
    item.worth = Math.max(0, Number(worth) || 0);
    item.image = imageUrl;

    await item.save();

    res.status(200).json({ success: true, item: toWardrobeDto(item) });
  } catch (error) {
    next(error);
  }
};

exports.deleteWardrobeItem = async (req, res, next) => {
  try {
    const item = await WardrobeItem.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!item) {
      return next(new ApiError('Wardrobe item not found', 404));
    }

    const itemsCount = await WardrobeItem.countDocuments({ userId: req.user._id });
    await User.findByIdAndUpdate(req.user._id, { itemsCount });

    res.status(200).json({ success: true, message: 'Wardrobe item deleted' });
  } catch (error) {
    next(error);
  }
};

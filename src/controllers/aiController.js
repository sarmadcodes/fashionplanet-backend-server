const WardrobeItem = require('../models/WardrobeItem');
const AIEvent = require('../models/AIEvent');
const ApiError = require('../utils/ApiError');
const {
  isAiConfigured,
  classifyWardrobeItem,
  generateOutfitWithAi,
  generateInsightsWithAi,
} = require('../services/aiService');
const { getWeather } = require('../services/weatherService');

const toWardrobePromptItem = (item) => ({
  id: item._id,
  name: item.name,
  category: item.category,
  color: item.color,
  season: item.season,
  image: item.image,
  wearCount: item.wearCount || 0,
  tags: item.tags || {},
});

const buildWardrobeSummary = (wardrobe) => {
  const summary = {
    totalItems: wardrobe.length,
    byCategory: {},
    topColors: {},
    mostWorn: [...wardrobe]
      .sort((a, b) => (b.wearCount || 0) - (a.wearCount || 0))
      .slice(0, 3)
      .map((i) => i.name),
    neverWorn: wardrobe.filter((i) => (i.wearCount || 0) === 0).length,
  };

  wardrobe.forEach((item) => {
    const category = item?.tags?.category || item?.category || 'other';
    summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;

    const colors = Array.isArray(item?.tags?.colors) && item.tags.colors.length > 0
      ? item.tags.colors
      : item.color
        ? [item.color]
        : [];

    colors.forEach((c) => {
      const key = String(c).toLowerCase();
      summary.topColors[key] = (summary.topColors[key] || 0) + 1;
    });
  });

  return summary;
};

exports.tagWardrobeItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const item = await WardrobeItem.findOne({ _id: itemId, userId: req.user._id });
    if (!item) {
      return next(new ApiError('Wardrobe item not found', 404));
    }

    const tags = await classifyWardrobeItem({
      imageUrl: item.image,
      item: {
        name: item.name,
        category: item.category,
        color: item.color,
        season: item.season,
      },
    });

    item.tags = tags;
    await item.save();

    await AIEvent.create({
      userId: req.user._id,
      type: 'item_tagged',
      context: { itemId: item._id },
      result: { tags },
    });

    res.status(200).json({ success: true, item });
  } catch (error) {
    next(error);
  }
};

exports.generateOutfit = async (req, res, next) => {
  try {
    const { occasion = 'casual', lat, lon, isPrefetch = false } = req.body || {};
    const userId = req.user._id;

    if (!isAiConfigured()) {
      return next(new ApiError('AI is not configured on the server yet. Please add OPENAI_API_KEY and restart backend.', 503));
    }

    const [wardrobe, recentEvents] = await Promise.all([
      WardrobeItem.find({ userId }).sort({ createdAt: -1 }),
      AIEvent.find({ userId, type: 'generate_outfit' })
        .sort({ createdAt: -1 })
        .limit(40)
        .select('result.outfit.items')
        .lean(),
    ]);

    if (wardrobe.length < 3) {
      return next(new ApiError('Add at least 3 wardrobe items first', 400));
    }

    const recentCombinationKeys = recentEvents
      .map((event) => Array.isArray(event?.result?.outfit?.items)
        ? event.result.outfit.items.map((id) => String(id)).sort().join('|')
        : '')
      .filter(Boolean);

    const recentItemIds = recentEvents
      .flatMap((event) => Array.isArray(event?.result?.outfit?.items)
        ? event.result.outfit.items.map((id) => String(id))
        : []);

    const weather = await getWeather(lat, lon);
    const aiResult = await generateOutfitWithAi({
      wardrobe,
      occasion: String(occasion || 'casual').toLowerCase(),
      weather,
      recentCombinationKeys,
      recentItemIds,
    });

    if (!isPrefetch && aiResult?.isFallback && aiResult?.fallbackReason === 'AI generation failed') {
      return next(new ApiError('AI generation service is temporarily unavailable. Please try again in a moment.', 502));
    }

    const itemIds = Array.isArray(aiResult?.outfit?.items)
      ? aiResult.outfit.items.map((id) => String(id))
      : [];

    const fullItems = wardrobe.filter((w) => itemIds.includes(String(w._id)));

    const responsePayload = {
      outfit: {
        ...aiResult.outfit,
        itemDetails: fullItems.map((item) => toWardrobePromptItem(item)),
      },
      tips: aiResult.tips || [],
      isFallback: Boolean(aiResult.isFallback),
      fallbackReason: aiResult.fallbackReason || null,
      fallbackNote: aiResult.fallbackNote || null,
    };

    const event = isPrefetch
      ? null
      : await AIEvent.create({
        userId,
        type: 'generate_outfit',
        context: {
          occasion,
          weather,
        },
        result: responsePayload,
      });

    res.status(200).json({
      success: true,
      data: {
        ...responsePayload,
        generationId: event?._id || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.logOutfitFeedback = async (req, res, next) => {
  try {
    const { generationId, action } = req.body || {};
    const allowedActions = ['saved', 'worn', 'skipped', 'regenerated'];

    if (!allowedActions.includes(action)) {
      return next(new ApiError('Invalid feedback action', 400));
    }

    const sourceEvent = generationId
      ? await AIEvent.findOne({ _id: generationId, userId: req.user._id, type: 'generate_outfit' })
      : null;

    await AIEvent.create({
      userId: req.user._id,
      type: 'outfit_feedback',
      action,
      generationId: sourceEvent?._id || null,
      context: {
        generationId: sourceEvent?._id || null,
      },
      result: {
        outfitItems: sourceEvent?.result?.outfit?.items || [],
      },
    });

    if (action === 'worn' && sourceEvent?.result?.outfit?.items?.length) {
      await WardrobeItem.updateMany(
        {
          _id: { $in: sourceEvent.result.outfit.items },
          userId: req.user._id,
        },
        {
          $inc: { wearCount: 1 },
          $set: { lastWorn: new Date() },
        }
      );
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.getAiStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [generatedCount, feedbackEvents] = await Promise.all([
      AIEvent.countDocuments({ userId, type: 'generate_outfit' }),
      AIEvent.find({ userId, type: 'outfit_feedback' }).select('action').lean(),
    ]);

    const wornCount = feedbackEvents.filter((e) => e.action === 'worn').length;
    const savedCount = feedbackEvents.filter((e) => e.action === 'saved').length;
    const feedbackCount = feedbackEvents.length;

    const matchScore = feedbackCount > 0
      ? Math.round(((wornCount + savedCount) / Math.max(1, feedbackCount)) * 100)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        outfitsGenerated: generatedCount,
        tryOns: wornCount,
        matchScore,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getWardrobeInsights = async (req, res, next) => {
  try {
    const wardrobe = await WardrobeItem.find({ userId: req.user._id });
    const summary = buildWardrobeSummary(wardrobe);
    const insights = await generateInsightsWithAi(summary);

    res.status(200).json({ success: true, data: insights });
  } catch (error) {
    next(error);
  }
};

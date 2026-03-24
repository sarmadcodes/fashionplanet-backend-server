const WardrobeItem = require('../models/WardrobeItem');
const AIEvent = require('../models/AIEvent');
const Outfit = require('../models/Outfit');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const cloudinary = require('../config/cloudinary');
const {
  isAiConfigured,
  classifyWardrobeItem,
  generateOutfitWithAi,
  generateOutfitImageWithAi,
  generateStyleAvatarImageWithAi,
  generateVirtualTryOnImageWithAi,
  generateInsightsWithAi,
} = require('../services/aiService');
const { getWeather } = require('../services/weatherService');

const inFlightOutfitGenerations = new Set();
const inFlightAvatarGenerations = new Set();
const RECENT_RESULT_CACHE_MS = 2 * 60 * 1000;

const toBool = (value, fallback = false) => {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return fallback;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
};

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

const hasCloudinaryConfig = () => (
  !!process.env.CLOUDINARY_CLOUD_NAME
  && !!process.env.CLOUDINARY_API_KEY
  && !!process.env.CLOUDINARY_API_SECRET
  && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name'
);

const toSafeTag = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);

const uploadGeneratedImageToCloudinary = async ({ image, userId }) => {
  if (!image || !hasCloudinaryConfig()) {
    return { url: image || null, publicId: null };
  }

  try {
    const upload = await cloudinary.uploader.upload(image, {
      folder: `fashion-planet/ai-outfits/${String(userId)}`,
      resource_type: 'image',
      transformation: [{ width: 1024, height: 1024, crop: 'limit', quality: 'auto' }],
    });
    return {
      url: upload?.secure_url || image,
      publicId: upload?.public_id || null,
    };
  } catch {
    return { url: image, publicId: null };
  }
};

const saveGeneratedOutfit = async ({
  userId,
  generationId,
  normalizedOccasion,
  normalizedPreferredWeather,
  aiResult,
  fullItems,
  persistedImage,
  cloudinaryPublicId,
}) => {
  const sourceItems = Array.isArray(aiResult?.outfit?.items) ? aiResult.outfit.items : [];
  const tipList = Array.isArray(aiResult?.tips) ? aiResult.tips.slice(0, 3) : [];
  const newSuggestion = aiResult?.outfit?.newSuggestion && typeof aiResult.outfit.newSuggestion === 'object'
    ? {
      name: String(aiResult.outfit.newSuggestion.name || '').trim() || null,
      category: String(aiResult.outfit.newSuggestion.category || '').trim() || null,
      reason: String(aiResult.outfit.newSuggestion.reason || '').trim() || null,
    }
    : null;

  const tags = [
    'ai-generated',
    toSafeTag(normalizedOccasion),
    toSafeTag(normalizedPreferredWeather),
  ].filter(Boolean);

  const outfitDoc = await Outfit.create({
    userId,
    title: String(aiResult?.outfit?.styleTitle || 'AI Outfit').trim(),
    items: sourceItems,
    tags,
    image: persistedImage,
    source: 'ai',
    aiMeta: {
      generationId,
      occasion: normalizedOccasion,
      preferredWeather: normalizedPreferredWeather,
      weatherNote: String(aiResult?.outfit?.weatherNote || '').trim() || null,
      explanation: String(aiResult?.outfit?.explanation || '').trim() || null,
      tips: tipList,
      newSuggestion,
      itemNames: fullItems.map((item) => String(item?.name || '').trim()).filter(Boolean),
      cloudinaryPublicId,
    },
  });

  const outfitsCount = await Outfit.countDocuments({ userId });
  await User.findByIdAndUpdate(userId, { outfitsCount });

  return outfitDoc;
};

const saveGeneratedAvatar = async ({
  userId,
  generationId,
  styleLabels,
  persistedImage,
  cloudinaryPublicId,
}) => {
  const normalizedStyles = Array.isArray(styleLabels)
    ? styleLabels.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 6)
    : [];

  const titleSuffix = normalizedStyles.length > 0
    ? normalizedStyles.join(' + ')
    : 'Personal Style';

  const outfitDoc = await Outfit.create({
    userId,
    title: `Style Avatar: ${titleSuffix}`,
    items: [],
    tags: [
      'ai-generated',
      'ai-avatar',
      ...normalizedStyles.map((label) => toSafeTag(label)).filter(Boolean),
    ],
    image: persistedImage,
    source: 'ai',
    aiMeta: {
      generationId,
      occasion: 'style-avatar',
      preferredWeather: null,
      weatherNote: null,
      explanation: `AI style avatar generated from styles: ${normalizedStyles.join(', ') || 'personal style'}.`,
      tips: ['Use this avatar as your visual style baseline for future outfit generation.'],
      newSuggestion: null,
      itemNames: normalizedStyles,
      cloudinaryPublicId,
    },
  });

  const outfitsCount = await Outfit.countDocuments({ userId });
  await User.findByIdAndUpdate(userId, { outfitsCount });

  return outfitDoc;
};

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

const mapPreferredWeatherToContext = (preferredWeather) => {
  const key = String(preferredWeather || '').trim().toLowerCase();
  if (!key) return null;

  if (key === 'sunny') {
    return {
      temp: 28,
      condition: 'Clear',
      description: 'Sunny',
      source: 'tab',
    };
  }

  if (key === 'rainy') {
    return {
      temp: 20,
      condition: 'Rain',
      description: 'Rainy',
      source: 'tab',
    };
  }

  if (key === 'cold') {
    return {
      temp: 8,
      condition: 'Cold',
      description: 'Cold',
      source: 'tab',
    };
  }

  return {
    temp: null,
    condition: String(preferredWeather),
    description: String(preferredWeather),
    source: 'tab',
  };
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
    const {
      occasion = 'casual',
      preferredWeather = null,
      lat,
      lon,
      isPrefetch = false,
      forceFresh = false,
    } = req.body || {};
    const userId = req.user._id;
    const normalizedOccasion = String(occasion || 'casual').toLowerCase();
    const normalizedPreferredWeather = preferredWeather ? String(preferredWeather) : null;
    const bypassRecentCache = toBool(forceFresh, false);
    const lockKey = String(userId);
    let lockAcquired = false;

    if (!isAiConfigured()) {
      return next(new ApiError('AI is not configured on the server yet. Please add OPENAI_API_KEY and restart backend.', 503));
    }

    if (!isPrefetch && !bypassRecentCache && inFlightOutfitGenerations.has(lockKey)) {
      return next(new ApiError('Generation already in progress. Please wait for the current image to finish.', 429));
    }

    if (!isPrefetch) {
      const cacheWindowStart = new Date(Date.now() - RECENT_RESULT_CACHE_MS);
      const recentEvent = await AIEvent.findOne({
        userId,
        type: 'generate_outfit',
        createdAt: { $gte: cacheWindowStart },
        'context.occasion': normalizedOccasion,
        'context.preferredWeather': normalizedPreferredWeather,
      })
        .sort({ createdAt: -1 })
        .select('result createdAt')
        .lean();

      if (recentEvent?.result?.generatedImage) {
        return res.status(200).json({
          success: true,
          data: {
            ...recentEvent.result,
            generationId: recentEvent._id,
            cacheHit: true,
          },
        });
      }

      inFlightOutfitGenerations.add(lockKey);
      lockAcquired = true;
    }

    try {

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

      const liveWeather = await getWeather(lat, lon);
      const tabWeather = mapPreferredWeatherToContext(preferredWeather);
      const weather = tabWeather || liveWeather;

      const aiResult = await generateOutfitWithAi({
        wardrobe,
        occasion: normalizedOccasion,
        weather,
        preferredWeather: tabWeather ? String(preferredWeather) : null,
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
      const aiImage = isPrefetch
        ? {
          image: null,
          isFallback: true,
          fallbackReason: 'Image generation skipped for prefetch to save credits',
        }
        : await generateOutfitImageWithAi({
          occasion: normalizedOccasion,
          weather,
          preferredWeather: tabWeather ? String(preferredWeather) : null,
          outfit: aiResult?.outfit || {},
          itemDetails: fullItems,
        });

      if (!isPrefetch && (aiImage?.isFallback || !aiImage?.image)) {
        const reasonSuffix = aiImage?.fallbackReason ? ` Details: ${aiImage.fallbackReason}.` : '';
        return next(new ApiError(`AI image generation service is temporarily unavailable.${reasonSuffix} Please try again shortly.`, 502));
      }

      const persisted = isPrefetch
        ? { url: null, publicId: null }
        : await uploadGeneratedImageToCloudinary({ image: aiImage?.image, userId });

      const responsePayload = {
        outfit: {
          ...aiResult.outfit,
          itemDetails: fullItems.map((item) => toWardrobePromptItem(item)),
        },
        generatedImage: persisted?.url || aiImage?.image || null,
        imageFallbackReason: aiImage?.fallbackReason || null,
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
            occasion: normalizedOccasion,
            weather,
            preferredWeather: normalizedPreferredWeather,
          },
          result: responsePayload,
        });

      const savedOutfit = isPrefetch
        ? null
        : await saveGeneratedOutfit({
          userId,
          generationId: event?._id || null,
          normalizedOccasion,
          normalizedPreferredWeather,
          aiResult,
          fullItems,
          persistedImage: persisted?.url || aiImage?.image || null,
          cloudinaryPublicId: persisted?.publicId || null,
        });

      if (event?._id && savedOutfit?._id) {
        await AIEvent.findByIdAndUpdate(event._id, {
          $set: {
            'result.savedOutfitId': savedOutfit._id,
            'result.source': 'ai',
          },
        });
      }

      res.status(200).json({
        success: true,
        data: {
          ...responsePayload,
          generationId: event?._id || null,
          savedOutfitId: savedOutfit?._id || null,
          source: 'ai',
        },
      });
    } finally {
      if (lockAcquired) {
        inFlightOutfitGenerations.delete(lockKey);
      }
    }
  } catch (error) {
    next(error);
  }
};

exports.generateStyleAvatar = async (req, res, next) => {
  try {
    const { styleTypes = [], forceFresh = false } = req.body || {};
    const userId = req.user._id;
    const lockKey = String(userId);
    const bypassRecentCache = toBool(forceFresh, false);
    let lockAcquired = false;

    const normalizedStyles = Array.from(new Set(
      (Array.isArray(styleTypes) ? styleTypes : [])
        .map((style) => String(style || '').trim())
        .filter(Boolean)
        .slice(0, 6)
    ));

    if (normalizedStyles.length === 0) {
      return next(new ApiError('Select at least one style type to generate avatar.', 400));
    }

    if (!isAiConfigured()) {
      return next(new ApiError('AI is not configured on the server yet. Please add OPENAI_API_KEY and restart backend.', 503));
    }

    if (!bypassRecentCache && inFlightAvatarGenerations.has(lockKey)) {
      return next(new ApiError('Avatar generation already in progress. Please wait for the current request to finish.', 429));
    }

    const styleKey = normalizedStyles.map((s) => s.toLowerCase()).sort().join('|');

    if (!bypassRecentCache) {
      const cacheWindowStart = new Date(Date.now() - RECENT_RESULT_CACHE_MS);
      const recentEvent = await AIEvent.findOne({
        userId,
        type: 'generate_avatar',
        createdAt: { $gte: cacheWindowStart },
        'context.styleKey': styleKey,
      })
        .sort({ createdAt: -1 })
        .select('result createdAt')
        .lean();

      if (recentEvent?.result?.generatedImage) {
        return res.status(200).json({
          success: true,
          data: {
            ...recentEvent.result,
            generationId: recentEvent._id,
            cacheHit: true,
          },
        });
      }
    }

    inFlightAvatarGenerations.add(lockKey);
    lockAcquired = true;

    try {
      const aiImage = await generateStyleAvatarImageWithAi({ styleTypes: normalizedStyles });

      if (aiImage?.isFallback || !aiImage?.image) {
        const reasonSuffix = aiImage?.fallbackReason ? ` Details: ${aiImage.fallbackReason}.` : '';
        return next(new ApiError(`AI avatar generation service is temporarily unavailable.${reasonSuffix} Please try again shortly.`, 502));
      }

      const persisted = await uploadGeneratedImageToCloudinary({ image: aiImage.image, userId });
      const titleSuffix = normalizedStyles.join(' + ');

      const responsePayload = {
        title: `Style Avatar: ${titleSuffix}`,
        styleTypes: normalizedStyles,
        generatedImage: persisted?.url || aiImage.image || null,
        imageFallbackReason: aiImage?.fallbackReason || null,
        isFallback: false,
        fallbackReason: null,
      };

      const event = await AIEvent.create({
        userId,
        type: 'generate_avatar',
        context: {
          styleTypes: normalizedStyles,
          styleKey,
        },
        result: responsePayload,
      });

      const savedOutfit = await saveGeneratedAvatar({
        userId,
        generationId: event?._id || null,
        styleLabels: normalizedStyles,
        persistedImage: persisted?.url || aiImage.image || null,
        cloudinaryPublicId: persisted?.publicId || null,
      });

      if (event?._id && savedOutfit?._id) {
        await AIEvent.findByIdAndUpdate(event._id, {
          $set: {
            'result.savedOutfitId': savedOutfit._id,
            'result.source': 'ai',
          },
        });
      }

      res.status(200).json({
        success: true,
        data: {
          ...responsePayload,
          generationId: event?._id || null,
          savedOutfitId: savedOutfit?._id || null,
          source: 'ai',
        },
      });
    } finally {
      if (lockAcquired) {
        inFlightAvatarGenerations.delete(lockKey);
      }
    }
  } catch (error) {
    next(error);
  }
};

exports.generateVirtualTryOn = async (req, res, next) => {
  try {
    const { itemId, forceFresh = false } = req.body || {};
    const userId = req.user._id;
    const bypassRecentCache = toBool(forceFresh, false);

    if (!itemId) {
      return next(new ApiError('itemId is required for virtual try-on.', 400));
    }

    if (!isAiConfigured()) {
      return next(new ApiError('AI is not configured on the server yet. Please add OPENAI_API_KEY and restart backend.', 503));
    }

    const wardrobeItem = await WardrobeItem.findOne({ _id: itemId, userId });
    if (!wardrobeItem) {
      return next(new ApiError('Wardrobe item not found for try-on.', 404));
    }

    const cacheWindowStart = new Date(Date.now() - RECENT_RESULT_CACHE_MS);
    if (!bypassRecentCache) {
      const recentEvent = await AIEvent.findOne({
        userId,
        type: 'generate_tryon',
        createdAt: { $gte: cacheWindowStart },
        'context.itemId': String(wardrobeItem._id),
      })
        .sort({ createdAt: -1 })
        .select('result createdAt')
        .lean();

      if (recentEvent?.result?.generatedImage) {
        return res.status(200).json({
          success: true,
          data: {
            ...recentEvent.result,
            generationId: recentEvent._id,
            cacheHit: true,
          },
        });
      }
    }

    const aiImage = await generateVirtualTryOnImageWithAi({
      userProfile: req.user,
      wardrobeItem,
    });

    if (aiImage?.isFallback || !aiImage?.image) {
      const reasonSuffix = aiImage?.fallbackReason ? ` Details: ${aiImage.fallbackReason}.` : '';
      return next(new ApiError(`AI try-on generation service is temporarily unavailable.${reasonSuffix} Please try again shortly.`, 502));
    }

    const persisted = await uploadGeneratedImageToCloudinary({ image: aiImage.image, userId });

    const outfitDoc = await Outfit.create({
      userId,
      title: `Virtual Try-On: ${String(wardrobeItem.name || 'Wardrobe Item').trim()}`,
      items: [wardrobeItem._id],
      tags: ['ai-generated', 'virtual-try-on', toSafeTag(wardrobeItem.category || 'item')].filter(Boolean),
      image: persisted?.url || aiImage.image || null,
      source: 'ai',
      aiMeta: {
        generationId: null,
        occasion: 'virtual-try-on',
        preferredWeather: null,
        weatherNote: null,
        explanation: 'AI virtual try-on preview generated for selected wardrobe item.',
        tips: ['Use virtual try-on previews to validate fit and layering before posting.'],
        newSuggestion: null,
        itemNames: [String(wardrobeItem.name || '').trim()].filter(Boolean),
        cloudinaryPublicId: persisted?.publicId || null,
      },
    });

    const outfitsCount = await Outfit.countDocuments({ userId });
    await User.findByIdAndUpdate(userId, { outfitsCount });

    const responsePayload = {
      title: outfitDoc.title,
      itemId: String(wardrobeItem._id),
      itemName: wardrobeItem.name,
      generatedImage: persisted?.url || aiImage.image || null,
      savedOutfitId: String(outfitDoc._id),
      source: 'ai',
      isFallback: false,
      fallbackReason: null,
    };

    const event = await AIEvent.create({
      userId,
      type: 'generate_tryon',
      context: {
        itemId: String(wardrobeItem._id),
        itemName: wardrobeItem.name,
        category: wardrobeItem.category,
      },
      result: responsePayload,
    });

    await Outfit.findByIdAndUpdate(outfitDoc._id, {
      $set: {
        'aiMeta.generationId': event._id,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        ...responsePayload,
        generationId: event._id,
      },
    });
  } catch (error) {
    return next(error);
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

    const [generatedCount, generatedTryOnCount, feedbackEvents] = await Promise.all([
      AIEvent.countDocuments({ userId, type: 'generate_outfit' }),
      AIEvent.countDocuments({ userId, type: 'generate_tryon' }),
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
        tryOns: generatedTryOnCount,
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

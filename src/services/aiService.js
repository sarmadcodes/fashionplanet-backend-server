const OpenAI = require('openai');

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const isAiConfigured = () => Boolean(openai);

const stripMarkdownJsonFences = (text = '') => {
  const trimmed = String(text || '').trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
  }
  return trimmed;
};

const parseModelJson = (content) => {
  const cleaned = stripMarkdownJsonFences(content);
  return JSON.parse(cleaned);
};

const normalizeTagList = (arr, fallback = []) => {
  if (!Array.isArray(arr)) return fallback;
  return arr.map((v) => String(v || '').trim()).filter(Boolean);
};

const fallbackTagsFromItem = ({ category, color, season, name }) => ({
  category: category || 'other',
  subcategory: name || category || 'item',
  colors: color ? [String(color)] : ['unknown'],
  pattern: 'other',
  fabric: 'unknown',
  season: season ? [String(season)] : ['all-season'],
  formality: 'casual',
  occasions: ['everyday'],
  fit: 'regular',
});

const normalizeTags = (raw, fallback) => ({
  category: String(raw?.category || fallback.category || 'other').toLowerCase(),
  subcategory: String(raw?.subcategory || fallback.subcategory || 'item').toLowerCase(),
  colors: normalizeTagList(raw?.colors, fallback.colors || ['unknown']).slice(0, 3),
  pattern: String(raw?.pattern || fallback.pattern || 'other').toLowerCase(),
  fabric: String(raw?.fabric || fallback.fabric || 'unknown').toLowerCase(),
  season: normalizeTagList(raw?.season, fallback.season || ['all-season']).slice(0, 4),
  formality: String(raw?.formality || fallback.formality || 'casual').toLowerCase(),
  occasions: normalizeTagList(raw?.occasions, fallback.occasions || ['everyday']).slice(0, 5),
  fit: String(raw?.fit || fallback.fit || 'regular').toLowerCase(),
});

const classifyWardrobeItem = async ({ imageUrl, item }) => {
  const fallback = fallbackTagsFromItem(item || {});

  if (!openai || !imageUrl) return fallback;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            {
              type: 'text',
              text: `Analyze this clothing item and return ONLY valid JSON with this exact shape:
{
  "category": "top/bottom/dress/outerwear/shoes/accessory/other",
  "subcategory": "e.g. t-shirt, jeans, sneakers",
  "colors": ["primary color", "secondary color if any"],
  "pattern": "solid/striped/floral/checkered/graphic/other",
  "fabric": "cotton/denim/leather/silk/polyester/unknown",
  "season": ["summer", "winter", "spring", "autumn", "all-season"],
  "formality": "casual/smart-casual/formal/athletic",
  "occasions": ["everyday", "work", "party", "gym", "date"],
  "fit": "slim/regular/oversized/loose"
}`,
            },
          ],
        },
      ],
      max_tokens: 400,
    });

    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = parseModelJson(content);
    return normalizeTags(parsed, fallback);
  } catch {
    return fallback;
  }
};

const CATEGORY_MATCHERS = {
  top: ['top', 'shirt', 't-shirt', 'tee', 'blouse', 'sweater', 'hoodie'],
  bottom: ['bottom', 'trouser', 'pant', 'jean', 'skirt', 'short'],
  dress: ['dress'],
  shoes: ['shoe', 'sneaker', 'boot', 'heel', 'loafer', 'sandal'],
  outerwear: ['outerwear', 'jacket', 'coat', 'blazer'],
  accessory: ['accessory', 'bag', 'belt', 'scarf', 'cap', 'hat', 'jewel'],
};

const resolveCategoryKey = (item) => {
  const rawCategory = String(item?.tags?.category || item?.category || '').toLowerCase();
  const entry = Object.entries(CATEGORY_MATCHERS).find(([, matchers]) =>
    matchers.some((m) => rawCategory.includes(m))
  );
  return entry ? entry[0] : null;
};

const pickBestRepresentative = (items = []) => {
  return [...items].sort((a, b) => {
    const wearA = Number(a?.wearCount || 0);
    const wearB = Number(b?.wearCount || 0);
    if (wearA !== wearB) return wearA - wearB;

    const createdA = new Date(a?.createdAt || 0).getTime();
    const createdB = new Date(b?.createdAt || 0).getTime();
    return createdB - createdA;
  })[0] || null;
};

const buildCombinationKey = (items = []) =>
  items.map((i) => String(i)).sort().join('|');

const SUGGESTABLE_CATEGORIES = ['top', 'bottom', 'shoes', 'outerwear', 'accessory'];

const createDefaultNewSuggestion = ({ selectedItems = [], wardrobe = [] }) => {
  const selectedCategorySet = new Set(
    selectedItems
      .map((item) => resolveCategoryKey(item))
      .filter(Boolean)
  );

  const missingCategory = SUGGESTABLE_CATEGORIES.find((category) => !selectedCategorySet.has(category));
  if (missingCategory) {
    return {
      name: `Versatile ${missingCategory}`,
      category: missingCategory,
      reason: `Adding one quality ${missingCategory} will unlock more outfit combinations.`,
    };
  }

  const lowWearItem = [...wardrobe].sort((a, b) => Number(a?.wearCount || 0) - Number(b?.wearCount || 0))[0];
  const category = resolveCategoryKey(lowWearItem) || 'accessory';

  return {
    name: 'Statement accessory',
    category,
    reason: 'A contrasting accent piece can make your existing combinations feel new.',
  };
};

const buildDiversifiedFallbackItems = ({
  groupedByCategory,
  categoryOrder,
  weather,
  recentCombinationKeys,
  recentItemIdSet = new Set(),
}) => {
  const sortedByCategory = Object.fromEntries(
    Object.entries(groupedByCategory).map(([key, list]) => [
      key,
      [...list].sort((a, b) => {
        const wearA = Number(a?.wearCount || 0);
        const wearB = Number(b?.wearCount || 0);
        if (wearA !== wearB) return wearA - wearB;
        const createdA = new Date(a?.createdAt || 0).getTime();
        const createdB = new Date(b?.createdAt || 0).getTime();
        return createdB - createdA;
      }),
    ])
  );

  const pickWithOffset = (offset) => {
    const selectedByCategory = categoryOrder
      .map((key) => ({ key, item: sortedByCategory[key]?.[offset] || sortedByCategory[key]?.[0] || null }))
      .filter((entry) => Boolean(entry.item));

    let selected = selectedByCategory.map((entry) => entry.item);

    const hasDress = selectedByCategory.some((entry) => entry.key === 'dress');
    if (hasDress) {
      selected = selectedByCategory
        .filter((entry) => entry.key !== 'top' && entry.key !== 'bottom')
        .map((entry) => entry.item);
    }

    if ((weather?.temp || 0) >= 24) {
      selected = selected.filter((item) => resolveCategoryKey(item) !== 'outerwear');
    }

    return Array.from(new Map(selected.filter(Boolean).map((i) => [String(i._id || i.id), i])).values());
  };

  const maxAlternatives = Math.max(
    1,
    ...Object.values(sortedByCategory).map((items) => items.length)
  );

  const hasAnyFreshItem = Object.values(sortedByCategory)
    .flat()
    .some((item) => !recentItemIdSet.has(String(item?._id || item?.id)));

  const hasFreshItem = (candidateItems = []) =>
    candidateItems.some((item) => !recentItemIdSet.has(String(item?._id || item?.id)));

  for (let offset = 0; offset < maxAlternatives; offset += 1) {
    const candidate = pickWithOffset(offset);
    const candidateKey = buildCombinationKey(candidate.map((i) => String(i._id || i.id)));
    if (
      candidate.length > 0
      && !recentCombinationKeys.has(candidateKey)
      && (!hasAnyFreshItem || hasFreshItem(candidate))
    ) {
      return candidate;
    }
  }

  return pickWithOffset(0);
};

const buildRuleBasedOutfit = ({
  wardrobe = [],
  occasion = 'casual',
  weather = {},
  recentCombinationKeys = new Set(),
  recentItemIdSet = new Set(),
}) => {
  const groupedByCategory = wardrobe.reduce((acc, item) => {
    const key = resolveCategoryKey(item);
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const categoryOrder = ['dress', 'top', 'bottom', 'shoes', 'outerwear', 'accessory'];

  const selectedByCategory = categoryOrder
    .map((key) => ({ key, item: pickBestRepresentative(groupedByCategory[key] || []) }))
    .filter((entry) => Boolean(entry.item));

  const availableCategoryCount = Object.keys(groupedByCategory).length;

  const unique = buildDiversifiedFallbackItems({
    groupedByCategory,
    categoryOrder,
    weather,
    recentCombinationKeys,
    recentItemIdSet,
  });

  const fallbackItems = unique.length > 0 ? unique : wardrobe.slice(0, 3);

  const isSmallWardrobe = wardrobe.length < 3 || fallbackItems.length < Math.min(3, availableCategoryCount || 1);
  const fallbackNote = isSmallWardrobe
    ? 'Fallback applied: wardrobe is too small to build a full look, so we used all relevant available items.'
    : `Fallback applied: selected one representative item from each available category (${availableCategoryCount}).`;

  return {
    outfit: {
      items: fallbackItems.map((i) => String(i._id || i.id)),
      explanation: 'This look balances your available wardrobe pieces while matching the selected context.',
      styleTitle: `${occasion} Essentials`,
      weatherNote: weather?.description
        ? `Built for ${weather.description.toLowerCase()} weather around ${Math.round(weather.temp || 0)}C.`
        : 'Built using available wardrobe balance and season-safe layering.',
      occasion,
      newSuggestion: createDefaultNewSuggestion({ selectedItems: fallbackItems, wardrobe }),
    },
    tips: [
      'Use one accessory to add contrast without overloading the outfit.',
      'Rotate frequently worn pieces with less-used items to improve wardrobe utilization.',
    ],
    fallbackNote,
  };
};

const generateOutfitWithAi = async ({
  wardrobe = [],
  occasion = 'casual',
  weather = {},
  recentCombinationKeys = [],
  recentItemIds = [],
}) => {
  const recentCombinationSet = new Set(recentCombinationKeys.map((k) => String(k)));
  const recentItemIdSet = new Set(recentItemIds.map((id) => String(id)));
  const fallback = buildRuleBasedOutfit({
    wardrobe,
    occasion,
    weather,
    recentCombinationKeys: recentCombinationSet,
    recentItemIdSet,
  });

  if (!openai) {
    return {
      ...fallback,
      isFallback: true,
      fallbackReason: 'AI provider not configured',
      fallbackNote: fallback.fallbackNote,
    };
  }

  const wardrobeSummary = wardrobe.map((item) => ({
    id: String(item._id || item.id),
    name: item.name,
    category: item.category,
    color: item.color,
    season: item.season,
    wearCount: Number(item.wearCount || 0),
    isRecentlySuggested: recentItemIdSet.has(String(item._id || item.id)),
    tags: item.tags || null,
  }));

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a fashion stylist AI. Return only strict JSON with no markdown or extra text.',
        },
        {
          role: 'user',
          content: `Generate an outfit from this wardrobe.
Occasion: ${occasion}
Weather: ${weather?.temp ?? 'unknown'}C, ${weather?.description || weather?.condition || 'unknown'}

Wardrobe:
${JSON.stringify(wardrobeSummary, null, 2)}

Return ONLY:
{
  "outfit": {
    "items": ["item_id_1", "item_id_2", "item_id_3"],
    "explanation": "2-3 sentence explanation",
    "styleTitle": "short look name",
    "weatherNote": "why weather-appropriate",
    "occasion": "${occasion}",
    "newSuggestion": {
      "name": "1 optional new piece suggestion not currently in wardrobe",
      "category": "top/bottom/shoes/outerwear/accessory",
      "reason": "why this would improve future outfits"
    }
  },
  "tips": ["tip 1", "tip 2"]
}

Rules:
- only use ids from wardrobe list
- max 5 items
- keep color/formality coherent
- avoid repeating any previous item combination key from this list: ${JSON.stringify([...recentCombinationSet])}
- prefer underused pieces and avoid recently suggested IDs when possible: ${JSON.stringify([...recentItemIdSet])}`,
        },
      ],
      max_tokens: 700,
    });

    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = parseModelJson(content);
    const aiItemIds = Array.isArray(parsed?.outfit?.items)
      ? parsed.outfit.items.map((id) => String(id))
      : [];

    const wardrobeIdSet = new Set(wardrobe.map((item) => String(item._id || item.id)));
    const filteredIds = aiItemIds.filter((id) => wardrobeIdSet.has(id)).slice(0, 5);
    const aiComboKey = buildCombinationKey(filteredIds);

    const hasFreshCandidateInWardrobe = wardrobe.some((item) => !recentItemIdSet.has(String(item._id || item.id)));
    const hasFreshItemInSelection = filteredIds.some((id) => !recentItemIdSet.has(id));

    if (filteredIds.length === 0) {
      return {
        ...fallback,
        isFallback: true,
        fallbackReason: 'Model returned invalid item IDs',
        fallbackNote: fallback.fallbackNote,
      };
    }

    if (recentCombinationSet.has(aiComboKey)) {
      return {
        ...fallback,
        isFallback: true,
        fallbackReason: 'Model repeated a recent combination',
        fallbackNote: `${fallback.fallbackNote} We also avoided recently suggested combinations.`,
      };
    }

    if (hasFreshCandidateInWardrobe && !hasFreshItemInSelection) {
      return {
        ...fallback,
        isFallback: true,
        fallbackReason: 'Model selected only recently suggested items',
        fallbackNote: `${fallback.fallbackNote} We forced at least one fresh item to keep suggestions new.`,
      };
    }

    const selectedItems = filteredIds
      .map((id) => wardrobe.find((item) => String(item._id || item.id) === id))
      .filter(Boolean);

    const aiNewSuggestion = parsed?.outfit?.newSuggestion && typeof parsed.outfit.newSuggestion === 'object'
      ? {
        name: String(parsed.outfit.newSuggestion.name || '').trim(),
        category: String(parsed.outfit.newSuggestion.category || '').trim(),
        reason: String(parsed.outfit.newSuggestion.reason || '').trim(),
      }
      : null;

    const finalNewSuggestion = aiNewSuggestion?.name
      ? aiNewSuggestion
      : createDefaultNewSuggestion({ selectedItems, wardrobe });

    return {
      outfit: {
        items: filteredIds,
        explanation: String(parsed?.outfit?.explanation || fallback.outfit.explanation),
        styleTitle: String(parsed?.outfit?.styleTitle || fallback.outfit.styleTitle),
        weatherNote: String(parsed?.outfit?.weatherNote || fallback.outfit.weatherNote),
        occasion: String(parsed?.outfit?.occasion || occasion),
        newSuggestion: finalNewSuggestion,
      },
      tips: normalizeTagList(parsed?.tips, fallback.tips).slice(0, 3),
      isFallback: false,
      fallbackReason: null,
    };
  } catch {
    return {
      ...fallback,
      isFallback: true,
      fallbackReason: 'AI generation failed',
      fallbackNote: fallback.fallbackNote,
    };
  }
};

const generateOutfitImageWithAi = async ({
  occasion = 'casual',
  weather = {},
  outfit = {},
  itemDetails = [],
}) => {
  if (!openai) {
    return {
      image: null,
      isFallback: true,
      fallbackReason: 'AI provider not configured',
    };
  }

  const styleTitle = String(outfit?.styleTitle || `${occasion} look`).trim();
  const weatherText = String(weather?.description || weather?.condition || 'unknown weather').trim();
  const weatherTemp = Number.isFinite(Number(weather?.temp)) ? `${Math.round(Number(weather.temp))}C` : 'unknown temp';

  const garments = Array.isArray(itemDetails)
    ? itemDetails
      .slice(0, 6)
      .map((item) => {
        const color = item?.color ? ` in ${item.color}` : '';
        const category = item?.category ? ` (${item.category})` : '';
        return `- ${item?.name || 'wardrobe piece'}${color}${category}`;
      })
      .join('\n')
    : '';

  const prompt = [
    'Create a single photorealistic full-body fashion editorial image of one model wearing this outfit.',
    `Style direction: ${styleTitle}.`,
    `Occasion: ${occasion}.`,
    `Weather context: ${weatherText} at around ${weatherTemp}.`,
    'Outfit pieces to include:',
    garments || '- Coordinated top, bottom, and shoes matching the style direction.',
    'Requirements:',
    '- show a complete outfit from head to toe',
    '- modern street style photography, natural lighting',
    '- no collage, no split panels, no text, no watermark, no logos',
    '- one final image only',
  ].join('\n');

  try {
    const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
    const response = await openai.images.generate({
      model,
      prompt,
      size: '1024x1024',
    });

    const first = response?.data?.[0] || null;
    if (typeof first?.url === 'string' && first.url.trim()) {
      return {
        image: first.url.trim(),
        isFallback: false,
        fallbackReason: null,
      };
    }

    if (typeof first?.b64_json === 'string' && first.b64_json.trim()) {
      return {
        image: `data:image/png;base64,${first.b64_json.trim()}`,
        isFallback: false,
        fallbackReason: null,
      };
    }

    return {
      image: null,
      isFallback: true,
      fallbackReason: 'AI image response missing image payload',
    };
  } catch {
    return {
      image: null,
      isFallback: true,
      fallbackReason: 'AI image generation failed',
    };
  }
};

const generateInsightsWithAi = async (summary) => {
  const fallback = {
    insights: ['Your wardrobe usage data is still growing. Keep logging outfits for better insights.'],
    gaps: ['Add category balance by comparing tops, bottoms, and shoes.'],
    strengths: ['You already have a usable baseline wardrobe for daily outfits.'],
    utilizationScore: 50,
    isFallback: true,
  };

  if (!openai) return fallback;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a wardrobe consultant. Return only JSON with no extra text.',
        },
        {
          role: 'user',
          content: `Analyze this wardrobe summary and return JSON:
${JSON.stringify(summary)}

Return only:
{
  "insights": ["insight 1", "insight 2", "insight 3"],
  "gaps": ["gap 1", "gap 2"],
  "strengths": ["strength 1", "strength 2"],
  "utilizationScore": 0
}`,
        },
      ],
      max_tokens: 500,
    });

    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = parseModelJson(content);

    return {
      insights: normalizeTagList(parsed?.insights, fallback.insights).slice(0, 5),
      gaps: normalizeTagList(parsed?.gaps, fallback.gaps).slice(0, 5),
      strengths: normalizeTagList(parsed?.strengths, fallback.strengths).slice(0, 5),
      utilizationScore: Math.max(0, Math.min(100, Number(parsed?.utilizationScore) || 0)),
      isFallback: false,
    };
  } catch {
    return fallback;
  }
};

module.exports = {
  isAiConfigured,
  classifyWardrobeItem,
  generateOutfitWithAi,
  generateOutfitImageWithAi,
  generateInsightsWithAi,
  buildRuleBasedOutfit,
};
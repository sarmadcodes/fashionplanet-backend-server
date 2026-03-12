const axios = require('axios');

const generateOutfit = async ({ mood, weather, wardrobe = [] }) => {
  return {
    title: `${mood} ${weather} Outfit`,
    items: wardrobe.slice(0, 3).map((w) => w.name),
    tip: 'AI service not configured yet',
    retailer: 'ZARA',
  };
};

module.exports = { generateOutfit };

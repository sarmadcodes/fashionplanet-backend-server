const mongoose = require('mongoose');

const outfitSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WardrobeItem' }],
  tags: [{ type: String }],
  image: { type: String, default: null },
  source: {
    type: String,
    enum: ['manual', 'ai'],
    default: 'manual',
    index: true,
  },
  aiMeta: {
    generationId: { type: mongoose.Schema.Types.ObjectId, ref: 'AIEvent', default: null },
    occasion: { type: String, default: null },
    preferredWeather: { type: String, default: null },
    weatherNote: { type: String, default: null },
    explanation: { type: String, default: null },
    tips: [{ type: String }],
    newSuggestion: {
      name: { type: String, default: null },
      category: { type: String, default: null },
      reason: { type: String, default: null },
    },
    itemNames: [{ type: String }],
    cloudinaryPublicId: { type: String, default: null },
  },
}, { timestamps: true });

outfitSchema.index({ userId: 1, source: 1, createdAt: -1 });

module.exports = mongoose.model('Outfit', outfitSchema);

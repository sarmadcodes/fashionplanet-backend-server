const mongoose = require('mongoose');

const outfitSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WardrobeItem' }],
  tags: [{ type: String }],
  image: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Outfit', outfitSchema);

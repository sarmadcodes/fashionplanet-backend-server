const mongoose = require('mongoose');

const wardrobeItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: [true, 'Item name is required'], trim: true },
  brand: { type: String, default: '', trim: true },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
  },
  color: { type: String, default: '' },
  season: {
    type: String,
    trim: true,
    default: 'All Season',
  },
  worth: { type: Number, default: 0, min: 0 },
  image: { type: String, required: [true, 'Image is required'] },
  wearCount: { type: Number, default: 0 },
  lastWorn: { type: Date, default: null },
  tags: {
    category: { type: String, default: '' },
    subcategory: { type: String, default: '' },
    colors: { type: [String], default: [] },
    pattern: { type: String, default: '' },
    fabric: { type: String, default: '' },
    season: { type: [String], default: [] },
    formality: { type: String, default: '' },
    occasions: { type: [String], default: [] },
    fit: { type: String, default: '' },
  },
}, { timestamps: true });

module.exports = mongoose.model('WardrobeItem', wardrobeItemSchema);

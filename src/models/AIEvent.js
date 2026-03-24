const mongoose = require('mongoose');

const aiEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['generate_outfit', 'generate_avatar', 'generate_tryon', 'outfit_feedback', 'item_tagged'],
    required: true,
  },
  context: { type: Object, default: {} },
  result: { type: Object, default: {} },
  action: {
    type: String,
    enum: ['saved', 'worn', 'skipped', 'regenerated'],
    default: null,
  },
  generationId: { type: mongoose.Schema.Types.ObjectId, ref: 'AIEvent', default: null },
}, { timestamps: true });

aiEventSchema.index({ userId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('AIEvent', aiEventSchema);

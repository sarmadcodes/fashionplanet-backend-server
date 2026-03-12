const mongoose = require('mongoose');

const rewardHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  points: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('RewardHistory', rewardHistorySchema);

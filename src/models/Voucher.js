const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  store: { type: String, required: true },
  amount: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  expiry: { type: Date, required: true },
  unlocked: { type: Boolean, default: false },
  pointsRequired: { type: Number, required: true },
  redeemedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Voucher', voucherSchema);

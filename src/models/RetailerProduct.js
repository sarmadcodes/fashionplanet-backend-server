const mongoose = require('mongoose');

const retailerProductSchema = new mongoose.Schema({
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  retailerApplicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'RetailerApplication', required: true, index: true },
  brandName: { type: String, required: true, trim: true, maxlength: 120 },
  name: { type: String, required: true, trim: true, maxlength: 140 },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', trim: true, maxlength: 1500 },
  image: { type: String, required: true, trim: true },
  productUrl: { type: String, default: '', trim: true, maxlength: 400 },
  price: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'GBP', trim: true, maxlength: 8 },
  stock: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true, index: true },
  isApprovedByAdmin: { type: Boolean, default: true, index: true },
}, { timestamps: true });

retailerProductSchema.index({ brandName: 1, category: 1, isActive: 1, isApprovedByAdmin: 1, createdAt: -1 });

module.exports = mongoose.model('RetailerProduct', retailerProductSchema);

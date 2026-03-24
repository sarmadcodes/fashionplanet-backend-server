const mongoose = require('mongoose');

const retailerApplicationSchema = new mongoose.Schema({
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  brandName: { type: String, required: true, trim: true, maxlength: 120 },
  contactName: { type: String, required: true, trim: true, maxlength: 120 },
  contactEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid contact email'],
  },
  contactPhone: { type: String, default: '', trim: true, maxlength: 40 },
  website: { type: String, default: '', trim: true, maxlength: 200 },
  categories: [{ type: String, trim: true }],
  description: { type: String, default: '', trim: true, maxlength: 1500 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, default: '', trim: true, maxlength: 1000 },
}, { timestamps: true });

retailerApplicationSchema.index({ ownerUserId: 1, createdAt: -1 });
retailerApplicationSchema.index({ brandName: 1 });

module.exports = mongoose.model('RetailerApplication', retailerApplicationSchema);

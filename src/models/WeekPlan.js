const mongoose = require('mongoose');

const planItemSchema = new mongoose.Schema({
  time: { type: String },
  event: { type: String },
  outfit: { type: String },
  sub: { type: String },
  status: { type: String, enum: ['ready', 'pending'], default: 'pending' },
});

const weekPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  weekOf: { type: Date, required: true },
  days: {
    Mon: [planItemSchema],
    Tue: [planItemSchema],
    Wed: [planItemSchema],
    Thu: [planItemSchema],
    Fri: [planItemSchema],
    Sat: [planItemSchema],
    Sun: [planItemSchema],
  },
}, { timestamps: true });

module.exports = mongoose.model('WeekPlan', weekPlanSchema);

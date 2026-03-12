const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false,
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
  },
  bio: { type: String, default: '', maxlength: 200 },
  website: { type: String, default: '' },
  avatar: { type: String, default: null },
  points: { type: Number, default: 0 },
  itemsCount: { type: Number, default: 0 },
  outfitsCount: { type: Number, default: 0 },
  accountVisibility: {
    type: String,
    enum: ['public', 'private', 'hidden'],
    default: 'public',
  },
  styleTypes: [{ type: String }],
  notificationPrefs: {
    push: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
    promotions: { type: Boolean, default: true },
  },
  privacyPrefs: {
    profileSearch: { type: Boolean, default: true },
    onlineStatus: { type: Boolean, default: true },
    dataSharing: { type: Boolean, default: false },
  },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date, default: Date.now },
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.pre('save', function () {
  if (!this.username && this.fullName) {
    this.username =
      this.fullName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') +
      '_' + Math.floor(Math.random() * 9999);
  }
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

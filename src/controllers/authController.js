const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const ApiError = require('../utils/ApiError');

const sanitizeUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  username: user.username,
  bio: user.bio,
  website: user.website,
  avatar: user.avatar,
  points: user.points,
  itemsCount: user.itemsCount,
  outfitsCount: user.outfitsCount,
  accountVisibility: user.accountVisibility,
  gender: user.gender,
  sizeTop: user.sizeTop,
  sizeBottom: user.sizeBottom,
  shoeSize: user.shoeSize,
  city: user.city,
  country: user.country,
  location: user.location,
  onboardingCompleted: user.onboardingCompleted,
  notificationPrefs: user.notificationPrefs,
  privacyPrefs: user.privacyPrefs,
  styleTypes: user.styleTypes,
  role: user.role,
  createdAt: user.createdAt,
});

exports.register = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      password,
      gender,
      sizeTop,
      sizeBottom,
      shoeSize,
      city,
      country,
      location,
      styleTypes,
    } = req.body;

    if (!fullName || !email || !password) {
      return next(new ApiError('Please provide full name, email and password', 400));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new ApiError('An account with this email already exists', 400));
    }

    const existingUsersCount = await User.countDocuments();

    const normalizedStyles = Array.isArray(styleTypes)
      ? styleTypes.map((style) => String(style || '').trim()).filter(Boolean).slice(0, 8)
      : [];

    const normalizedLocation = location && typeof location === 'object'
      ? {
        lat: Number.isFinite(Number(location.lat)) ? Number(location.lat) : null,
        lon: Number.isFinite(Number(location.lon)) ? Number(location.lon) : null,
        label: String(location.label || '').trim(),
      }
      : { lat: null, lon: null, label: '' };

    const normalizedGender = ['female', 'male', 'non-binary', 'prefer-not-to-say', 'other']
      .includes(String(gender || '').trim())
      ? String(gender).trim()
      : 'prefer-not-to-say';

    const user = await User.create({
      fullName,
      email,
      password,
      gender: normalizedGender,
      sizeTop: String(sizeTop || '').trim(),
      sizeBottom: String(sizeBottom || '').trim(),
      shoeSize: String(shoeSize || '').trim(),
      city: String(city || '').trim(),
      country: String(country || '').trim(),
      location: normalizedLocation,
      styleTypes: normalizedStyles,
      onboardingCompleted: Boolean(
        normalizedStyles.length
          || String(sizeTop || '').trim()
          || String(sizeBottom || '').trim()
          || String(shoeSize || '').trim()
          || String(city || '').trim()
          || String(country || '').trim()
      ),
      role: existingUsersCount === 0 ? 'admin' : 'user',
    });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new ApiError('Please provide email and password', 400));
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return next(new ApiError('Incorrect email or password', 401));
    }

    if (!user.isActive) {
      return next(new ApiError('Your account has been deactivated', 401));
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return next(new ApiError('Incorrect email or password', 401));
    }

    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');

    res.status(200).json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false });
    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
};

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
  notificationPrefs: user.notificationPrefs,
  privacyPrefs: user.privacyPrefs,
  styleTypes: user.styleTypes,
  createdAt: user.createdAt,
});

exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return next(new ApiError('Please provide full name, email and password', 400));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new ApiError('An account with this email already exists', 400));
    }

    const user = await User.create({ fullName, email, password });
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

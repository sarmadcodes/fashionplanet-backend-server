const User = require('../models/User');
const Post = require('../models/Post');
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
  createdAt: user.createdAt,
});

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return next(new ApiError('User not found', 404));
    res.status(200).json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const {
      fullName,
      username,
      bio,
      website,
      avatar,
      gender,
      sizeTop,
      sizeBottom,
      shoeSize,
      city,
      country,
      locationLat,
      locationLon,
      locationLabel,
      styleTypes,
      onboardingCompleted,
    } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) return next(new ApiError('User not found', 404));

    const isRemoteUploadedImage =
      typeof req.file?.path === 'string' && /^https?:\/\//i.test(req.file.path);

    let avatarUrl = user.avatar;
    if (isRemoteUploadedImage) {
      avatarUrl = req.file.path;
    } else if (req.file?.filename) {
      avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;
    } else if (typeof avatar === 'string') {
      avatarUrl = avatar.trim() || null;
    }

    if (typeof fullName === 'string' && fullName.trim()) user.fullName = fullName.trim();
    if (typeof username === 'string' && username.trim()) user.username = username.trim().replace('@', '');
    if (typeof bio === 'string') user.bio = bio.trim();
    if (typeof website === 'string') user.website = website.trim();
    if (typeof gender === 'string' && ['female', 'male', 'non-binary', 'prefer-not-to-say', 'other'].includes(gender.trim())) {
      user.gender = gender.trim();
    }
    if (typeof sizeTop === 'string') user.sizeTop = sizeTop.trim();
    if (typeof sizeBottom === 'string') user.sizeBottom = sizeBottom.trim();
    if (typeof shoeSize === 'string') user.shoeSize = shoeSize.trim();
    if (typeof city === 'string') user.city = city.trim();
    if (typeof country === 'string') user.country = country.trim();
    if (typeof locationLabel === 'string') user.location.label = locationLabel.trim();

    if (typeof locationLat !== 'undefined') {
      const lat = Number(locationLat);
      user.location.lat = Number.isFinite(lat) ? lat : null;
    }

    if (typeof locationLon !== 'undefined') {
      const lon = Number(locationLon);
      user.location.lon = Number.isFinite(lon) ? lon : null;
    }

    if (typeof styleTypes === 'string') {
      user.styleTypes = styleTypes
        .split(',')
        .map((style) => String(style || '').trim())
        .filter(Boolean)
        .slice(0, 8);
    }

    if (typeof onboardingCompleted !== 'undefined') {
      user.onboardingCompleted = ['1', 'true', 'yes', 'on'].includes(String(onboardingCompleted).trim().toLowerCase());
    } else {
      const hasOnboardingData = Boolean(
        user.styleTypes?.length
        || user.sizeTop
        || user.sizeBottom
        || user.shoeSize
        || user.city
        || user.country
      );
      if (hasOnboardingData) {
        user.onboardingCompleted = true;
      }
    }

    user.avatar = avatarUrl;

    await user.save();

    // Keep existing posts in sync with latest public profile fields.
    await Post.updateMany(
      { userId: user._id },
      {
        $set: {
          userName: user.fullName,
          username: user.username,
          avatar: user.avatar,
        },
      }
    );

    res.status(200).json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

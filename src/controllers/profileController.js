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
    const { fullName, username, bio, website, avatar } = req.body;
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

const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const WardrobeItem = require('../models/WardrobeItem');
const Voucher = require('../models/Voucher');
const RewardHistory = require('../models/RewardHistory');
const ApiError = require('../utils/ApiError');

const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const formatDateTime = (value) => {
  if (!value) return null;
  return new Date(value).toISOString();
};

exports.getOverview = async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalPosts,
      totalWardrobeItems,
      totalVouchers,
      redeemedVouchers,
      pointsAwarded,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Post.countDocuments(),
      WardrobeItem.countDocuments(),
      Voucher.countDocuments(),
      Voucher.countDocuments({ redeemedAt: { $ne: null } }),
      RewardHistory.aggregate([
        { $group: { _id: null, total: { $sum: '$points' } } },
      ]),
    ]);

    const recentRewardEvents = await RewardHistory.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('userId', 'fullName email')
      .lean();

    return res.status(200).json({
      success: true,
      overview: {
        totalUsers,
        activeUsers,
        totalPosts,
        totalWardrobeItems,
        totalVouchers,
        redeemedVouchers,
        pointsAwarded: Number(pointsAwarded?.[0]?.total || 0),
        recentRewardEvents: recentRewardEvents.map((item) => ({
          id: String(item._id),
          user: item.userId?.fullName || 'Unknown',
          email: item.userId?.email || '',
          action: item.action,
          points: Number(item.points) || 0,
          createdAt: formatDateTime(item.createdAt),
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();

    const filter = search
      ? {
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
        ],
      }
      : {};

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('fullName email username role isActive points itemsCount outfitsCount createdAt lastLogin')
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      users: users.map((user) => ({
        id: String(user._id),
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: Boolean(user.isActive),
        points: Number(user.points) || 0,
        itemsCount: Number(user.itemsCount) || 0,
        outfitsCount: Number(user.outfitsCount) || 0,
        createdAt: formatDateTime(user.createdAt),
        lastLogin: formatDateTime(user.lastLogin),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) {
      return next(new ApiError('Invalid user id', 400));
    }

    const role = String(req.body?.role || '').trim();
    if (!['user', 'admin'].includes(role)) {
      return next(new ApiError('role must be either user or admin', 400));
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return next(new ApiError('User not found', 404));
    }

    if (String(targetUser._id) === String(req.user._id) && role !== 'admin') {
      return next(new ApiError('You cannot remove your own admin role', 400));
    }

    targetUser.role = role;
    await targetUser.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      user: {
        id: String(targetUser._id),
        role: targetUser.role,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) {
      return next(new ApiError('Invalid user id', 400));
    }

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return next(new ApiError('isActive boolean is required', 400));
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return next(new ApiError('User not found', 404));
    }

    if (String(targetUser._id) === String(req.user._id)) {
      return next(new ApiError('You cannot deactivate your own admin account', 400));
    }

    targetUser.isActive = isActive;
    await targetUser.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: String(targetUser._id),
        isActive: targetUser.isActive,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.adjustUserPoints = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) {
      return next(new ApiError('Invalid user id', 400));
    }

    const delta = Number(req.body?.points);
    const reason = String(req.body?.reason || '').trim() || 'Manual admin adjustment';

    if (!Number.isFinite(delta) || delta === 0) {
      return next(new ApiError('points must be a non-zero number', 400));
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return next(new ApiError('User not found', 404));
    }

    const nextPoints = Math.max(0, (Number(targetUser.points) || 0) + delta);
    const appliedDelta = nextPoints - (Number(targetUser.points) || 0);

    targetUser.points = nextPoints;
    await targetUser.save({ validateBeforeSave: false });

    if (appliedDelta !== 0) {
      await RewardHistory.create({
        userId: targetUser._id,
        action: `Admin adjustment: ${reason}`,
        points: appliedDelta,
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: String(targetUser._id),
        points: targetUser.points,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getVouchers = async (req, res, next) => {
  try {
    const status = String(req.query.status || 'all');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();
    const filter = {};

    if (status === 'redeemed') {
      filter.redeemedAt = { $ne: null };
    } else if (status === 'unlocked') {
      filter.unlocked = true;
      filter.redeemedAt = null;
    } else if (status === 'locked') {
      filter.unlocked = false;
      filter.redeemedAt = null;
    }

    if (search) {
      filter.$or = [
        { store: { $regex: search, $options: 'i' } },
        { amount: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const [total, vouchers] = await Promise.all([
      Voucher.countDocuments(filter),
      Voucher.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'fullName email')
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      vouchers: vouchers.map((item) => ({
        id: String(item._id),
        userId: String(item.userId?._id || ''),
        userName: item.userId?.fullName || 'Unknown',
        userEmail: item.userId?.email || '',
        store: item.store,
        amount: item.amount,
        code: item.code,
        unlocked: Boolean(item.unlocked),
        pointsRequired: Number(item.pointsRequired) || 0,
        redeemedAt: formatDateTime(item.redeemedAt),
        expiry: formatDateTime(item.expiry),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getRewardEvents = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();

    const filter = {};
    let userIds = [];

    if (search) {
      const matchingUsers = await User.find({
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
        ],
      }).select('_id').lean();

      userIds = matchingUsers.map((u) => u._id);
      filter.$or = [
        { action: { $regex: search, $options: 'i' } },
        ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
      ];
    }

    const [total, rows] = await Promise.all([
      RewardHistory.countDocuments(filter),
      RewardHistory.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'fullName email username')
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      rewards: rows.map((item) => ({
        id: String(item._id),
        userId: String(item.userId?._id || ''),
        user: item.userId?.fullName || 'Unknown',
        email: item.userId?.email || '',
        username: item.userId?.username || '',
        action: item.action,
        points: Number(item.points) || 0,
        createdAt: formatDateTime(item.createdAt),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.updateVoucherUnlock = async (req, res, next) => {
  try {
    const { voucherId } = req.params;
    if (!isObjectId(voucherId)) {
      return next(new ApiError('Invalid voucher id', 400));
    }

    const { unlocked } = req.body;
    if (typeof unlocked !== 'boolean') {
      return next(new ApiError('unlocked boolean is required', 400));
    }

    const voucher = await Voucher.findById(voucherId);
    if (!voucher) {
      return next(new ApiError('Voucher not found', 404));
    }

    voucher.unlocked = unlocked;
    if (unlocked) {
      voucher.redeemedAt = null;
    }
    await voucher.save();

    return res.status(200).json({
      success: true,
      voucher: {
        id: String(voucher._id),
        unlocked: voucher.unlocked,
      },
    });
  } catch (error) {
    return next(error);
  }
};

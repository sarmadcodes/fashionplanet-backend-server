const Voucher = require('../models/Voucher');
const ApiError = require('../utils/ApiError');
const { VOUCHER_THRESHOLDS } = require('../utils/pointsHelper');

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const formatExpiry = (expiry) => {
  const date = new Date(expiry);
  return `Expires ${date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}`;
};

const toVoucherDto = (voucher) => {
  const isExpired = new Date(voucher.expiry).getTime() < Date.now();
  const isRedeemed = Boolean(voucher.redeemedAt);

  return {
    id: String(voucher._id),
    store: voucher.store,
    amount: voucher.amount,
    code: voucher.code,
    expiry: formatExpiry(voucher.expiry),
    unlocked: Boolean(voucher.unlocked && !isExpired && !isRedeemed),
    pointsRequired: Number(voucher.pointsRequired) || 0,
    redeemedAt: voucher.redeemedAt || null,
    isExpired,
  };
};

const ensureVoucherPool = async (userId, points) => {
  for (const rule of VOUCHER_THRESHOLDS) {
    const existing = await Voucher.findOne({ userId, pointsRequired: rule.points });
    if (existing) {
      const shouldUnlock = points >= rule.points;
      if (existing.unlocked !== shouldUnlock) {
        existing.unlocked = shouldUnlock;
        await existing.save();
      }
      continue;
    }

    await Voucher.create({
      userId,
      store: rule.store,
      amount: rule.amount,
      code: rule.code(),
      expiry: addDays(new Date(), 120),
      unlocked: points >= rule.points,
      pointsRequired: rule.points,
    });
  }
};

exports.getVouchers = async (req, res, next) => {
  try {
    const points = Number(req.user?.points) || 0;
    await ensureVoucherPool(req.user._id, points);

    const vouchers = await Voucher.find({ userId: req.user._id })
      .sort({ pointsRequired: 1, createdAt: 1 })
      .lean();

    res.status(200).json({
      success: true,
      vouchers: vouchers.map(toVoucherDto),
    });
  } catch (error) {
    next(error);
  }
};

exports.redeemVoucher = async (req, res, next) => {
  try {
    const voucher = await Voucher.findOne({ _id: req.params.voucherId, userId: req.user._id });
    if (!voucher) {
      return next(new ApiError('Voucher not found', 404));
    }

    if (!voucher.unlocked) {
      return next(new ApiError('Voucher is still locked', 400));
    }

    if (voucher.redeemedAt) {
      return next(new ApiError('Voucher already redeemed', 400));
    }

    if (new Date(voucher.expiry).getTime() < Date.now()) {
      return next(new ApiError('Voucher has expired', 400));
    }

    voucher.redeemedAt = new Date();
    await voucher.save();

    res.status(200).json({
      success: true,
      message: 'Voucher redeemed successfully',
      voucher: toVoucherDto(voucher),
    });
  } catch (error) {
    next(error);
  }
};

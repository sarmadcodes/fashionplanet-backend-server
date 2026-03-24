require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Post = require('../src/models/Post');
const Outfit = require('../src/models/Outfit');
const WardrobeItem = require('../src/models/WardrobeItem');
const WeekPlan = require('../src/models/WeekPlan');
const Notification = require('../src/models/Notification');
const RewardHistory = require('../src/models/RewardHistory');
const Voucher = require('../src/models/Voucher');
const AIEvent = require('../src/models/AIEvent');
const RetailerApplication = require('../src/models/RetailerApplication');
const RetailerProduct = require('../src/models/RetailerProduct');

const KEEP_EMAIL = (process.env.KEEP_EMAIL || 'noahwhite262@gmail.com').trim().toLowerCase();
const REPORT_PATH = path.join(__dirname, 'cleanup-report.json');

const countAll = async (keepUserId) => {
  const notKeep = { $ne: keepUserId };
  return {
    usersTotal: await User.countDocuments(),
    usersToDelete: await User.countDocuments({ _id: notKeep }),
    postsToDelete: await Post.countDocuments({ userId: notKeep }),
    outfitsToDelete: await Outfit.countDocuments({ userId: notKeep }),
    wardrobeToDelete: await WardrobeItem.countDocuments({ userId: notKeep }),
    weekPlansToDelete: await WeekPlan.countDocuments({ userId: notKeep }),
    notificationsToDelete: await Notification.countDocuments({ userId: notKeep }),
    rewardHistoryToDelete: await RewardHistory.countDocuments({ userId: notKeep }),
    vouchersToDelete: await Voucher.countDocuments({ userId: notKeep }),
    aiEventsToDelete: await AIEvent.countDocuments({ userId: notKeep }),
    retailerAppsToDelete: await RetailerApplication.countDocuments({ ownerUserId: notKeep }),
    retailerProductsToDelete: await RetailerProduct.countDocuments({ ownerUserId: notKeep }),
  };
};

const main = async () => {
  const report = {
    startedAt: new Date().toISOString(),
    keepEmail: KEEP_EMAIL,
    ok: false,
  };

  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing');
    }

    await mongoose.connect(process.env.MONGO_URI);

    const keepUser = await User.findOne({ email: KEEP_EMAIL }).select('_id email fullName role').lean();
    if (!keepUser) {
      throw new Error(`User to keep not found: ${KEEP_EMAIL}`);
    }

    const keepUserId = keepUser._id;
    const deleteFilter = { $ne: keepUserId };

    report.keepUser = {
      id: String(keepUser._id),
      email: keepUser.email,
      fullName: keepUser.fullName,
      role: keepUser.role,
    };

    report.before = await countAll(keepUserId);

    await Promise.all([
      Post.deleteMany({ userId: deleteFilter }),
      Outfit.deleteMany({ userId: deleteFilter }),
      WardrobeItem.deleteMany({ userId: deleteFilter }),
      WeekPlan.deleteMany({ userId: deleteFilter }),
      Notification.deleteMany({ userId: deleteFilter }),
      RewardHistory.deleteMany({ userId: deleteFilter }),
      Voucher.deleteMany({ userId: deleteFilter }),
      AIEvent.deleteMany({ userId: deleteFilter }),
      RetailerApplication.deleteMany({ ownerUserId: deleteFilter }),
      RetailerProduct.deleteMany({ ownerUserId: deleteFilter }),
    ]);

    const keptPostIds = await Post.find({ userId: keepUserId }).distinct('_id');
    await User.updateOne(
      { _id: keepUserId },
      {
        $set: { savedPosts: keptPostIds },
      }
    );

    await User.deleteMany({ _id: deleteFilter });
    await Post.updateMany({}, { $pull: { likedBy: { $ne: keepUserId } } });

    report.after = await countAll(keepUserId);
    report.remainingUsers = await User.find({}).select('email fullName role').lean();
    report.ok = true;
  } catch (error) {
    report.error = error.message;
    process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    try {
      await mongoose.disconnect();
    } catch (_) {
      // ignore disconnect errors
    }
  }
};

main();
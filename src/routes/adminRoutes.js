const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');
const {
  getOverview,
  getUsers,
  updateUserRole,
  updateUserStatus,
  adjustUserPoints,
  getVouchers,
  getRewardEvents,
  updateVoucherUnlock,
} = require('../controllers/adminController');

router.use(protect, requireAdmin);

router.get('/overview', getOverview);
router.get('/users', getUsers);
router.patch('/users/:userId/role', updateUserRole);
router.patch('/users/:userId/status', updateUserStatus);
router.post('/users/:userId/points', adjustUserPoints);

router.get('/vouchers', getVouchers);
router.patch('/vouchers/:voucherId/unlock', updateVoucherUnlock);

router.get('/rewards', getRewardEvents);

module.exports = router;

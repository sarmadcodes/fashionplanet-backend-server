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
  getRetailerApplications,
  reviewRetailerApplication,
  getRetailerProducts,
  updateRetailerProductModeration,
} = require('../controllers/adminController');

router.use(protect, requireAdmin);

router.get('/overview', getOverview);
router.get('/users', getUsers);
router.patch('/users/:userId/role', updateUserRole);
router.patch('/users/:userId/status', updateUserStatus);
router.post('/users/:userId/points', adjustUserPoints);

router.get('/vouchers', getVouchers);
router.patch('/vouchers/:voucherId/unlock', updateVoucherUnlock);

router.get('/retailers', getRetailerApplications);
router.patch('/retailers/:retailerId/review', reviewRetailerApplication);
router.get('/retailer-products', getRetailerProducts);
router.patch('/retailer-products/:productId/moderation', updateRetailerProductModeration);

router.get('/rewards', getRewardEvents);

module.exports = router;

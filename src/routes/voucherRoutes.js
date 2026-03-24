const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getVouchers, redeemVoucher } = require('../controllers/voucherController');

router.use(protect);
router.get('/', getVouchers);
router.post('/:voucherId/redeem', redeemVoucher);

module.exports = router;

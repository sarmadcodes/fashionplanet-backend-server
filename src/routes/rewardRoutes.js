const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getRewards } = require('../controllers/rewardController');

router.use(protect);
router.get('/', getRewards);

module.exports = router;

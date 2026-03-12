const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { notImplemented } = require('../controllers/rewardController');

router.use(protect, notImplemented);

module.exports = router;

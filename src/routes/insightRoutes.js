const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getInsights } = require('../controllers/insightController');

router.use(protect);
router.get('/', getInsights);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
	tagWardrobeItem,
	generateOutfit,
	generateStyleAvatar,
	logOutfitFeedback,
	getAiStats,
	getWardrobeInsights,
} = require('../controllers/aiController');
const { enforceDailyOutfitLimit } = require('../middleware/aiRateLimit');

router.use(protect);
router.get('/stats', getAiStats);
router.post('/tag-item/:itemId', tagWardrobeItem);
router.post('/generate-outfit', enforceDailyOutfitLimit, generateOutfit);
router.post('/generate-style-avatar', enforceDailyOutfitLimit, generateStyleAvatar);
router.post('/feedback', logOutfitFeedback);
router.post('/wardrobe-insights', getWardrobeInsights);

module.exports = router;

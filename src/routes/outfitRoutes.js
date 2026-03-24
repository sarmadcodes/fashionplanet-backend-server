const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getOutfits, getRecentOutfits, getAiOutfits } = require('../controllers/outfitController');

router.use(protect);
router.get('/ai', getAiOutfits);
router.get('/', getOutfits);
router.get('/recent', getRecentOutfits);

module.exports = router;

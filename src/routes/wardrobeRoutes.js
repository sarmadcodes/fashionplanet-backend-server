const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
	getWardrobeItems,
	addWardrobeItem,
	updateWardrobeItem,
	deleteWardrobeItem,
} = require('../controllers/wardrobeController');
const { uploadWardrobeImage } = require('../middleware/upload');

router.use(protect);
router.get('/', getWardrobeItems);
router.post('/', uploadWardrobeImage, addWardrobeItem);
router.patch('/:id', uploadWardrobeImage, updateWardrobeItem);
router.delete('/:id', deleteWardrobeItem);

module.exports = router;

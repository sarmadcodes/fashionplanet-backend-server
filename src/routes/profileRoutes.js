const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadAvatar } = require('../middleware/upload');
const { getProfile, updateProfile } = require('../controllers/profileController');

router.use(protect);
router.get('/', getProfile);
router.patch('/', uploadAvatar, updateProfile);

module.exports = router;

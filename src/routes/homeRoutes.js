const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getHomeData } = require('../controllers/homeController');

router.use(protect);
router.get('/', getHomeData);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getWeekPlan, toggleWeekPlanItem, addWeekPlanItem } = require('../controllers/weekplanController');

router.use(protect);
router.get('/', getWeekPlan);
router.post('/:day', addWeekPlanItem);
router.patch('/:day/:itemId/toggle', toggleWeekPlanItem);

module.exports = router;

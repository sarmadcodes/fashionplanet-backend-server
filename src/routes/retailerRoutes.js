const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  submitRetailerApplication,
  getMyRetailerApplication,
  createRetailerProduct,
  getMyRetailerProducts,
  updateRetailerProduct,
  deleteRetailerProduct,
} = require('../controllers/retailerController');

router.use(protect);
router.post('/apply', submitRetailerApplication);
router.get('/me', getMyRetailerApplication);
router.get('/products/mine', getMyRetailerProducts);
router.post('/products', createRetailerProduct);
router.patch('/products/:productId', updateRetailerProduct);
router.delete('/products/:productId', deleteRetailerProduct);

module.exports = router;

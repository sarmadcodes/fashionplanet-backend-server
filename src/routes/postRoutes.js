const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadPostImages } = require('../middleware/upload');
const {
  createPost,
  getFeedPosts,
  getMyPosts,
  updatePost,
  deletePost,
  likePost,
  addComment,
  getNotifications,
  markAsRead,
  savePost,
  getSavedPosts,
} = require('../controllers/postController');

// Must come FIRST before :postId routes
router.post('/create', protect, uploadPostImages, createPost);
router.get('/feed', protect, getFeedPosts);
router.get('/my', protect, getMyPosts);
router.get('/notifications', protect, getNotifications);
router.get('/saved', protect, getSavedPosts);

// Notification mark as read (before :postId routes)
router.put('/notification/:notificationId/read', protect, markAsRead);

// Then :postId routes
router.post('/:postId/like', protect, likePost);
router.post('/:postId/comment', protect, addComment);
router.post('/:postId/save', protect, savePost);
router.patch('/:postId', protect, updatePost);
router.delete('/:postId', protect, deletePost);

module.exports = router;

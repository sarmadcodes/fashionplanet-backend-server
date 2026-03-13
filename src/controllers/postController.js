const Post = require('../models/Post');
const Notification = require('../models/Notification');
const User = require('../models/User');
const mongoose = require('mongoose');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const toPostDto = (post, currentUserId) => {
  const p = post.toObject ? post.toObject() : post;
  const likedBy = Array.isArray(p.likedBy) ? p.likedBy : [];

  return {
    ...p,
    id: p._id,
    isOwn: String(p.userId) === String(currentUserId),
    liked: likedBy.some((id) => String(id) === String(currentUserId)),
  };
};

// ─── Create Post ──────────────────────────────────────────────
exports.createPost = async (req, res) => {
  try {
    const userId = req.user._id;
    const rawCaption = req.body?.caption;
    const caption = typeof rawCaption === 'string' ? rawCaption.trim() : '';

    const uploadedImages = Array.isArray(req.files)
      ? req.files.map((file) => {
        const isRemoteUploadedImage =
          typeof file?.path === 'string' && /^https?:\/\//i.test(file.path);
        if (isRemoteUploadedImage) return file.path;
        return `${req.protocol}://${req.get('host')}/uploads/posts/${file.filename}`;
      })
      : [];

    const bodyImages = Array.isArray(req.body?.images)
      ? req.body.images
      : typeof req.body?.images === 'string' && req.body.images.trim()
        ? [req.body.images.trim()]
        : [];

    const images = [...uploadedImages, ...bodyImages].filter(Boolean);

    if (!caption || images.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Caption and at least one image are required' 
      });
    }

    const newPost = new Post({
      userName: req.user.fullName,
      username: req.user.username,
      userId,
      avatar: req.user.avatar,
      images,
      caption,
      likes: 0,
      comments: 0,
      liked: false,
      isOwn: true,
      commentsList: [],
      date: 'Just now',
    });

    await newPost.save();
    res.status(201).json({ success: true, data: toPostDto(newPost, userId) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get All Feed Posts ───────────────────────────────────────
exports.getFeedPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const posts = await Post.find().sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: posts.map((p) => toPostDto(p, userId)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const posts = await Post.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: posts.map((p) => toPostDto(p, userId)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { caption } = req.body;
    const userId = req.user._id;

    if (!isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post id' });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    if (String(post.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own posts' });
    }

    if (typeof caption === 'string') {
      post.caption = caption.trim();
    }

    await post.save();
    res.json({ success: true, data: toPostDto(post, userId) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    if (!isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post id' });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    if (String(post.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'You can only delete your own posts' });
    }

    await Notification.deleteMany({ postId: post._id });
    await Post.findByIdAndDelete(postId);

    // Remove from saved lists for all users.
    await User.updateMany({ savedPosts: post._id }, { $pull: { savedPosts: post._id } });

    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Like Post ────────────────────────────────────────────────
exports.likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    const userName = req.user.fullName;

    if (!isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post id' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Toggle like
    if (post.likedBy && post.likedBy.some((id) => id.toString() === userId.toString())) {
      post.likedBy = post.likedBy.filter(id => id.toString() !== userId);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      if (!post.likedBy) post.likedBy = [];
      post.likedBy.push(userId);
      post.likes += 1;

      // Create notification if not own post
      if (post.userId.toString() !== userId) {
        const notification = new Notification({
          userId: post.userId,
          type: 'like',
          user: userName,
          action: 'liked your post',
          postId,
          read: false,
        });
        await notification.save();
      }
    }

    await post.save();
    res.json({ success: true, data: toPostDto(post, userId) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Add Comment ──────────────────────────────────────────────
exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;
    const userName = req.user.fullName;

    if (!isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post id' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment cannot be empty' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (!post.commentsList) post.commentsList = [];
    
    const newComment = {
      id: 'c_' + Date.now(),
      author: userName,
      username: req.user.username,
      avatar: req.user.avatar,
      text: text.trim(),
      timestamp: 'Just now',
    };

    post.commentsList.push(newComment);
    post.comments += 1;

    // Create notification if not own post
    if (post.userId.toString() !== userId) {
      const notification = new Notification({
        userId: post.userId,
        type: 'comment',
        user: userName,
        action: 'commented on your post',
        postId,
        read: false,
      });
      await notification.save();
    }

    await post.save();
    res.json({ success: true, data: { post, comment: newComment } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Notifications ────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Mark Notification as Read ────────────────────────────────
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { read: true },
      { new: true }
    );
    res.json({ success: true, data: notification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Save Post ────────────────────────────────────────────────
exports.savePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post id' });
    }

    if (!user.savedPosts) user.savedPosts = [];

    const isSaved = user.savedPosts.some((id) => id.toString() === postId.toString());
    if (isSaved) {
      user.savedPosts = user.savedPosts.filter(id => id.toString() !== postId);
    } else {
      user.savedPosts.push(postId);
    }

    await user.save();
    res.json({ success: true, isSaved: !isSaved, data: user.savedPosts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Saved Posts ──────────────────────────────────────────
exports.getSavedPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    const savedPosts = await Post.find({ _id: { $in: user.savedPosts || [] } });
    res.json({ success: true, data: savedPosts.map((p) => toPostDto(p, userId)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

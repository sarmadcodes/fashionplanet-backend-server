const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  id: { type: String },
  author: { type: String, required: true },
  username: { type: String },
  avatar: { type: String },
  text: { type: String, required: true, maxlength: 500 },
  timestamp: { type: String, default: 'Just now' },
}, { _id: false });

const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  username: { type: String },
  avatar: { type: String },
  images: [{ type: String, required: true }],
  caption: { type: String, default: '', maxlength: 1000 },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  commentsList: [commentSchema],
  liked: { type: Boolean, default: false },
  isOwn: { type: Boolean, default: false },
  date: { type: String, default: 'Just now' },
}, { timestamps: true });

module.exports = mongoose.model('Post', postSchema);


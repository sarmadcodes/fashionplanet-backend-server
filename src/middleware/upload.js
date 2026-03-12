const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../config/cloudinary');

const hasCloudinaryConfig =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

const uploadsRoot = path.join(process.cwd(), 'uploads');
const ensureDir = (folder) => {
  const dir = path.join(uploadsRoot, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const localWardrobeStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ensureDir('wardrobe')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg');
    cb(null, `wardrobe_${Date.now()}${ext}`);
  },
});

const localPostStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ensureDir('posts')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg');
    cb(null, `post_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const localAvatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ensureDir('avatars')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg');
    cb(null, `avatar_${Date.now()}${ext}`);
  },
});

const wardrobeStorage = hasCloudinaryConfig
  ? new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'fashion-planet/wardrobe',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
    },
  })
  : localWardrobeStorage;

const postStorage = hasCloudinaryConfig
  ? new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'fashion-planet/posts',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 1080, height: 1080, crop: 'limit', quality: 'auto' }],
    },
  })
  : localPostStorage;

const avatarStorage = hasCloudinaryConfig
  ? new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'fashion-planet/avatars',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }],
    },
  })
  : localAvatarStorage;

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const uploadWardrobeImage = multer({ storage: wardrobeStorage, fileFilter }).single('image');
const uploadPostImages = multer({ storage: postStorage, fileFilter }).array('images', 5);
const uploadAvatar = multer({ storage: avatarStorage, fileFilter }).single('avatar');

module.exports = { uploadWardrobeImage, uploadPostImages, uploadAvatar };

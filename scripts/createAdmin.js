const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

dotenv.config();

const buildDefaultName = (email) => {
  const local = String(email || '').split('@')[0] || 'Admin';
  const cleaned = local.replace(/[^a-zA-Z0-9]/g, ' ').trim();
  if (!cleaned) return 'Admin User';
  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const run = async () => {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  const password = String(process.argv[3] || '').trim();
  const fullName = String(process.argv[4] || '').trim() || buildDefaultName(email);

  if (!email || !password) {
    console.error('Usage: npm run create-admin -- <email> <password> [fullName]');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  try {
    await connectDB();

    let user = await User.findOne({ email }).select('+password');

    if (!user) {
      user = await User.create({
        fullName,
        email,
        password,
        role: 'admin',
        isActive: true,
      });

      console.log(`Created admin user: ${email}`);
      process.exit(0);
    }

    user.fullName = user.fullName || fullName;
    user.password = password;
    user.role = 'admin';
    user.isActive = true;

    await user.save();

    console.log(`Updated existing user to admin and reset password: ${email}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to create admin:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

run();

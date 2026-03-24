const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

dotenv.config();

const run = async () => {
  const email = String(process.argv[2] || '').trim().toLowerCase();

  if (!email) {
    console.error('Usage: npm run promote-admin -- <email>');
    process.exit(1);
  }

  try {
    await connectDB();

    const user = await User.findOne({ email });
    if (!user) {
      console.error(`No user found for ${email}`);
      process.exit(1);
    }

    user.role = 'admin';
    await user.save({ validateBeforeSave: false });

    console.log(`Success: ${email} is now an admin.`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to promote admin:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

run();

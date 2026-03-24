const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');

dotenv.config();
connectDB();
const isDevelopment = process.env.NODE_ENV === 'development';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const adminPanelRoot = path.join(__dirname, '..', 'fashionplanet-adminpanel');

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': [
        "'self'",
        ...(isDevelopment ? ["'unsafe-eval'"] : []),
      ],
    },
  },
}));
app.use(compression());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});
app.use('/api/auth', authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.get('/admin', (req, res) => {
  res.sendFile(path.join(adminPanelRoot, 'index.html'));
});
app.use('/admin', express.static(adminPanelRoot));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Fashion Planet API is running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/profile', require('./src/routes/profileRoutes'));
app.use('/api/wardrobe', require('./src/routes/wardrobeRoutes'));
app.use('/api/outfits', require('./src/routes/outfitRoutes'));
app.use('/api/posts', require('./src/routes/postRoutes'));
app.use('/api/rewards', require('./src/routes/rewardRoutes'));
app.use('/api/vouchers', require('./src/routes/voucherRoutes'));
app.use('/api/insights', require('./src/routes/insightRoutes'));
app.use('/api/weekplan', require('./src/routes/weekplanRoutes'));
app.use('/api/ai', require('./src/routes/aiRoutes'));
app.use('/api/home', require('./src/routes/homeRoutes'));
app.use('/api/admin', require('./src/routes/adminRoutes'));
app.use('/api/retailers', require('./src/routes/retailerRoutes'));

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

const shutdown = (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forcefully shutting down after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

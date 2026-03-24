const jwt = require('jsonwebtoken');

const parseJwtExpiresIn = (value) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value !== 'string') {
    return '30d';
  }

  const trimmed = value.trim().replace(/^['\"]|['\"]$/g, '');
  if (!trimmed) {
    return '30d';
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (/^\d+\s*(ms|s|m|h|d|w|y)$/i.test(trimmed)) {
    return trimmed.replace(/\s+/g, '').toLowerCase();
  }

  return '30d';
};

const generateToken = (userId) => {
  const expiresIn = parseJwtExpiresIn(process.env.JWT_EXPIRES_IN);

  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn,
  });
};

module.exports = generateToken;

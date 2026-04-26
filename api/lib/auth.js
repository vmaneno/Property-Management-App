const jwt = require('jsonwebtoken');

function getSecret() {
  return process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
}

function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: '8h' });
}

function requireAuth(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.slice(7), getSecret());
  } catch {
    return null;
  }
}

module.exports = { signToken, requireAuth };

const { registerC2BUrls } = require('../../lib/daraja');
const { requireAuth }    = require('../../lib/auth');
const cors               = require('../../lib/cors');

// Run this ONCE after deploying to register your callback URLs with Safaricom.
// POST /api/mpesa/c2b/register  — requires master admin JWT.
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req);
  if (!user || user.role !== 'master') {
    return res.status(403).json({ error: 'Forbidden — master admin only' });
  }

  try {
    const result = await registerC2BUrls();
    console.log('C2B registration result:', result);
    return res.json({ ok: true, result });
  } catch (err) {
    console.error('mpesa/c2b/register:', err);
    return res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
};

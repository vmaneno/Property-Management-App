const { getPool } = require('../../lib/db');
const cors        = require('../../lib/cors');

// Safaricom calls this before confirming a Paybill payment.
// We check that BillRefNumber is a valid active tenant ID.
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const { BillRefNumber } = req.body || {};

  if (!BillRefNumber) {
    return res.json({ ResultCode: 'C2B00011', ResultDesc: 'Missing account number' });
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT tenant_id FROM tenants WHERE tenant_id = $1 AND active = true',
      [String(BillRefNumber).toUpperCase()]
    );
    if (!rows.length) {
      return res.json({ ResultCode: 'C2B00011', ResultDesc: 'Invalid account number' });
    }
    return res.json({ ResultCode: '0', ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('mpesa/c2b/validate:', err);
    return res.json({ ResultCode: 'C2B00012', ResultDesc: 'Service unavailable' });
  }
};

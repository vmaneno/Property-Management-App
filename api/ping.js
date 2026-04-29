const { getPool } = require('./lib/db');

module.exports = async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    return res.json({ ok: true, time: new Date().toISOString() });
  } catch (err) {
    console.error('ping error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

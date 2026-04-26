const bcrypt = require('bcrypt');
const { getPool } = require('../lib/db');
const cors        = require('../lib/cors');

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { phase, type, username, propCode, code, newPassword } = req.body || {};

  if (!phase || !type || !username) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const pool = getPool();

  try {
    // ── Phase 1: look up user, generate code ─────────────────
    if (phase === 1) {
      let email;

      if (type === 'tenant') {
        if (!propCode) return res.status(400).json({ error: 'Property code required' });
        const { rows } = await pool.query(
          `SELECT data->>'Email' AS email FROM tenants WHERE username=$1 AND property_code=$2 AND active=true`,
          [username, propCode]
        );
        if (!rows.length) return res.status(404).json({ error: 'No active account found with those details.' });
        email = rows[0].email;

      } else if (type === 'client') {
        const { rows } = await pool.query(
          `SELECT data->>'Email' AS email FROM clients WHERE username=$1 AND active=true`,
          [username]
        );
        if (!rows.length) return res.status(404).json({ error: 'No active account found with that username.' });
        email = rows[0].email;

      } else if (type === 'agency') {
        const { rows } = await pool.query(
          `SELECT data->>'Email' AS email FROM agencies WHERE username=$1 AND active=true AND is_master=false`,
          [username]
        );
        if (!rows.length) return res.status(404).json({ error: 'No active agency account found with that username.' });
        email = rows[0].email;

      } else if (type === 'master') {
        const { rows } = await pool.query(
          `SELECT data->>'Email' AS email FROM agencies WHERE username=$1 AND active=true AND is_master=true`,
          [username]
        );
        if (!rows.length) return res.status(404).json({ error: 'No active Master Admin account found with that username.' });
        email = rows[0].email;

      } else {
        return res.status(400).json({ error: 'Invalid type' });
      }

      if (!email) {
        return res.status(400).json({ error: 'No email address on file. Contact your administrator.' });
      }

      const resetCode = String(Math.floor(100000 + Math.random() * 900000));
      await pool.query(
        `INSERT INTO reset_tokens (role, username, code, expires_at) VALUES ($1,$2,$3, NOW() + INTERVAL '15 minutes')`,
        [type, username, resetCode]
      );

      return res.json({ email, code: resetCode });

    // ── Phase 2: verify code, update password ─────────────────
    } else if (phase === 2) {
      if (!code || !newPassword) {
        return res.status(400).json({ error: 'Missing code or new password' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      const { rows: tokenRows } = await pool.query(
        `SELECT id FROM reset_tokens
         WHERE role=$1 AND username=$2 AND code=$3 AND expires_at > NOW() AND used=false`,
        [type, username, code]
      );
      if (!tokenRows.length) {
        return res.status(400).json({ error: 'Invalid or expired reset code.' });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE reset_tokens SET used=true WHERE id=$1', [tokenRows[0].id]);

      const emptyPass = JSON.stringify({ Password: '' });
      if      (type === 'tenant')               await pool.query(`UPDATE tenants  SET password_hash=$1, data=data||$2::jsonb WHERE username=$3`, [hash, emptyPass, username]);
      else if (type === 'client')               await pool.query(`UPDATE clients  SET password_hash=$1, data=data||$2::jsonb WHERE username=$3`, [hash, emptyPass, username]);
      else if (type === 'agency' || type === 'master') await pool.query(`UPDATE agencies SET password_hash=$1, data=data||$2::jsonb WHERE username=$3`, [hash, emptyPass, username]);

      return res.json({ ok: true });

    } else {
      return res.status(400).json({ error: 'Invalid phase' });
    }

  } catch (err) {
    console.error('reset error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

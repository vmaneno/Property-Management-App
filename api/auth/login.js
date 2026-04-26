const bcrypt = require('bcrypt');
const { getPool }   = require('../lib/db');
const { signToken } = require('../lib/auth');
const cors          = require('../lib/cors');

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { role, username, password, propCode } = req.body || {};
  if (!role || !username || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const pool = getPool();

  try {
    let row, id, outRole;

    if (role === 'tenant') {
      if (!propCode) return res.status(400).json({ error: 'Property code required' });
      const { rows } = await pool.query(
        'SELECT tenant_id AS id, password_hash, active FROM tenants WHERE username=$1 AND property_code=$2',
        [username, propCode]
      );
      if (!rows.length || !rows[0].active) {
        return res.status(401).json({ error: 'Invalid credentials or inactive account.' });
      }
      row = rows[0]; id = row.id; outRole = 'tenant';

    } else if (role === 'client') {
      const { rows } = await pool.query(
        'SELECT client_code AS id, password_hash, active FROM clients WHERE username=$1',
        [username]
      );
      if (!rows.length || !rows[0].active) {
        return res.status(401).json({ error: 'Invalid credentials or inactive account.' });
      }
      row = rows[0]; id = row.id; outRole = 'client';

    } else if (role === 'agency') {
      const { rows } = await pool.query(
        'SELECT agency_code AS id, password_hash, active, is_master FROM agencies WHERE username=$1',
        [username]
      );
      if (!rows.length || !rows[0].active) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      if (rows[0].is_master) {
        return res.status(401).json({ error: 'Use the Master Admin portal.' });
      }
      row = rows[0]; id = row.id; outRole = 'agency';

    } else if (role === 'master') {
      const { rows } = await pool.query(
        'SELECT agency_code AS id, password_hash, active, is_master FROM agencies WHERE username=$1',
        [username]
      );
      if (!rows.length || !rows[0].active || !rows[0].is_master) {
        return res.status(401).json({ error: 'Invalid master credentials.' });
      }
      row = rows[0]; id = row.id; outRole = 'master';

    } else {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (!row.password_hash) {
      return res.status(401).json({ error: 'Account credentials not set up yet. Please use the Setup section.' });
    }

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials or inactive account.' });
    }

    const token = signToken({ role: outRole, id });
    return res.json({ token, session: { role: outRole, id } });

  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

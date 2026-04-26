const bcrypt = require('bcrypt');
const { getPool } = require('../lib/db');
const cors        = require('../lib/cors');

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, username, password, propCode, tenCode, tel, clientCode, agCode } = req.body || {};

  if (!type || !username || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const pool = getPool();

  try {
    // Check username uniqueness per table
    let dupQ;
    if      (type === 'tenant')            dupQ = await pool.query('SELECT 1 FROM tenants  WHERE username=$1', [username]);
    else if (type === 'client')            dupQ = await pool.query('SELECT 1 FROM clients  WHERE username=$1', [username]);
    else if (type === 'agency' || type === 'master') dupQ = await pool.query('SELECT 1 FROM agencies WHERE username=$1', [username]);
    else return res.status(400).json({ error: 'Invalid type' });

    if (dupQ.rows.length > 0) {
      return res.status(400).json({ error: 'Username already taken. Choose another.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const dataUpdate = JSON.stringify({ UserName: username, Password: '' });

    if (type === 'tenant') {
      if (!propCode || !tenCode || !tel) {
        return res.status(400).json({ error: 'Missing tenant verification fields' });
      }
      const { rows } = await pool.query(
        `SELECT tenant_id FROM tenants
         WHERE property_code=$1 AND (username IS NULL OR username='')
         AND active=true AND data->>'TenantNumber'=$2 AND data->>'Telephone'=$3`,
        [propCode, tenCode, tel]
      );
      if (!rows.length) {
        return res.status(400).json({ error: 'No matching account found, or credentials already set. Contact your property manager.' });
      }
      await pool.query(
        `UPDATE tenants SET username=$1, password_hash=$2, data=data||$3::jsonb WHERE tenant_id=$4`,
        [username, hash, dataUpdate, rows[0].tenant_id]
      );

    } else if (type === 'client') {
      if (!clientCode || !tel) {
        return res.status(400).json({ error: 'Missing client verification fields' });
      }
      const { rows } = await pool.query(
        `SELECT client_code FROM clients
         WHERE client_code=$1 AND (username IS NULL OR username='')
         AND active=true AND data->>'Telephone'=$2`,
        [clientCode, tel]
      );
      if (!rows.length) {
        return res.status(400).json({ error: 'No matching account found, or credentials already set. Contact your property manager.' });
      }
      await pool.query(
        `UPDATE clients SET username=$1, password_hash=$2, data=data||$3::jsonb WHERE client_code=$4`,
        [username, hash, dataUpdate, clientCode]
      );

    } else if (type === 'agency') {
      if (!agCode || !tel) {
        return res.status(400).json({ error: 'Missing agency verification fields' });
      }
      const { rows } = await pool.query(
        `SELECT agency_code FROM agencies
         WHERE agency_code=$1 AND (username IS NULL OR username='')
         AND active=true AND is_master=false AND data->>'Telephone'=$2`,
        [agCode, tel]
      );
      if (!rows.length) {
        return res.status(400).json({ error: 'No matching account found, or credentials already set. Contact your administrator.' });
      }
      await pool.query(
        `UPDATE agencies SET username=$1, password_hash=$2, data=data||$3::jsonb WHERE agency_code=$4`,
        [username, hash, dataUpdate, agCode]
      );

    } else if (type === 'master') {
      if (!agCode || !tel) {
        return res.status(400).json({ error: 'Missing master verification fields' });
      }
      const { rows } = await pool.query(
        `SELECT agency_code FROM agencies
         WHERE agency_code=$1 AND (username IS NULL OR username='')
         AND active=true AND is_master=true AND data->>'Telephone'=$2`,
        [agCode, tel]
      );
      if (!rows.length) {
        return res.status(400).json({ error: 'No matching account found, or credentials already set. Contact your administrator.' });
      }
      await pool.query(
        `UPDATE agencies SET username=$1, password_hash=$2, data=data||$3::jsonb WHERE agency_code=$4`,
        [username, hash, dataUpdate, agCode]
      );
    }

    return res.json({ ok: true });

  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

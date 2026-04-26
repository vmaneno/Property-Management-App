const bcrypt          = require('bcryptjs');
const { getPool }     = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');
const cors            = require('../../lib/cors');

const TABLE_MAP = {
  agencies:     { db: 'agencies',     key: 'agency_code' },
  clients:      { db: 'clients',      key: 'client_code' },
  properties:   { db: 'properties',   key: 'property_code' },
  propunits:    { db: 'prop_units',   key: 'unit_code' },
  tenants:      { db: 'tenants',      key: 'tenant_id' },
  transactions: { db: 'transactions', key: 'transaction_ref' },
};

module.exports = async (req, res) => {
  if (cors(req, res)) return;

  const user = requireAuth(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { table, key } = req.query;
  const tbl = TABLE_MAP[table];
  if (!tbl) return res.status(404).json({ error: 'Unknown table: ' + table });

  const pool = getPool();

  try {
    if (req.method === 'GET') {
      const { rows } = await pool.query(
        `SELECT data FROM ${tbl.db} WHERE ${tbl.key}=$1`, [key]
      );
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      return res.json(rows[0].data);

    } else if (req.method === 'PATCH') {
      const updates = req.body;
      if (!updates) return res.status(400).json({ error: 'Missing body' });
      await patchRecord(pool, table, tbl, key, updates);
      return res.json({ ok: true });

    } else if (req.method === 'DELETE') {
      await pool.query(`DELETE FROM ${tbl.db} WHERE ${tbl.key}=$1`, [key]);
      return res.json({ ok: true });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error(`data/${table}/${key} error:`, err);
    return res.status(500).json({ error: 'Server error' });
  }
};

async function patchRecord(pool, table, tbl, key, updates) {
  const clean = { ...updates };
  const sets  = [];
  const params = [];
  let idx = 1;

  // Handle password update — bcrypt and clear plaintext
  if (clean.Password && clean.Password !== '') {
    const hash = await bcrypt.hash(clean.Password, 10);
    sets.push(`password_hash = $${idx++}`);
    params.push(hash);
    clean.Password = '';
  }

  // Sync structural columns
  if ('Active' in clean) {
    sets.push(`active = $${idx++}`);
    params.push(clean.Active === 'Y');
  }
  if ('Master' in clean && table === 'agencies') {
    sets.push(`is_master = $${idx++}`);
    params.push(clean.Master === 'Y');
  }
  if ('UserName' in clean) {
    sets.push(`username = $${idx++}`);
    params.push(clean.UserName || null);
  }
  if ('UnitCode' in clean && table === 'tenants') {
    sets.push(`unit_code = $${idx++}`);
    params.push(clean.UnitCode || null);
  }
  if ('PropertyCode' in clean && table === 'tenants') {
    sets.push(`property_code = $${idx++}`);
    params.push(clean.PropertyCode || null);
  }

  // Merge JSONB data
  sets.push(`data = data || $${idx++}::jsonb`);
  params.push(JSON.stringify(clean));

  params.push(key);
  const sql = `UPDATE ${tbl.db} SET ${sets.join(', ')} WHERE ${tbl.key} = $${idx}`;
  await pool.query(sql, params);
}

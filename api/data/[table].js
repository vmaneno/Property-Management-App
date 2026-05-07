const bcrypt          = require('bcryptjs');
const { getPool }     = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const cors            = require('../lib/cors');

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

  const { table } = req.query;
  const tbl = TABLE_MAP[table];
  if (!tbl) return res.status(404).json({ error: 'Unknown table: ' + table });

  const pool = getPool();

  try {
    if (req.method === 'GET') {
      const { rows } = await pool.query(`SELECT data FROM ${tbl.db}`);
      return res.json(rows.map(r => r.data));

    } else if (req.method === 'POST') {
      const record = req.body;
      if (!record) return res.status(400).json({ error: 'Missing body' });
      await insertRecord(pool, table, record);
      return res.status(201).json({ ok: true });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error(`data/${table} error:`, err);
    return res.status(500).json({ error: 'Server error' });
  }
};

async function insertRecord(pool, table, d) {
  const data = { ...d };
  let hash = null;
  if (data.Password && data.Password !== '') {
    hash = await bcrypt.hash(data.Password, 10);
    data.Password = '';
  }

  if (table === 'agencies') {
    await pool.query(
      `INSERT INTO agencies (agency_code,username,password_hash,is_master,active,data)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (agency_code) DO NOTHING`,
      [data.AgencyCode, data.UserName||null, hash, data.Master==='Y', data.Active==='Y', JSON.stringify(data)]
    );
  } else if (table === 'clients') {
    await pool.query(
      `INSERT INTO clients (client_code,agency_code,username,password_hash,active,data)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (client_code) DO NOTHING`,
      [data.ClientCode, data.AgencyCode, data.UserName||null, hash, data.Active==='Y', JSON.stringify(data)]
    );
  } else if (table === 'properties') {
    await pool.query(
      `INSERT INTO properties (property_code,client_code,agency_code,active,data)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (property_code) DO NOTHING`,
      [data.PropertyCode, data.ClientCode, data.AgencyCode, data.Active==='Y', JSON.stringify(data)]
    );
  } else if (table === 'propunits') {
    await pool.query(
      `INSERT INTO prop_units (unit_code,property_code,active,data)
       VALUES ($1,$2,$3,$4) ON CONFLICT (unit_code) DO NOTHING`,
      [data.UnitCode, data.PropertyCode, data.Active==='Y', JSON.stringify(data)]
    );
  } else if (table === 'tenants') {
    await pool.query(
      `INSERT INTO tenants (tenant_id,property_code,unit_code,username,password_hash,active,data)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (tenant_id) DO NOTHING`,
      [data.TenantID, data.PropertyCode, data.UnitCode||null, data.UserName||null, hash, data.Active==='Y', JSON.stringify(data)]
    );
  } else if (table === 'transactions') {
    await pool.query(
      `INSERT INTO transactions (transaction_ref,tenant_id,property_code,trans_ref,bank_rec,data)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (transaction_ref) DO NOTHING`,
      [data.transactionRef, data.TenantID, data.PropertyCode,
       data.TransRef || null, data.BankRec || 'N', JSON.stringify(data)]
    );
  }
}

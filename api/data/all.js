const { getPool }    = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const cors            = require('../lib/cors');

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const pool = getPool();
  const { role, id } = user;

  try {
    const agRows = await pool.query('SELECT data FROM agencies ORDER BY agency_code');
    const agencies = agRows.rows.map(r => r.data);

    let clients = [], properties = [], propunits = [], tenants = [], transactions = [];

    if (role === 'master') {
      const [c, p, u, t, tx] = await Promise.all([
        pool.query('SELECT data FROM clients'),
        pool.query('SELECT data FROM properties'),
        pool.query('SELECT data FROM prop_units'),
        pool.query('SELECT data FROM tenants'),
        pool.query('SELECT data FROM transactions'),
      ]);
      clients      = c.rows.map(r => r.data);
      properties   = p.rows.map(r => r.data);
      propunits    = u.rows.map(r => r.data);
      tenants      = t.rows.map(r => r.data);
      transactions = tx.rows.map(r => r.data);

    } else if (role === 'agency') {
      const [c, p] = await Promise.all([
        pool.query('SELECT data FROM clients    WHERE agency_code=$1', [id]),
        pool.query('SELECT data FROM properties WHERE agency_code=$1', [id]),
      ]);
      clients    = c.rows.map(r => r.data);
      properties = p.rows.map(r => r.data);
      const pCodes = properties.map(x => x.PropertyCode);
      if (pCodes.length) {
        const [u, t] = await Promise.all([
          pool.query('SELECT data FROM prop_units WHERE property_code=ANY($1)', [pCodes]),
          pool.query('SELECT data FROM tenants   WHERE property_code=ANY($1)', [pCodes]),
        ]);
        propunits = u.rows.map(r => r.data);
        tenants   = t.rows.map(r => r.data);
        const tIds = tenants.map(x => x.TenantID);
        if (tIds.length) {
          const tx = await pool.query('SELECT data FROM transactions WHERE tenant_id=ANY($1)', [tIds]);
          transactions = tx.rows.map(r => r.data);
        }
      }

    } else if (role === 'client') {
      const [cl, p] = await Promise.all([
        pool.query('SELECT data FROM clients    WHERE client_code=$1', [id]),
        pool.query('SELECT data FROM properties WHERE client_code=$1', [id]),
      ]);
      clients    = cl.rows.map(r => r.data);
      properties = p.rows.map(r => r.data);
      const pCodes = properties.map(x => x.PropertyCode);
      if (pCodes.length) {
        const [u, t] = await Promise.all([
          pool.query('SELECT data FROM prop_units WHERE property_code=ANY($1)', [pCodes]),
          pool.query('SELECT data FROM tenants   WHERE property_code=ANY($1)', [pCodes]),
        ]);
        propunits = u.rows.map(r => r.data);
        tenants   = t.rows.map(r => r.data);
        const tIds = tenants.map(x => x.TenantID);
        if (tIds.length) {
          const tx = await pool.query('SELECT data FROM transactions WHERE tenant_id=ANY($1)', [tIds]);
          transactions = tx.rows.map(r => r.data);
        }
      }

    } else if (role === 'tenant') {
      const { rows: tRows } = await pool.query('SELECT data FROM tenants WHERE tenant_id=$1', [id]);
      if (tRows.length) {
        const t = tRows[0].data;
        tenants = [t];
        const [p, u, tx] = await Promise.all([
          pool.query('SELECT data FROM properties  WHERE property_code=$1', [t.PropertyCode]),
          t.UnitCode
            ? pool.query('SELECT data FROM prop_units WHERE unit_code=$1', [t.UnitCode])
            : Promise.resolve({ rows: [] }),
          pool.query('SELECT data FROM transactions WHERE tenant_id=$1', [id]),
        ]);
        properties   = p.rows.map(r => r.data);
        propunits    = u.rows.map(r => r.data);
        transactions = tx.rows.map(r => r.data);
      }
    }

    return res.json({ agencies, clients, properties, propunits, tenants, transactions });

  } catch (err) {
    console.error('data/all error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

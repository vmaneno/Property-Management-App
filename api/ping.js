const { getPool }     = require('./lib/db');
const { requireAuth } = require('./lib/auth');

async function postMonthlyRent(pool) {
  const now        = new Date();
  const year       = now.getFullYear();
  const month      = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = `${year}-${month}-01`;
  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const { rows: tenants } = await pool.query(
    `SELECT tenant_id, property_code, data FROM tenants WHERE active = true`
  );

  let charged = 0, skipped = 0, errors = 0;

  for (const t of tenants) {
    const d          = t.data || {};
    const rentAmount = parseFloat(d.RentAmount || 0);
    if (!rentAmount || rentAmount <= 0) { skipped++; continue; }

    const { rows: dup } = await pool.query(
      `SELECT 1 FROM transactions
       WHERE tenant_id = $1
         AND data->>'UpdateUser' = 'AUTO_RENT'
         AND data->>'Date' >= $2`,
      [t.tenant_id, monthStart]
    );
    if (dup.length) { skipped++; continue; }

    const { rows: last } = await pool.query(
      `SELECT transaction_ref FROM transactions ORDER BY transaction_ref DESC LIMIT 1`
    );
    const nextNum = last.length
      ? parseInt(last[0].transaction_ref.replace('TXN-', ''), 10) + 1
      : 1;
    const txRef = 'TXN-' + String(nextNum).padStart(5, '0');

    const txData = {
      transactionRef:  txRef,
      Date:            monthStart,
      TenantID:        t.tenant_id,
      PropertyCode:    d.PropertyCode || t.property_code || '',
      Description:     `Rent Charge - ${monthLabel}`,
      Amount:          -Math.abs(rentAmount),
      Currency:        'KES',
      Authenticated:   'Y',
      BankRec:         'N',
      TransRef:        '',
      PaymentMethod:   '',
      TransactionNote: `Monthly rent auto-posted for ${monthLabel}`,
      UpdateUser:      'AUTO_RENT',
    };

    try {
      await pool.query(
        `INSERT INTO transactions (transaction_ref, tenant_id, property_code, trans_ref, bank_rec, data)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (transaction_ref) DO NOTHING`,
        [txRef, t.tenant_id, d.PropertyCode || t.property_code || '', null, 'N', JSON.stringify(txData)]
      );
      charged++;
    } catch (err) {
      console.error(`Auto rent charge failed for ${t.tenant_id}:`, err.message);
      errors++;
    }
  }

  console.log(`AUTO_RENT ${monthLabel}: charged=${charged} skipped=${skipped} errors=${errors}`);
  return { month: monthLabel, charged, skipped, errors };
}

module.exports = async (req, res) => {
  const pool = getPool();

  try {
    await pool.query('SELECT 1');

    // Manual charge trigger: POST /api/ping?action=charge (master admin JWT required)
    if (req.query.action === 'charge') {
      const user = requireAuth(req);
      if (!user || user.role !== 'master') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const result = await postMonthlyRent(pool);
      return res.json({ ok: true, ...result });
    }

    // Automatic: cron runs daily at 8am — post rent only on the 1st
    if (new Date().getDate() === 1) {
      postMonthlyRent(pool).catch(err => console.error('AUTO_RENT error:', err.message));
    }

    return res.json({ ok: true, time: new Date().toISOString() });

  } catch (err) {
    console.error('ping error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

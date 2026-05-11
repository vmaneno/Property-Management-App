const { getPool }     = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const cors            = require('./lib/cors');

// Called by Vercel cron on the 1st of every month (vercel.json).
// Also callable manually by a master admin for early/test runs.
// Idempotent: skips tenants already charged this month.
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  // Allow Vercel cron (CRON_SECRET) OR logged-in master admin
  const auth = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET;
  const isCron   = cronSecret && auth === `Bearer ${cronSecret}`;
  const user     = requireAuth(req);
  const isMaster = user && user.role === 'master';

  if (!isCron && !isMaster) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const pool = getPool();
  const now        = new Date();
  const year       = now.getFullYear();
  const month      = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = `${year}-${month}-01`;
  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  try {
    const { rows: tenants } = await pool.query(
      `SELECT tenant_id, property_code, data FROM tenants WHERE active = true`
    );

    let charged = 0, skipped = 0, errors = 0;

    for (const t of tenants) {
      const d          = t.data || {};
      const rentAmount = parseFloat(d.RentAmount || 0);

      if (!rentAmount || rentAmount <= 0) { skipped++; continue; }

      // Idempotency: skip if already auto-charged this month
      const { rows: dup } = await pool.query(
        `SELECT 1 FROM transactions
         WHERE tenant_id = $1
           AND data->>'UpdateUser' = 'AUTO_RENT'
           AND data->>'Date' >= $2`,
        [t.tenant_id, monthStart]
      );
      if (dup.length) { skipped++; continue; }

      // Generate next transaction ref
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
          [txRef, t.tenant_id, d.PropertyCode || t.property_code || '', '', 'N', JSON.stringify(txData)]
        );
        charged++;
      } catch (err) {
        console.error(`Auto rent charge failed for ${t.tenant_id}:`, err.message);
        errors++;
      }
    }

    console.log(`AUTO_RENT ${monthLabel}: charged=${charged} skipped=${skipped} errors=${errors}`);
    return res.json({ ok: true, month: monthLabel, charged, skipped, errors });

  } catch (err) {
    console.error('rent endpoint error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

const { getPool }     = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const cors            = require('./lib/cors');

const BASE = process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

let _tok = null, _exp = 0;

async function getAccessToken() {
  if (_tok && Date.now() < _exp) return _tok;
  const creds = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');
  const res = await fetch(
    `${BASE}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${creds}` } }
  );
  const json = await res.json();
  if (!json.access_token) throw new Error('Daraja auth failed: ' + JSON.stringify(json));
  _tok = json.access_token;
  _exp = Date.now() + (Number(json.expires_in) - 60) * 1000;
  return _tok;
}

async function handleRegister(req, res) {
  const user = requireAuth(req);
  if (!user || user.role !== 'master') {
    return res.status(403).json({ error: 'Forbidden — master admin only' });
  }
  try {
    const token = await getAccessToken();
    const r = await fetch(`${BASE}/mpesa/c2b/v1/registerurl`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ShortCode:       process.env.MPESA_SHORTCODE,
        ResponseType:    'Completed',
        ConfirmationURL: process.env.MPESA_C2B_CONFIRM_URL,
        ValidationURL:   process.env.MPESA_C2B_VALIDATE_URL,
      }),
    });
    const result = await r.json();
    console.log('C2B registration result:', result);
    return res.json({ ok: true, result });
  } catch (err) {
    console.error('mpesa/register:', err);
    return res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
}

async function handleSimulate(req, res) {
  const user = requireAuth(req);
  if (!user || user.role !== 'master') {
    return res.status(403).json({ error: 'Forbidden — master admin only' });
  }
  const { Amount, Msisdn, BillRefNumber } = req.body || {};
  if (!Amount || !Msisdn || !BillRefNumber) {
    return res.status(400).json({ error: 'Amount, Msisdn and BillRefNumber are required' });
  }
  try {
    const token = await getAccessToken();
    const r = await fetch(`${BASE}/mpesa/c2b/v1/simulate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ShortCode:   process.env.MPESA_SHORTCODE,
        CommandID:   'CustomerPayBillOnline',
        Amount:      String(Amount),
        Msisdn:      String(Msisdn),
        BillRefNumber: String(BillRefNumber),
      }),
    });
    const result = await r.json();
    console.log('C2B simulate result:', result);
    return res.json({ ok: true, result });
  } catch (err) {
    console.error('mpesa/simulate:', err);
    return res.status(500).json({ error: 'Simulate failed', detail: err.message });
  }
}

async function handleValidate(req, res) {
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
    console.error('mpesa/validate:', err);
    return res.json({ ResultCode: 'C2B00012', ResultDesc: 'Service unavailable' });
  }
}

async function handleConfirm(req, res) {
  const {
    TransID, TransTime, TransAmount,
    BillRefNumber, MSISDN, FirstName, LastName,
  } = req.body || {};

  if (!TransID || !BillRefNumber || !TransAmount) {
    return res.json({ ResultCode: '0', ResultDesc: 'Accepted' });
  }

  const pool = getPool();

  try {
    const { rows: dup } = await pool.query(
      'SELECT transaction_ref FROM transactions WHERE trans_ref = $1',
      [TransID]
    );
    if (dup.length) return res.json({ ResultCode: '0', ResultDesc: 'Accepted' });

    const tenantId = String(BillRefNumber).toUpperCase();
    const { rows: tenants } = await pool.query(
      'SELECT data FROM tenants WHERE tenant_id = $1', [tenantId]
    );
    const tenantData = tenants[0]?.data || {};

    const { rows: last } = await pool.query(
      `SELECT transaction_ref FROM transactions ORDER BY transaction_ref DESC LIMIT 1`
    );
    const nextNum = last.length
      ? parseInt(last[0].transaction_ref.replace('TXN-', ''), 10) + 1
      : 1;
    const txRef = 'TXN-' + String(nextNum).padStart(5, '0');

    const ts = String(TransTime || '');
    const txDate = ts.length >= 8
      ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`
      : new Date().toISOString().slice(0, 10);

    const data = {
      transactionRef:     txRef,
      Date:               txDate,
      TenantID:           tenantId,
      PropertyCode:       tenantData.PropertyCode || '',
      Description:        'M-Pesa Rent Payment',
      Amount:             parseFloat(TransAmount),
      Currency:           'KES',
      Authenticated:      'Y',
      BankRec:            'Y',
      TransRef:           TransID,
      MpesaReceiptNumber: TransID,
      MpesaPhone:         MSISDN || '',
      MpesaName:          `${FirstName || ''} ${LastName || ''}`.trim(),
      PaymentMethod:      'MPESA',
      TransactionNote:    `Paid via M-Pesa Paybill from ${MSISDN || 'unknown'}`,
      UpdateUser:         'MPESA_AUTO',
    };

    await pool.query(
      `INSERT INTO transactions (transaction_ref, tenant_id, property_code, trans_ref, bank_rec, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (transaction_ref) DO NOTHING`,
      [txRef, tenantId, tenantData.PropertyCode || '', TransID, 'Y', JSON.stringify(data)]
    );

    console.log(`M-Pesa recorded: ${txRef} | ${tenantId} | KES ${TransAmount} | ${TransID}`);
    return res.json({ ResultCode: '0', ResultDesc: 'Accepted' });

  } catch (err) {
    console.error('mpesa/confirm:', err);
    return res.json({ ResultCode: '0', ResultDesc: 'Accepted' });
  }
}

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const { action } = req.query;

  if (action === 'register') return handleRegister(req, res);
  if (action === 'simulate') return handleSimulate(req, res);
  if (action === 'validate') return handleValidate(req, res);
  if (action === 'confirm')  return handleConfirm(req, res);

  return res.status(404).json({ error: 'Unknown action' });
};

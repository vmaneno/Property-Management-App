const { getPool } = require('../../lib/db');
const cors        = require('../../lib/cors');

// Safaricom calls this when a Paybill payment is confirmed.
// We record it as an authenticated, bank-reconciled transaction.
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const {
    TransID, TransTime, TransAmount,
    BillRefNumber, MSISDN, FirstName, LastName,
  } = req.body || {};

  if (!TransID || !BillRefNumber || !TransAmount) {
    return res.json({ ResultCode: '0', ResultDesc: 'Accepted' });
  }

  const pool = getPool();

  try {
    // Idempotency — Safaricom can send the same callback more than once
    const { rows: dup } = await pool.query(
      'SELECT transaction_ref FROM transactions WHERE trans_ref = $1',
      [TransID]
    );
    if (dup.length) {
      return res.json({ ResultCode: '0', ResultDesc: 'Accepted' });
    }

    // Resolve tenant
    const tenantId = String(BillRefNumber).toUpperCase();
    const { rows: tenants } = await pool.query(
      'SELECT data FROM tenants WHERE tenant_id = $1',
      [tenantId]
    );
    const tenantData = tenants[0]?.data || {};

    // Generate next internal transaction reference
    const { rows: last } = await pool.query(
      `SELECT transaction_ref FROM transactions ORDER BY transaction_ref DESC LIMIT 1`
    );
    const nextNum = last.length
      ? parseInt(last[0].transaction_ref.replace('TXN-', ''), 10) + 1
      : 1;
    const txRef = 'TXN-' + String(nextNum).padStart(5, '0');

    // Parse Safaricom TransTime: YYYYMMDDHHmmss → YYYY-MM-DD
    const ts = String(TransTime || '');
    const txDate = ts.length >= 8
      ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`
      : new Date().toISOString().slice(0, 10);

    const data = {
      transactionRef:      txRef,
      Date:                txDate,
      TenantID:            tenantId,
      PropertyCode:        tenantData.PropertyCode || '',
      Description:         'M-Pesa Rent Payment',
      Amount:              parseFloat(TransAmount),
      Currency:            'KES',
      Authenticated:       'Y',
      BankRec:             'Y',
      TransRef:            TransID,
      MpesaReceiptNumber:  TransID,
      MpesaPhone:          MSISDN || '',
      MpesaName:           `${FirstName || ''} ${LastName || ''}`.trim(),
      PaymentMethod:       'MPESA',
      TransactionNote:     `Paid via M-Pesa Paybill from ${MSISDN || 'unknown'}`,
      UpdateUser:          'MPESA_AUTO',
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
    console.error('mpesa/c2b/confirm:', err);
    // Always return success to Safaricom — the money has already moved
    return res.json({ ResultCode: '0', ResultDesc: 'Accepted' });
  }
};

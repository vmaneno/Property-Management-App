const BASE = process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

// Token cache — valid for this serverless invocation's lifetime
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

async function registerC2BUrls() {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}/mpesa/c2b/v1/registerurl`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ShortCode: process.env.MPESA_SHORTCODE,
      ResponseType: 'Completed',
      ConfirmationURL: process.env.MPESA_C2B_CONFIRM_URL,
      ValidationURL:   process.env.MPESA_C2B_VALIDATE_URL,
    }),
  });
  return res.json();
}

module.exports = { getAccessToken, registerC2BUrls };

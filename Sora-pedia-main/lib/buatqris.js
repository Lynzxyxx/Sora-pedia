// Integrasi deposit otomatis BuatQRIS. Dipanggil dari SERVER saja (Secret Token tidak pernah ke browser).
const crypto = require('crypto');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function configured() {
  return !!(process.env.BUATQRIS_ACCOUNT_ID && process.env.BUATQRIS_SECRET_TOKEN);
}

async function call(params) {
  const base = process.env.BUATQRIS_BASE_URL || 'https://api.buatqris.site';
  const body = new URLSearchParams({
    account_id: process.env.BUATQRIS_ACCOUNT_ID,
    secret_token: process.env.BUATQRIS_SECRET_TOKEN,
    ...params
  });
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body
  });
  let data;
  try { data = await res.json(); } catch (e) { data = { success: false, message: 'Respons gateway tidak valid' }; }
  return { status: res.status, data };
}

async function createQris({ amount, description, callbackUrl }) {
  const p = {
    action: 'api_create_qris',
    amount: String(amount),
    description,
    qris_method: process.env.BUATQRIS_METHOD || 'qris_two',
    fee_by: process.env.BUATQRIS_FEE_BY || 'buyer'
  };
  if (callbackUrl) p.callback_url = callbackUrl;
  if (process.env.BUATQRIS_TEST === '1') p.test = '1';
  return call(p);
}

async function checkStatus(transactionId) {
  return call({ action: 'api_check_status', transaction_id: String(transactionId) });
}

// Signature webhook: header X-BuatQris-Signature = "sha256=" + HMAC_SHA256(body, signing secret)
function verifySignature(rawBody, header) {
  const s = process.env.BUATQRIS_WEBHOOK_SECRET;
  if (!s) return false;
  const calc = 'sha256=' + crypto.createHmac('sha256', s).update(rawBody).digest('hex');
  const a = Buffer.from(calc), b = Buffer.from(String(header || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { configured, createQris, checkStatus, verifySignature };

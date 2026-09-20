// Forensic logging SEMENTARA untuk melacak sumber HTTP 402 pada order flow.
// Non-aktif secara default; aktifkan lewat environment variable ORDER_DEBUG=1
// di Vercel (Project Settings > Environment Variables) lalu redeploy.
//
// ATURAN KETAT — tidak pernah mencatat/mengirim:
//   API key, password, salt/hash, session secret, token, service account.
// Hanya field yang eksplisit di-allowlist di bawah yang pernah disentuh.

export const debugEnabled = () => process.env.ORDER_DEBUG === '1';

function safeStringify(data) {
  try { return JSON.stringify(data); } catch (e) { return String(data); }
}

export function logStep(tag, data) {
  if (!debugEnabled()) return;
  console.log('[ORDER_STEP] ' + tag + (data ? ' ' + safeStringify(data) : ''));
}

export function logAuth(data) {
  if (!debugEnabled()) return;
  console.log('[AUTH_DEBUG] ' + safeStringify(data));
}

export function logOrderDebug(data) {
  if (!debugEnabled()) return;
  console.log('[ORDER_DEBUG] ' + safeStringify(data));
}

// Dipanggil sekali saat Firebase diinisialisasi, supaya bisa dicek dari log
// apakah server production benar-benar terhubung ke project/DB yang sama
// dengan yang dilihat di Firebase Console. Tidak pernah mencatat credential.
export function logDbIdentity({ databaseURL, projectId }) {
  if (!debugEnabled()) return;
  let host = null;
  try { host = new URL(databaseURL).host; } catch (e) { host = null; }
  console.log('[DB_IDENTITY] ' + safeStringify({
    projectId: projectId || null,
    databaseHost: host,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'
  }));
}

// Dipakai untuk membangun payload `debug` yang aman disertakan di body
// response JSON ketika ORDER_DEBUG=1 (lihat lib/route.js). Hanya field
// non-sensitif seputar order/saldo — tidak pernah kredensial.
export function buildOrderDebugPayload(fields) {
  if (!debugEnabled()) return undefined;
  return fields;
}

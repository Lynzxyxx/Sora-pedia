export class HttpError extends Error {
  // `code` opsional: kode mesin yang konsisten (mis. INSUFFICIENT_BALANCE,
  // PROVIDER_ERROR) tanpa mengubah field `error` yang sudah dipakai frontend.
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

export function parseBody(raw, contentType = '') {
  if (!raw) return {};
  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(raw));
    }
    return JSON.parse(raw);
  } catch (e) {
    throw new HttpError(400, 'Format data tidak valid');
  }
}

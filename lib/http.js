export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
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

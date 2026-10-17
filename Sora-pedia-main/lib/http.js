class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined && req.body !== null) {
      // bodyParser aktif (fallback)
      if (Buffer.isBuffer(req.body)) return resolve(req.body.toString('utf8'));
      if (typeof req.body === 'string') return resolve(req.body);
      return resolve(JSON.stringify(req.body));
    }
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1024 * 1024) { reject(new HttpError(413, 'Payload terlalu besar')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseBody(raw, contentType = '') {
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

module.exports = { HttpError, readRaw, parseBody };

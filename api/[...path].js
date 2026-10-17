const routes = require('../lib/routes');
const { HttpError, readRaw, parseBody } = require('../lib/http');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const path = (req.url || '').split('?')[0].replace(/^\/api\/?/, '').replace(/\/$/, '');
    const handler = routes[req.method + ' ' + path];
    if (!handler) throw new HttpError(404, 'Endpoint tidak ditemukan');
    const raw = req.method === 'GET' ? '' : await readRaw(req);
    const body = req.method === 'GET' ? {} : parseBody(raw, req.headers['content-type'] || '');
    const out = await handler({ req, body, raw });
    res.status(200).json(out);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    res.status(status).json({ error: status === 500 ? 'Terjadi kesalahan pada server' : e.message });
  }
};

// Body dibaca manual supaya signature webhook bisa diverifikasi dari raw body
module.exports.config = { api: { bodyParser: false } };

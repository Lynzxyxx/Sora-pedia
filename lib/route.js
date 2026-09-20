// Adapter Route Handler Next.js (App Router).
// Menggantikan parsing manual di api/[...path].js: routing sekarang ditangani
// oleh struktur folder app/api/**, adapter ini hanya menyiapkan body + error handling
// dengan bentuk respons yang persis sama seperti sebelumnya.
import { NextResponse } from 'next/server';
import { HttpError, parseBody } from './http.js';

const json = (data, status) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export function createRoute(handler) {
  return async function route(request) {
    try {
      // raw body dibaca sebagai teks supaya signature webhook bisa diverifikasi
      const raw = request.method === 'GET' ? '' : await request.text();
      const body = request.method === 'GET'
        ? {}
        : parseBody(raw, request.headers.get('content-type') || '');
      // shim: handler lama membaca header lewat req.headers['nama-header']
      const req = { method: request.method, url: request.url, headers: Object.fromEntries(request.headers) };
      const out = await handler({ req, body, raw });
      return json(out, 200);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      const isServerFault = !(e instanceof HttpError);
      if (isServerFault || status >= 500) console.error(e);
      const message = isServerFault ? 'Terjadi kesalahan pada server' : e.message;
      const code = (e instanceof HttpError && e.code) || (isServerFault ? 'INTERNAL_ERROR' : undefined);
      // `error` tetap string seperti kontrak API lama; `code`/`debug` hanya
      // tambahan. `debug` hanya pernah terisi kalau ORDER_DEBUG=1 (lihat
      // lib/debug.js) dan hanya berisi field yang di-allowlist eksplisit di
      // handler — tidak pernah credential/secret.
      const debug = e instanceof HttpError ? e.debug : undefined;
      return json({ error: message, ...(code ? { code } : {}), ...(debug ? { debug } : {}) }, status);
    }
  };
}

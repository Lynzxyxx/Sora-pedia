const { db } = require('./firebase');
const A = require('./auth');
const bq = require('./buatqris');
const provider = require('./provider');
const { HttpError } = require('./http');
const DEFAULT_SERVICES = require('./defaultServices');

const routes = {};
const R = (method, path, fn) => { routes[method + ' ' + path] = fn; };
const now = () => Date.now();
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const emailKey = (e) => e.toLowerCase().replace(/[.#$\[\]\/]/g, ',');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------- helpers ----------
async function get(path) { return (await db().ref(path).once('value')).val(); }
async function incStat(key, by = 1) { await db().ref('stats/' + key).transaction((c) => (c || 0) + by); }

async function settings() {
  const s = (await get('settings')) || {};
  return {
    minDeposit: num(s.minDeposit, num(process.env.MIN_DEPOSIT, 10000)),
    maxDeposit: num(s.maxDeposit, num(process.env.MAX_DEPOSIT, 5000000)),
    markup: num(s.markup, num(process.env.PROVIDER_MARKUP_PERCENT, 20)),
    multiplier: num(s.multiplier, num(process.env.PROVIDER_RATE_MULTIPLIER, 1))
  };
}

async function addMutation(uid, type, amount, note) {
  await db().ref('mutations/' + uid).push({ type, amount, note, createdAt: now() });
}

async function changeBalance(uid, delta, { allowNegative = false } = {}) {
  // Catatan: Firebase menjalankan callback transaksi pertama kali dengan nilai lokal (sering null).
  // Kalau di percobaan itu kita batalkan (return undefined), transaksi tidak pernah diulang dengan
  // nilai asli dari server. Jadi untuk null kita kembalikan tebakan, lalu Firebase mengulang dengan data asli.
  let seen;
  const r = await db().ref('users/' + uid + '/balance').transaction((b) => {
    seen = b;
    if (b === null || b === undefined) return allowNegative || delta > 0 ? delta : 0;
    if (!allowNegative && b + delta < 0) return; // saldo tidak cukup, batal
    return b + delta;
  });
  if (!r.committed) return null;
  if ((seen === null || seen === undefined) && delta < 0 && !allowNegative) return null; // saldo memang kosong
  return r.snapshot.val();
}

const publicUser = (id, u) => ({ uid: id, name: u.name, email: u.email, balance: u.balance || 0, createdAt: u.createdAt });

const publicService = (id, s) => ({ id, no: s.no || id, cat: s.cat, name: s.name, price: s.price, min: s.min, max: s.max });

async function ensureServices() {
  const snap = await db().ref('services').limitToFirst(1).once('value');
  if (snap.exists()) return;
  const updates = {};
  DEFAULT_SERVICES.forEach((s) => { updates[String(s.no)] = { ...s, active: true }; });
  await db().ref('services').update(updates);
}

async function throttle(key) {
  const rec = await get('loginAttempts/' + key);
  if (rec && rec.until && rec.until > now()) throw new HttpError(429, 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
}
async function failAttempt(key) {
  await db().ref('loginAttempts/' + key).transaction((r) => {
    r = r || { n: 0 };
    r.n += 1;
    if (r.n >= 5) { r.until = now() + 10 * 60 * 1000; r.n = 0; }
    return r;
  });
}
const clearAttempts = (key) => db().ref('loginAttempts/' + key).remove();

async function needUser(ctx) {
  const p = A.verifyToken(A.tokenFromReq(ctx.req));
  if (!p || p.role !== 'user') throw new HttpError(401, 'Silakan masuk terlebih dahulu');
  const u = await get('users/' + p.uid);
  if (!u) throw new HttpError(401, 'Akun tidak ditemukan');
  if (u.banned) throw new HttpError(403, 'Akun kamu diblokir. Hubungi admin.');
  ctx.uid = p.uid; ctx.user = u;
}
function needAdmin(ctx) {
  const p = A.verifyToken(A.tokenFromReq(ctx.req));
  if (!p || p.role !== 'admin') throw new HttpError(401, 'Akses admin diperlukan');
}

function siteUrl(req) {
  if (process.env.SITE_URL && !process.env.SITE_URL.includes('GANTI')) return process.env.SITE_URL.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return 'https://' + host;
}

// ---------- PUBLIC ----------
R('GET', 'stats', async () => {
  await ensureServices();
  const s = (await get('stats')) || {};
  const svc = (await get('services')) || {};
  return { users: s.users || 0, orders: s.orders || 0, services: Object.values(svc).filter((x) => x.active).length };
});

R('GET', 'services', async () => {
  await ensureServices();
  const svc = (await get('services')) || {};
  const list = Object.entries(svc).filter(([, s]) => s.active).map(([id, s]) => publicService(id, s));
  list.sort((a, b) => a.cat.localeCompare(b.cat) || num(a.no) - num(b.no));
  return { services: list };
});

R('GET', 'news', async () => {
  const n = (await get('news')) || {};
  const list = Object.entries(n).map(([id, x]) => ({ id, ...x })).sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
  return { news: list };
});

R('POST', 'auth/register', async ({ body }) => {
  const name = str(body.name, 60), email = str(body.email, 120).toLowerCase(), password = String(body.password || '');
  if (name.length < 2) throw new HttpError(400, 'Nama minimal 2 karakter');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Email tidak valid');
  if (password.length < 8) throw new HttpError(400, 'Password minimal 8 karakter');
  const uid = db().ref('users').push().key;
  const claim = await db().ref('usersByEmail/' + emailKey(email)).transaction((c) => (c ? undefined : uid));
  if (!claim.committed) throw new HttpError(409, 'Email sudah terdaftar');
  const { salt, hash } = A.hashPassword(password);
  await db().ref('users/' + uid).set({ name, email, salt, hash, balance: 0, banned: false, createdAt: now() });
  await incStat('users');
  const token = A.signToken({ uid, role: 'user' }, 30 * 86400);
  return { token, user: { uid, name, email, balance: 0 } };
});

R('POST', 'auth/login', async ({ body, req }) => {
  const email = str(body.email, 120).toLowerCase(), password = String(body.password || '');
  const key = emailKey(email);
  await throttle(key);
  const uid = await get('usersByEmail/' + key);
  const u = uid ? await get('users/' + uid) : null;
  if (!u || !A.verifyPassword(password, u.salt, u.hash)) {
    await failAttempt(key);
    throw new HttpError(401, 'Email atau password salah');
  }
  if (u.banned) throw new HttpError(403, 'Akun kamu diblokir. Hubungi admin.');
  await clearAttempts(key);
  await db().ref('loginLogs/' + uid).push({ at: now(), ip: ctx_ip(req) });
  return { token: A.signToken({ uid, role: 'user' }, 30 * 86400), user: publicUser(uid, u) };
});
function ctx_ip(req) { return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'; }

R('POST', 'admin/login', async ({ body }) => {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new HttpError(503, 'ADMIN_EMAIL / ADMIN_PASSWORD belum diatur di environment');
  const email = str(body.email, 120).toLowerCase(), password = String(body.password || '');
  await throttle('__admin');
  const okEmail = A.safeEqual(email, process.env.ADMIN_EMAIL.toLowerCase());
  const okPass = A.safeEqual(password, process.env.ADMIN_PASSWORD);
  if (!(okEmail && okPass)) { await failAttempt('__admin'); throw new HttpError(401, 'Email atau password admin salah'); }
  await clearAttempts('__admin');
  return { token: A.signToken({ role: 'admin' }, 12 * 3600) };
});

// ---------- USER ----------
R('GET', 'me', async (ctx) => { await needUser(ctx); return { user: publicUser(ctx.uid, ctx.user) }; });

R('POST', 'me/update', async (ctx) => {
  await needUser(ctx);
  const b = ctx.body, updates = {};
  if (b.name !== undefined) {
    const name = str(b.name, 60);
    if (name.length < 2) throw new HttpError(400, 'Nama minimal 2 karakter');
    updates.name = name;
  }
  if (b.newPassword) {
    if (!A.verifyPassword(String(b.oldPassword || ''), ctx.user.salt, ctx.user.hash)) throw new HttpError(400, 'Password lama salah');
    if (String(b.newPassword).length < 8) throw new HttpError(400, 'Password baru minimal 8 karakter');
    const { salt, hash } = A.hashPassword(String(b.newPassword));
    updates.salt = salt; updates.hash = hash;
  }
  if (Object.keys(updates).length) await db().ref('users/' + ctx.uid).update(updates);
  return { ok: true };
});

R('POST', 'orders/create', async (ctx) => {
  await needUser(ctx);
  const s = await get('services/' + str(ctx.body.serviceId, 40));
  if (!s || !s.active) throw new HttpError(404, 'Layanan tidak ditemukan');
  const target = str(ctx.body.target, 500), qty = Math.floor(num(ctx.body.qty));
  if (target.length < 3) throw new HttpError(400, 'Target tidak valid');
  if (qty < s.min || qty > s.max) throw new HttpError(400, `Jumlah harus antara ${s.min} dan ${s.max}`);
  const total = Math.ceil((s.price * qty) / 1000);
  const bal = await changeBalance(ctx.uid, -total);
  if (bal === null) throw new HttpError(402, 'Saldo tidak cukup. Silakan deposit dulu.');
  const oid = db().ref('orders').push().key;
  const order = {
    uid: ctx.uid, userName: ctx.user.name, serviceId: str(ctx.body.serviceId, 40), serviceNo: s.no || null,
    serviceName: s.name, target, qty, total, status: 'Pending', createdAt: now()
  };
  await db().ref('orders/' + oid).set(order);
  await addMutation(ctx.uid, 'order', -total, 'Pesanan ' + oid.slice(-6));
  await incStat('orders');
  if (provider.configured() && s.providerServiceId) {
    try {
      const r = await provider.add(s.providerServiceId, target, qty);
      if (!r || !r.order) throw new Error((r && r.error) || 'Provider menolak pesanan');
      await db().ref('orders/' + oid).update({ providerOrderId: String(r.order), status: 'Proses' });
      order.status = 'Proses';
    } catch (e) {
      await changeBalance(ctx.uid, total, { allowNegative: true });
      await addMutation(ctx.uid, 'refund', total, 'Refund pesanan gagal ' + oid.slice(-6));
      await db().ref('orders/' + oid).update({ status: 'Error', note: String(e.message).slice(0, 200) });
      throw new HttpError(502, 'Pesanan gagal diproses provider, saldo dikembalikan.');
    }
  }
  return { order: { id: oid, ...order }, balance: bal };
});

R('GET', 'orders', async (ctx) => {
  await needUser(ctx);
  const snap = await db().ref('orders').orderByChild('uid').equalTo(ctx.uid).limitToLast(100).once('value');
  const list = Object.entries(snap.val() || {}).map(([id, o]) => ({ id, ...o })).sort((a, b) => b.createdAt - a.createdAt);
  return { orders: list };
});

R('GET', 'mutations', async (ctx) => {
  await needUser(ctx);
  const snap = await db().ref('mutations/' + ctx.uid).limitToLast(100).once('value');
  const list = Object.entries(snap.val() || {}).map(([id, m]) => ({ id, ...m })).sort((a, b) => b.createdAt - a.createdAt);
  return { mutations: list };
});

// ---------- DEPOSIT OTOMATIS (BuatQRIS) ----------
const pubDep = (id, d) => ({
  id, amount: d.amount, total_amount: d.total_amount, status: d.status, qr_url: d.qr_url, payment_url: d.payment_url,
  createdAt: d.createdAt, expiresAt: d.createdAt + 15 * 60 * 1000, paidAt: d.paidAt || null
});

async function creditDeposit(depId) {
  const claim = await db().ref('deposits/' + depId + '/credited').transaction((c) => (c ? undefined : true));
  if (!claim.committed) return false; // sudah pernah dikreditkan
  const d = await get('deposits/' + depId);
  await changeBalance(d.uid, d.amount, { allowNegative: true });
  await addMutation(d.uid, 'deposit', d.amount, 'Deposit QRIS ' + depId.slice(-6));
  await db().ref('deposits/' + depId).update({ status: 'success', paidAt: now() });
  await incStat('deposits');
  return true;
}

R('POST', 'deposit/create', async (ctx) => {
  await needUser(ctx);
  if (!bq.configured()) throw new HttpError(503, 'Deposit otomatis belum dikonfigurasi admin');
  const st = await settings();
  const amount = Math.floor(num(ctx.body.amount));
  if (amount < st.minDeposit) throw new HttpError(400, 'Minimal deposit Rp ' + st.minDeposit.toLocaleString('id-ID'));
  if (amount > st.maxDeposit) throw new HttpError(400, 'Maksimal deposit Rp ' + st.maxDeposit.toLocaleString('id-ID'));
  const depId = db().ref('deposits').push().key;
  const { status, data } = await bq.createQris({
    amount, description: `Deposit ${process.env.SITE_NAME || 'Sora Pedia'} ${depId.slice(-8)}`,
    callbackUrl: siteUrl(ctx.req) + '/api/webhook/buatqris'
  });
  const d = data && data.data;
  if (!data || !data.success || !d) throw new HttpError(502, (data && data.message) || `Gateway pembayaran error (${status})`);
  const dep = {
    uid: ctx.uid, userName: ctx.user.name, amount, total_amount: num(d.total_amount, amount), trx: String(d.transaction_id),
    qr_url: d.qr_url || null, payment_url: d.payment_url || null, status: 'pending', credited: false, createdAt: now()
  };
  await db().ref('deposits/' + depId).set(dep);
  await db().ref('depositsByTrx/' + dep.trx).set(depId);
  return { deposit: pubDep(depId, dep) };
});

R('POST', 'deposit/check', async (ctx) => {
  await needUser(ctx);
  const id = str(ctx.body.id, 60);
  let d = await get('deposits/' + id);
  if (!d || d.uid !== ctx.uid) throw new HttpError(404, 'Deposit tidak ditemukan');
  if (d.status === 'pending') {
    if (now() > d.createdAt + 20 * 60 * 1000) {
      await db().ref('deposits/' + id).update({ status: 'expired' });
      d.status = 'expired';
    } else if (bq.configured()) {
      const { status, data } = await bq.checkStatus(d.trx);
      if (status === 429) return { deposit: pubDep(id, d), throttled: true };
      const s = data && data.data && data.data.status;
      if (s === 'success') { await creditDeposit(id); d = await get('deposits/' + id); }
      else if (s === 'expired' || s === 'failed') { await db().ref('deposits/' + id).update({ status: s }); d.status = s; }
    }
  }
  const me = await get('users/' + ctx.uid + '/balance');
  return { deposit: pubDep(id, d), balance: me || 0 };
});

R('GET', 'deposits', async (ctx) => {
  await needUser(ctx);
  const snap = await db().ref('deposits').orderByChild('uid').equalTo(ctx.uid).limitToLast(50).once('value');
  const list = Object.entries(snap.val() || {}).map(([id, d]) => pubDep(id, d)).sort((a, b) => b.createdAt - a.createdAt);
  return { deposits: list };
});

// Webhook dari BuatQRIS (ditandatangani HMAC-SHA256). Atur callback URL: https://DOMAIN/api/webhook/buatqris
R('POST', 'webhook/buatqris', async ({ raw, req, body }) => {
  if (!process.env.BUATQRIS_WEBHOOK_SECRET) throw new HttpError(503, 'BUATQRIS_WEBHOOK_SECRET belum diatur');
  if (!bq.verifySignature(raw, req.headers['x-buatqris-signature'])) throw new HttpError(401, 'Signature tidak valid');
  const ev = body.event, trx = String(body.transaction_id || '');
  if (!trx || !ev || !ev.startsWith('payment.')) return { ok: true };
  const depId = await get('depositsByTrx/' + trx);
  if (!depId) return { ok: true, ignored: 'transaksi tidak dikenal' };
  const d = await get('deposits/' + depId);
  if (!d) return { ok: true };
  if (ev === 'payment.success') {
    if (body.is_test && process.env.BUATQRIS_TEST !== '1') return { ok: true, ignored: 'transaksi test' };
    if (num(body.amount) !== d.amount) return { ok: true, ignored: 'nominal tidak cocok' };
    await creditDeposit(depId);
  } else if (d.status === 'pending') {
    await db().ref('deposits/' + depId).update({ status: ev === 'payment.expired' ? 'expired' : 'failed' });
  }
  return { ok: true };
});

// ---------- TIKET ----------
R('POST', 'tickets/create', async (ctx) => {
  await needUser(ctx);
  const subject = str(ctx.body.subject, 100), message = str(ctx.body.message, 1500);
  if (subject.length < 3 || message.length < 5) throw new HttpError(400, 'Isi subjek dan pesan dengan lengkap');
  const ref = db().ref('tickets').push();
  await ref.set({ uid: ctx.uid, userName: ctx.user.name, subject, message, status: 'Open', createdAt: now() });
  return { id: ref.key };
});
R('GET', 'tickets', async (ctx) => {
  await needUser(ctx);
  const snap = await db().ref('tickets').orderByChild('uid').equalTo(ctx.uid).limitToLast(50).once('value');
  return { tickets: Object.entries(snap.val() || {}).map(([id, t]) => ({ id, ...t })).sort((a, b) => b.createdAt - a.createdAt) };
});

// ---------- ADMIN ----------
const listOf = (obj) => Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));

R('GET', 'admin/overview', async (ctx) => {
  needAdmin(ctx);
  const [users, orders, deposits, stats] = await Promise.all([get('users'), get('orders'), get('deposits'), get('stats')]);
  const o = listOf(orders), dps = listOf(deposits), us = listOf(users);
  const revenue = o.filter((x) => x.status !== 'Error' && x.status !== 'Dibatalkan').reduce((a, x) => a + (x.total || 0), 0);
  const depTotal = dps.filter((x) => x.status === 'success').reduce((a, x) => a + (x.amount || 0), 0);
  return {
    users: us.length, orders: o.length, pendingOrders: o.filter((x) => x.status === 'Pending' || x.status === 'Proses').length,
    revenue, depositTotal: depTotal, userBalance: us.reduce((a, u) => a + (u.balance || 0), 0), stats: stats || {},
    provider: provider.configured(), payment: bq.configured(), sandbox: process.env.BUATQRIS_TEST === '1'
  };
});

R('GET', 'admin/users', async (ctx) => {
  needAdmin(ctx);
  const users = listOf(await get('users')).map(({ salt, hash, ...u }) => u).sort((a, b) => b.createdAt - a.createdAt);
  return { users };
});
R('POST', 'admin/users/update', async (ctx) => {
  needAdmin(ctx);
  const uid = str(ctx.body.uid, 60);
  const u = await get('users/' + uid);
  if (!u) throw new HttpError(404, 'Pengguna tidak ditemukan');
  if (ctx.body.banned !== undefined) await db().ref('users/' + uid).update({ banned: !!ctx.body.banned });
  const delta = Math.trunc(num(ctx.body.balanceDelta));
  if (delta) {
    const b = await changeBalance(uid, delta);
    if (b === null) throw new HttpError(400, 'Saldo tidak boleh negatif');
    await addMutation(uid, 'admin', delta, str(ctx.body.note, 100) || 'Penyesuaian oleh admin');
  }
  return { ok: true };
});

R('GET', 'admin/orders', async (ctx) => {
  needAdmin(ctx);
  const snap = await db().ref('orders').orderByChild('createdAt').limitToLast(300).once('value');
  return { orders: listOf(snap.val()).sort((a, b) => b.createdAt - a.createdAt) };
});
R('POST', 'admin/orders/update', async (ctx) => {
  needAdmin(ctx);
  const id = str(ctx.body.id, 60), status = str(ctx.body.status, 20);
  if (!['Pending', 'Proses', 'Selesai', 'Partial', 'Error', 'Dibatalkan'].includes(status)) throw new HttpError(400, 'Status tidak valid');
  const o = await get('orders/' + id);
  if (!o) throw new HttpError(404, 'Pesanan tidak ditemukan');
  const refundable = ['Error', 'Dibatalkan'];
  if (refundable.includes(status) && !refundable.includes(o.status) && !o.refunded) {
    await changeBalance(o.uid, o.total, { allowNegative: true });
    await addMutation(o.uid, 'refund', o.total, 'Refund pesanan ' + id.slice(-6));
    await db().ref('orders/' + id).update({ refunded: true });
  }
  await db().ref('orders/' + id).update({ status });
  return { ok: true };
});
R('POST', 'admin/orders/refresh', async (ctx) => {
  needAdmin(ctx);
  if (!provider.configured()) throw new HttpError(503, 'Provider belum dikonfigurasi');
  const snap = await db().ref('orders').orderByChild('createdAt').limitToLast(100).once('value');
  const map = { Pending: 'Pending', 'In progress': 'Proses', Processing: 'Proses', Completed: 'Selesai', Partial: 'Partial', Canceled: 'Dibatalkan' };
  let updated = 0;
  for (const [id, o] of Object.entries(snap.val() || {})) {
    if (!o.providerOrderId || !['Pending', 'Proses'].includes(o.status)) continue;
    try {
      const r = await provider.status(o.providerOrderId);
      const ns = map[r.status];
      if (ns && ns !== o.status) {
        await db().ref('orders/' + id).update({ status: ns });
        if (ns === 'Dibatalkan' && !o.refunded) {
          await changeBalance(o.uid, o.total, { allowNegative: true });
          await addMutation(o.uid, 'refund', o.total, 'Refund pesanan ' + id.slice(-6));
          await db().ref('orders/' + id).update({ refunded: true });
        }
        updated++;
      }
    } catch (e) { /* lanjut ke pesanan berikutnya */ }
  }
  return { updated };
});

R('GET', 'admin/deposits', async (ctx) => {
  needAdmin(ctx);
  const snap = await db().ref('deposits').orderByChild('createdAt').limitToLast(300).once('value');
  return { deposits: listOf(snap.val()).sort((a, b) => b.createdAt - a.createdAt) };
});

R('GET', 'admin/services', async (ctx) => {
  needAdmin(ctx);
  await ensureServices();
  return { services: listOf(await get('services')).sort((a, b) => String(a.cat).localeCompare(String(b.cat)) || num(a.no) - num(b.no)) };
});
R('POST', 'admin/services/save', async (ctx) => {
  needAdmin(ctx);
  const b = ctx.body;
  const name = str(b.name, 200), cat = str(b.cat, 40);
  if (!name || !cat) throw new HttpError(400, 'Nama dan kategori wajib diisi');
  const id = str(b.id, 40) || String(await nextServiceNo());
  const data = {
    no: num(b.no, num(id)), cat, name, price: Math.max(0, num(b.price)), min: Math.max(1, Math.floor(num(b.min, 1))),
    max: Math.max(1, Math.floor(num(b.max, 1000))), providerServiceId: str(b.providerServiceId, 40) || null, active: b.active !== false
  };
  await db().ref('services/' + id).set(data);
  return { id };
});
async function nextServiceNo() {
  const svc = (await get('services')) || {};
  return Math.max(0, ...Object.values(svc).map((s) => num(s.no))) + 1;
}
R('POST', 'admin/services/delete', async (ctx) => {
  needAdmin(ctx);
  await db().ref('services/' + str(ctx.body.id, 40)).remove();
  return { ok: true };
});
R('POST', 'admin/services/sync', async (ctx) => {
  needAdmin(ctx);
  if (!provider.configured()) throw new HttpError(503, 'PROVIDER_API_URL / PROVIDER_API_KEY belum diatur');
  const st = await settings();
  const list = await provider.services();
  if (!Array.isArray(list)) throw new HttpError(502, (list && list.error) || 'Provider tidak mengembalikan daftar layanan');
  const updates = {};
  for (const p of list.slice(0, 3000)) {
    const price = Math.ceil(num(p.rate) * st.multiplier * (1 + st.markup / 100));
    updates['p' + p.service] = {
      no: num(p.service), cat: str(p.category, 40) || 'Lainnya', name: str(p.name, 200), price,
      min: num(p.min, 1), max: num(p.max, 1000), providerServiceId: String(p.service), active: true
    };
  }
  await db().ref('services').update(updates);
  return { imported: Object.keys(updates).length };
});

R('GET', 'admin/settings', async (ctx) => { needAdmin(ctx); return { settings: await settings() }; });
R('POST', 'admin/settings', async (ctx) => {
  needAdmin(ctx);
  const b = ctx.body;
  await db().ref('settings').update({
    minDeposit: Math.max(1000, num(b.minDeposit, 10000)), maxDeposit: Math.max(1000, num(b.maxDeposit, 5000000)),
    markup: Math.max(0, num(b.markup, 20)), multiplier: Math.max(0.0001, num(b.multiplier, 1))
  });
  return { ok: true };
});

R('POST', 'admin/news/save', async (ctx) => {
  needAdmin(ctx);
  const title = str(ctx.body.title, 120), text = str(ctx.body.body, 2000);
  if (!title || !text) throw new HttpError(400, 'Judul dan isi wajib diisi');
  await db().ref('news').push({ title, body: text, createdAt: now() });
  return { ok: true };
});
R('POST', 'admin/news/delete', async (ctx) => { needAdmin(ctx); await db().ref('news/' + str(ctx.body.id, 60)).remove(); return { ok: true }; });

R('GET', 'admin/tickets', async (ctx) => {
  needAdmin(ctx);
  const snap = await db().ref('tickets').orderByChild('createdAt').limitToLast(200).once('value');
  return { tickets: listOf(snap.val()).sort((a, b) => b.createdAt - a.createdAt) };
});
R('POST', 'admin/tickets/reply', async (ctx) => {
  needAdmin(ctx);
  const reply = str(ctx.body.reply, 1500);
  if (!reply) throw new HttpError(400, 'Balasan kosong');
  await db().ref('tickets/' + str(ctx.body.id, 60)).update({ reply, status: 'Dibalas', repliedAt: now() });
  return { ok: true };
});

module.exports = routes;
                        

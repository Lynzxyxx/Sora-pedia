// Test end-to-end createOrder memakai fake Realtime Database + fake provider.
// Dijalankan dengan: node --experimental-test-module-mocks --test test/
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createFakeDb } from './fake-rtdb.mjs';

process.env.SESSION_SECRET = 'secret-untuk-test-minimal-32-karakter';

const url = (p) => pathToFileURL(new URL(p, import.meta.url).pathname).href;

let db = createFakeDb({});
let providerImpl = { configured: () => false, add: async () => ({}), status: async () => ({}), services: async () => [] };

mock.module(url('../lib/firebase.js'), { namedExports: { db: () => db } });
mock.module(url('../lib/provider.js'), {
  namedExports: {
    configured: () => providerImpl.configured(),
    add: (...a) => providerImpl.add(...a),
    status: (...a) => providerImpl.status(...a),
    services: (...a) => providerImpl.services(...a)
  }
});

const { createOrder } = await import('../lib/handlers.js');
const A = await import('../lib/auth.js');

// layanan: harga 1.000 per 1000 unit -> qty 10.000 = Rp 10.000
const SERVICE = { no: 7, cat: 'TikTok', name: 'TikTok Views', price: 1000, min: 100, max: 100000, active: true };

function setup(balance, { service = SERVICE, provider } = {}) {
  db = createFakeDb({
    users: { u1: { name: 'Budi', email: 'budi@mail.com', balance, banned: false, createdAt: 1 } },
    services: { s1: service }
  });
  providerImpl = provider || { configured: () => false, add: async () => ({}), status: async () => ({}), services: async () => [] };
}

const ctx = (body) => ({
  req: { headers: { authorization: 'Bearer ' + A.signToken({ role: 'user', uid: 'u1' }, 3600) } },
  body
});

const order = (qty = 10000) => createOrder(ctx({ serviceId: 's1', target: 'https://tiktok.com/@budi', qty }));
const balance = () => db.__read('users/u1/balance');
const orders = () => Object.values(db.__read('orders') || {});

test('Test 1 - saldo cukup: order berhasil, saldo 50.000 -> 40.000', async () => {
  setup(50000);
  const r = await order();
  assert.equal(r.balance, 40000);
  assert.equal(r.order.total, 10000);
  assert.equal(r.order.status, 'Pending');
  assert.equal(balance(), 40000);
  assert.equal(orders().length, 1);
});

test('Test 2 - saldo pas: 10.000 -> 0, order tetap berhasil', async () => {
  setup(10000);
  const r = await order();
  assert.equal(r.balance, 0);
  assert.equal(balance(), 0);
});

test('Test 3 - saldo kurang: ditolak 402 INSUFFICIENT_BALANCE, saldo utuh', async () => {
  setup(5000);
  await assert.rejects(order(), (e) => e.status === 402 && e.code === 'INSUFFICIENT_BALANCE');
  assert.equal(balance(), 5000);
  assert.equal(orders().length, 0);
});

test('Test 4 - provider gagal: 502 PROVIDER_ERROR, saldo di-refund penuh', async () => {
  setup(50000, {
    service: { ...SERVICE, providerServiceId: '1234' },
    provider: { configured: () => true, add: async () => ({ error: 'Not enough funds on balance' }) }
  });
  await assert.rejects(order(), (e) => e.status === 502 && e.code === 'PROVIDER_ERROR');
  assert.equal(balance(), 50000, 'saldo kembali utuh');
  const o = orders()[0];
  assert.equal(o.status, 'Error');
  assert.equal(o.refunded, true, 'ditandai refunded supaya tidak dobel refund');
});

test('Test 4b - provider error TIDAK dilaporkan sebagai saldo tidak cukup', async () => {
  setup(50000, {
    service: { ...SERVICE, providerServiceId: '1234' },
    provider: { configured: () => true, add: async () => { throw new Error('ETIMEDOUT'); } }
  });
  await assert.rejects(order(), (e) => e.status === 502 && !/Saldo tidak cukup/i.test(e.message));
  assert.equal(balance(), 50000);
});

test('Test 5 - provider sukses: status Proses, saldo 40.000, providerOrderId tersimpan', async () => {
  setup(50000, {
    service: { ...SERVICE, providerServiceId: '1234' },
    provider: { configured: () => true, add: async () => ({ order: 987654 }) }
  });
  const r = await order();
  assert.equal(r.order.status, 'Proses');
  assert.equal(balance(), 40000);
  assert.equal(orders()[0].providerOrderId, '987654');
});

test('Test 5b - parameter yang dikirim ke provider benar', async () => {
  let got = null;
  setup(50000, {
    service: { ...SERVICE, providerServiceId: '1234' },
    provider: { configured: () => true, add: async (...a) => { got = a; return { order: 1 }; } }
  });
  await order(5000);
  assert.deepEqual(got, ['1234', 'https://tiktok.com/@budi', 5000]);
});

test('Test 6 - dua order beruntun: dua kali potong, tidak pernah negatif', async () => {
  setup(15000);
  await order();                       // -10.000 -> 5.000
  await assert.rejects(order(), (e) => e.status === 402);
  assert.equal(balance(), 5000);
  assert.equal(orders().length, 1, 'order kedua tidak dibuat');
});

test('Test 6b - race condition: order lain commit di tengah transaksi', async () => {
  setup(20000);
  db.__hooks.beforeCommit = () => db.__write('users/u1/balance', 5000);
  await assert.rejects(order(), (e) => e.status === 402);
  assert.equal(balance(), 5000);
});

test('Test 7a - saldo tersimpan sebagai string tetap bisa order', async () => {
  setup('50000');
  const r = await order();
  assert.strictEqual(r.balance, 40000);
});

test('Test 7b - saldo malformed: 500 MALFORMED_BALANCE, bukan 402', async () => {
  setup({ rusak: true });
  await assert.rejects(order(), (e) => e.status === 500 && e.code === 'MALFORMED_BALANCE');
});

test('Test 7c - saldo negatif: order ditolak', async () => {
  setup(-5000);
  await assert.rejects(order(), (e) => e.status === 402);
  assert.equal(balance(), -5000);
});

test('qty 0 dan negatif ditolak (dulu bisa lolos & menambah saldo)', async () => {
  setup(50000, { service: { ...SERVICE, min: undefined, max: undefined } });
  await assert.rejects(order(0), (e) => e.status === 400 && e.code === 'INVALID_QTY');
  await assert.rejects(order(-10000), (e) => e.status === 400 && e.code === 'INVALID_QTY');
  assert.equal(balance(), 50000, 'saldo tidak bertambah dari qty negatif');
});

test('harga layanan 0/NaN ditolak sebelum order dibuat', async () => {
  setup(50000, { service: { ...SERVICE, price: 0 } });
  await assert.rejects(order(), (e) => e.status === 500 && e.code === 'SERVICE_PRICE_INVALID');
  setup(50000, { service: { ...SERVICE, price: 'gratis' } });
  await assert.rejects(order(), (e) => e.code === 'SERVICE_PRICE_INVALID');
  assert.equal(balance(), 50000);
});

test('qty di luar min/max layanan ditolak', async () => {
  setup(50000);
  await assert.rejects(order(50), (e) => e.status === 400 && e.code === 'INVALID_QTY');
  await assert.rejects(order(200000), (e) => e.status === 400);
});

test('layanan tidak aktif / tidak ada -> 404', async () => {
  setup(50000, { service: { ...SERVICE, active: false } });
  await assert.rejects(order(), (e) => e.status === 404 && e.code === 'SERVICE_NOT_FOUND');
});

test('order gagal disimpan -> saldo dikembalikan', async () => {
  setup(50000);
  db.__hooks.failWrites = true;
  await assert.rejects(order(), (e) => e.status === 500 && e.code === 'ORDER_CREATE_FAILED');
  db.__hooks.failWrites = false;
  assert.equal(balance(), 50000, 'saldo dikembalikan');
});

test('total dihitung server, harga dari klien diabaikan', async () => {
  setup(50000);
  const r = await createOrder(ctx({ serviceId: 's1', target: 'https://tiktok.com/@budi', qty: '10000', total: 1, price: 1 }));
  assert.equal(r.order.total, 10000);
});

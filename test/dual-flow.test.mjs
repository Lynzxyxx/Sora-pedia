// Truth table Provider vs Manual (audit dual-flow) — dibuktikan lewat test,
// bukan asumsi. Menegaskan: satu-satunya kondisi routing adalah
// `provider.configured() && s.providerServiceId`, dan itu dievaluasi SETELAH
// balance sukses didebit — jadi tidak mungkin memengaruhi keputusan 402.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createFakeDb } from './fake-rtdb.mjs';

process.env.SESSION_SECRET = 'secret-untuk-test-minimal-32-karakter';
const url = (p) => pathToFileURL(new URL(p, import.meta.url).pathname).href;

let db = createFakeDb({});
let providerImpl = { configured: () => false, add: async () => ({ order: 1 }), status: async () => ({}), services: async () => [] };

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

const BASE = { no: 7, cat: 'TikTok', name: 'TikTok Views', price: 1000, min: 100, max: 100000, active: true };

function setup(balance, service, provider) {
  db = createFakeDb({
    users: { u1: { name: 'Budi', email: 'b@mail.com', balance, banned: false, createdAt: 1 } },
    services: { s1: service }
  });
  providerImpl = provider;
}

const ctx = (body) => ({ req: { headers: { authorization: 'Bearer ' + A.signToken({ role: 'user', uid: 'u1' }, 3600) } }, body });
const order = (qty = 10000) => createOrder(ctx({ serviceId: 's1', target: 'https://tiktok.com/@budi', qty }));
const balance = () => db.__read('users/u1/balance');

const PROVIDER_ON = { configured: () => true, add: async () => ({ order: 999 }) };
const PROVIDER_OFF = { configured: () => false, add: async () => { throw new Error('tidak boleh dipanggil'); } };

test('TRUTH TABLE: Manual (tanpa providerServiceId) + provider OFF → sufficient balance → sukses, provider tidak dipanggil', async () => {
  setup(50000, { ...BASE, providerServiceId: null }, PROVIDER_OFF);
  const r = await order();
  assert.equal(r.order.status, 'Pending');
  assert.equal(balance(), 40000);
});

test('TRUTH TABLE: Manual (tanpa providerServiceId) + provider ON → tetap manual, provider tidak dipanggil', async () => {
  let called = false;
  setup(50000, { ...BASE, providerServiceId: null }, { configured: () => true, add: async () => { called = true; return { order: 1 }; } });
  const r = await order();
  assert.equal(r.order.status, 'Pending');
  assert.equal(called, false, 'provider tidak boleh dipanggil untuk service tanpa providerServiceId');
  assert.equal(balance(), 40000);
});

test('TRUTH TABLE: Provider (ada providerServiceId) + provider OFF → jadi manual (bukan error)', async () => {
  setup(50000, { ...BASE, providerServiceId: '1234' }, PROVIDER_OFF);
  const r = await order();
  assert.equal(r.order.status, 'Pending');
  assert.equal(balance(), 40000);
});

test('TRUTH TABLE: Provider (ada providerServiceId) + provider ON → provider dipanggil', async () => {
  setup(50000, { ...BASE, providerServiceId: '1234' }, PROVIDER_ON);
  const r = await order();
  assert.equal(r.order.status, 'Proses');
  assert.equal(balance(), 40000);
});

test('TRUTH TABLE: providerServiceId="" (empty string) → dianggap manual meski provider ON', async () => {
  let called = false;
  setup(50000, { ...BASE, providerServiceId: '' }, { configured: () => true, add: async () => { called = true; return { order: 1 }; } });
  const r = await order();
  assert.equal(r.order.status, 'Pending');
  assert.equal(called, false);
});

test('TRUTH TABLE: providerServiceId="0" (string) → truthy di JS, provider TETAP dipanggil (catatan edge-case)', async () => {
  let calledWith = null;
  setup(50000, { ...BASE, providerServiceId: '0' }, { configured: () => true, add: async (svc) => { calledWith = svc; return { order: 1 }; } });
  const r = await order();
  assert.equal(r.order.status, 'Proses');
  assert.equal(calledWith, '0');
});

test('SALDO KURANG identik untuk Manual maupun Provider — balance dicek SEBELUM branching', async () => {
  setup(5000, { ...BASE, providerServiceId: null }, PROVIDER_OFF);
  await assert.rejects(order(), (e) => e.status === 402 && e.code === 'INSUFFICIENT_BALANCE');
  assert.equal(balance(), 5000);

  let called = false;
  setup(5000, { ...BASE, providerServiceId: '1234' }, { configured: () => true, add: async () => { called = true; return { order: 1 }; } });
  await assert.rejects(order(), (e) => e.status === 402 && e.code === 'INSUFFICIENT_BALANCE');
  assert.equal(balance(), 5000);
  assert.equal(called, false, 'provider tidak boleh sempat dipanggil kalau saldo sudah ditolak duluan');
});

test('PROVIDER GAGAL setelah debit → 502 PROVIDER_ERROR (bukan 402), refund penuh', async () => {
  setup(50000, { ...BASE, providerServiceId: '1234' }, { configured: () => true, add: async () => ({ error: 'Insufficient funds on provider side' }) });
  await assert.rejects(order(), (e) => e.status === 502 && e.code === 'PROVIDER_ERROR' && !/402|Saldo tidak cukup/i.test(e.message));
  assert.equal(balance(), 50000, 'saldo dikembalikan penuh, bukti provider error tidak menyisakan 402');
});

test('ORDER_DEBUG: field "flow" pada error 402 identik dgn selectedFlow di ORDER_ROUTING_DEBUG', async () => {
  process.env.ORDER_DEBUG = '1';
  setup(5000, { ...BASE, providerServiceId: '1234' }, PROVIDER_ON);
  try {
    await order();
    assert.fail('harus melempar 402');
  } catch (e) {
    assert.equal(e.debug.flow, 'provider');
    assert.equal(e.debug.failureReason, 'INSUFFICIENT_BALANCE');
  } finally {
    delete process.env.ORDER_DEBUG;
  }
});

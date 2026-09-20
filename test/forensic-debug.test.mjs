// Bukti untuk forensic debugging round 2:
//  - default (ORDER_DEBUG unset) TIDAK PERNAH mengisi HttpError.debug — jadi
//    lib/route.js (yang meneruskan e.debug ke body JSON apa adanya) juga
//    tidak akan pernah mengirim field debug ke klien secara default.
//  - saat ORDER_DEBUG=1, HttpError.debug berisi nilai SEBENARNYA yang
//    dipakai server (uid, path, rawBalance+typeof, serverPrice, serverTotal)
//    — tidak pernah field bertanda kredensial.
// Diuji langsung pada createOrder() (bukan lewat createRoute/next/server)
// karena 'next/server' hanya resolvable di dalam runtime build Next.js;
// pemetaan HttpError -> body JSON di lib/route.js sendiri adalah pass-through
// sederhana (`debug: e.debug`) yang sudah tercakup lewat pembacaan kode.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { pathToFileURL } from 'node:url';
import { createFakeDb } from './fake-rtdb.mjs';

process.env.SESSION_SECRET = 'secret-untuk-test-minimal-32-karakter';

const url = (p) => pathToFileURL(new URL(p, import.meta.url).pathname).href;

let db = createFakeDb({});
mock.module(url('../lib/firebase.js'), { namedExports: { db: () => db } });
mock.module(url('../lib/provider.js'), {
  namedExports: { configured: () => false, add: async () => ({}), status: async () => ({}), services: async () => [] }
});

const { createOrder } = await import('../lib/handlers.js');
const A = await import('../lib/auth.js');

const SERVICE = { no: 7, cat: 'TikTok', name: 'TikTok Views', price: 1000, min: 100, max: 100000, active: true };

function setup(balance) {
  db = createFakeDb({
    users: { u1: { name: 'Budi', email: 'budi@mail.com', balance, banned: false, createdAt: 1 } },
    services: { s1: SERVICE }
  });
}

const ctx = (body) => ({ req: { headers: { authorization: 'Bearer ' + A.signToken({ role: 'user', uid: 'u1' }, 3600) } }, body });
const order = (qty = 10000) => createOrder(ctx({ serviceId: 's1', target: 'https://tiktok.com/@budi', qty }));

test('default (ORDER_DEBUG tidak diset): HttpError 402 TIDAK punya .debug', async () => {
  delete process.env.ORDER_DEBUG;
  setup(5000);
  await assert.rejects(order(), (e) => e.status === 402 && e.debug === undefined);
});

test('ORDER_DEBUG=1: HttpError 402 berisi nilai server sebenarnya (uid, path, rawBalance, total)', async () => {
  process.env.ORDER_DEBUG = '1';
  setup(5000);
  try {
    await order();
    assert.fail('seharusnya melempar HttpError 402');
  } catch (e) {
    assert.equal(e.status, 402);
    assert.equal(e.code, 'INSUFFICIENT_BALANCE');
    assert.deepEqual(
      {
        userId: e.debug.userId, balancePath: e.debug.balancePath,
        rawBalance: e.debug.rawBalance, balanceType: e.debug.balanceType,
        normalizedBalance: e.debug.normalizedBalance, serverPrice: e.debug.serverPrice,
        serverTotal: e.debug.serverTotal, failureReason: e.debug.failureReason, httpStatus: e.debug.httpStatus
      },
      {
        userId: 'u1', balancePath: 'users/u1/balance',
        rawBalance: 5000, balanceType: 'number',
        normalizedBalance: 5000, serverPrice: 1000,
        serverTotal: 10000, failureReason: 'INSUFFICIENT_BALANCE', httpStatus: 402
      }
    );
  } finally {
    delete process.env.ORDER_DEBUG;
  }
});

test('ORDER_DEBUG=1: saldo cukup -> order sukses, tidak ada error/debug sama sekali', async () => {
  process.env.ORDER_DEBUG = '1';
  setup(50000);
  const r = await order();
  assert.equal(r.balance, 40000);
  delete process.env.ORDER_DEBUG;
});

test('debug payload tidak pernah mengandung field bertanda kredensial', async () => {
  process.env.ORDER_DEBUG = '1';
  setup(5000);
  try {
    await order();
    assert.fail('seharusnya melempar');
  } catch (e) {
    const forbidden = /key|secret|token|password|salt|hash|credential/i;
    for (const k of Object.keys(e.debug)) assert.doesNotMatch(k, forbidden, `field debug "${k}" tampak seperti kredensial`);
    assert.doesNotMatch(JSON.stringify(e.debug), forbidden, 'nilai debug tidak boleh menyerupai kredensial');
  } finally {
    delete process.env.ORDER_DEBUG;
  }
});

test('ORDER_DEBUG=1: saldo malformed -> 500 MALFORMED_BALANCE dengan rawBalance apa adanya', async () => {
  process.env.ORDER_DEBUG = '1';
  setup({ oops: true });
  try {
    await order();
    assert.fail('seharusnya melempar');
  } catch (e) {
    assert.equal(e.status, 500);
    assert.equal(e.code, 'MALFORMED_BALANCE');
    assert.deepEqual(e.debug.rawBalance, { oops: true });
    assert.equal(e.debug.balanceType, 'object');
  } finally {
    delete process.env.ORDER_DEBUG;
  }
});

test('uid konsisten sepanjang flow (needUser -> order.uid)', async () => {
  process.env.ORDER_DEBUG = '1';
  setup(50000);
  const r = await order();
  assert.equal(r.order.uid, 'u1');
  delete process.env.ORDER_DEBUG;
});

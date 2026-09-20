import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeDb } from './fake-rtdb.mjs';
import { changeBalance } from '../lib/balance.js';

const dbWith = (balance) => createFakeDb({ users: { u1: { name: 'Budi', balance } } });

test('BUKTI ROOT CAUSE: updater lama abort saat cache dingin walau saldo cukup', async () => {
  const db = dbWith(50000);
  // implementasi lama (sebelum fix) - abort dengan `return;`
  const legacy = await db.ref('users/u1/balance').transaction((b) => {
    b = b || 0;
    if (b + -10000 < 0) return; // abort pada panggilan pertama (b = null -> 0)
    return b + -10000;
  });
  assert.equal(legacy.committed, false, 'transaksi lama dibatalkan meski saldo 50.000');
  assert.equal(db.__read('users/u1/balance'), 50000, 'saldo tidak berubah, order ditolak keliru');
});

test('saldo cukup: 50.000 - 10.000 = 40.000', async () => {
  const db = dbWith(50000);
  const r = await changeBalance('u1', -10000, { database: db });
  assert.deepEqual([r.success, r.reason, r.balance, r.before], [true, 'OK', 40000, 50000]);
  assert.equal(db.__read('users/u1/balance'), 40000);
});

test('saldo pas: 10.000 - 10.000 = 0', async () => {
  const db = dbWith(10000);
  const r = await changeBalance('u1', -10000, { database: db });
  assert.equal(r.success, true);
  assert.equal(r.balance, 0);
});

test('saldo kurang: ditolak dengan reason INSUFFICIENT_BALANCE dan saldo utuh', async () => {
  const db = dbWith(5000);
  const r = await changeBalance('u1', -10000, { database: db });
  assert.equal(r.success, false);
  assert.equal(r.reason, 'INSUFFICIENT_BALANCE');
  assert.equal(db.__read('users/u1/balance'), 5000);
});

test('saldo string "50000" dinormalkan jadi number, bukan konkatenasi', async () => {
  const db = dbWith('50000');
  const r = await changeBalance('u1', -10000, { database: db });
  assert.equal(r.success, true);
  assert.strictEqual(db.__read('users/u1/balance'), 40000);
});

test('saldo null/undefined diperlakukan 0, ditolak sebagai saldo kurang (bukan error)', async () => {
  const db = createFakeDb({ users: { u1: { name: 'Budi' } } });
  const r = await changeBalance('u1', -10000, { database: db });
  assert.equal(r.reason, 'INSUFFICIENT_BALANCE');
});

test('saldo malformed (bukan angka) dilaporkan MALFORMED_BALANCE, bukan saldo kurang', async () => {
  const db = dbWith({ oops: true });
  const r = await changeBalance('u1', -10000, { database: db });
  assert.equal(r.reason, 'MALFORMED_BALANCE');
  assert.deepEqual(db.__read('users/u1/balance'), { oops: true }, 'nilai asli tidak dirusak');
});

test('delta NaN ditolak sebelum menyentuh database', async () => {
  const db = dbWith(50000);
  const r = await changeBalance('u1', NaN, { database: db });
  assert.equal(r.reason, 'DATABASE_ERROR');
  assert.equal(db.__read('users/u1/balance'), 50000);
});

test('error database dilaporkan DATABASE_ERROR, bukan INSUFFICIENT_BALANCE', async () => {
  const db = dbWith(50000);
  db.ref = () => ({ transaction: async () => { throw new Error('permission denied'); } });
  const r = await changeBalance('u1', -10000, { database: db });
  assert.equal(r.reason, 'DATABASE_ERROR');
});

test('race condition: dua order bersamaan tidak membuat saldo negatif', async () => {
  const db = dbWith(20000);
  // order B commit duluan tepat sebelum order A menulis
  db.__hooks.beforeCommit = () => db.__write('users/u1/balance', 5000);
  const a = await changeBalance('u1', -15000, { database: db });
  assert.equal(a.success, false);
  assert.equal(a.reason, 'INSUFFICIENT_BALANCE');
  assert.equal(db.__read('users/u1/balance'), 5000, 'saldo tidak pernah negatif');
});

test('refund (allowNegative) selalu berhasil menambah saldo', async () => {
  const db = dbWith(0);
  const r = await changeBalance('u1', 10000, { database: db, allowNegative: true });
  assert.equal(r.success, true);
  assert.equal(db.__read('users/u1/balance'), 10000);
});

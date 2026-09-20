// Mutasi saldo terpusat.
//
// Catatan penting soal Firebase Realtime Database transaction:
// fungsi update dipanggil PERTAMA KALI dengan nilai dari cache lokal, yang pada
// serverless (tiap request instance baru) hampir selalu `null` — bukan nilai asli
// di server. Kalau fungsi itu mengembalikan `undefined` pada panggilan pertama,
// SDK menganggapnya "abort" dan transaksi langsung dibatalkan TANPA pernah
// mengambil data server. Karena itu di sini kita TIDAK PERNAH abort: saat saldo
// dianggap kurang, kita mengembalikan nilai yang sama (no-op commit) sehingga SDK
// tetap mengambil data server, menjalankan ulang fungsi dengan saldo asli, dan
// keputusan akhir diambil dari nilai server yang benar.
import { db } from './firebase.js';

export const BALANCE_OK = 'OK';
export const INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE';
export const MALFORMED_BALANCE = 'MALFORMED_BALANCE';
export const DATABASE_ERROR = 'DATABASE_ERROR';

// null/undefined dianggap 0 (akun baru). String angka ("50000") dinormalkan ke
// number supaya tidak terjadi konkatenasi string saat dijumlahkan.
function toAmount(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return NaN;
}

const fail = (reason, extra = {}) => ({ success: false, reason, balance: null, before: null, raw: null, rawType: null, attempts: 0, ...extra });

/**
 * @returns {{success:boolean, reason:string, balance:number|null, before:number|null,
 *   raw:*, rawType:string, attempts:number, message?:string}}
 *
 * `raw`/`rawType` = nilai APA ADANYA (dan typeof-nya) yang dibaca dari
 * database pada percobaan transaksi TERAKHIR sebelum diputuskan — dipakai
 * murni untuk forensic logging (lib/debug.js), tidak memengaruhi keputusan.
 * `attempts` = berapa kali Firebase memanggil ulang updater (>1 berarti
 * transaksi sempat retry karena data server berbeda dari cache lokal —
 * lihat catatan di atas).
 */
export async function changeBalance(uid, delta, { allowNegative = false, database } = {}) {
  if (!uid || typeof uid !== 'string') return fail(DATABASE_ERROR, { message: 'uid tidak valid' });
  if (!Number.isFinite(delta)) return fail(DATABASE_ERROR, { message: 'delta bukan angka valid' });

  let decision = DATABASE_ERROR;
  let before = null;
  let raw, rawType;
  let attempts = 0;

  try {
    const ref = (database || db()).ref('users/' + uid + '/balance');
    const res = await ref.transaction((current) => {
      attempts++;
      raw = current;
      rawType = current === null ? 'null' : typeof current;
      const b = toAmount(current);
      if (Number.isNaN(b)) {
        decision = MALFORMED_BALANCE;
        before = null;
        return current === null ? 0 : current; // commit tanpa perubahan
      }
      before = b;
      const next = b + delta;
      if (!allowNegative && next < 0) {
        decision = INSUFFICIENT_BALANCE;
        return b; // no-op commit, BUKAN abort
      }
      decision = BALANCE_OK;
      return next;
    });

    if (!res.committed) return fail(DATABASE_ERROR, { before, raw, rawType, attempts, message: 'Transaksi saldo tidak ter-commit' });
    if (decision === MALFORMED_BALANCE) return fail(MALFORMED_BALANCE, { raw, rawType, attempts, message: 'Nilai saldo di database bukan angka' });
    if (decision === INSUFFICIENT_BALANCE) return fail(INSUFFICIENT_BALANCE, { balance: toAmount(res.snapshot.val()), before, raw, rawType, attempts });
    return { success: true, reason: BALANCE_OK, balance: toAmount(res.snapshot.val()), before, raw, rawType, attempts };
  } catch (e) {
    return fail(DATABASE_ERROR, { before, raw: raw ?? null, rawType: rawType ?? null, attempts, message: String(e && e.message).slice(0, 200) });
  }
}

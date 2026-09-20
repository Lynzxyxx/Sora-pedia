// Fake Realtime Database untuk test.
// Meniru perilaku nyata firebase-admin yang jadi akar bug:
//  - fungsi update transaction dipanggil PERTAMA dengan nilai cache lokal
//    (null kalau cache dingin, seperti di serverless), bukan nilai server;
//  - kalau fungsi itu mengembalikan undefined -> abort final, server tidak pernah dibaca;
//  - kalau mengembalikan nilai, SDK membandingkan dengan data server dan
//    menjalankan ulang fungsi memakai data server sebelum commit (CAS).

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const parts = (p) => String(p).split('/').filter(Boolean);

export function createFakeDb(initial = {}, opts = {}) {
  const store = clone(initial);
  const coldCache = opts.coldCache !== false; // default: cache dingin (seperti serverless)
  const hooks = { beforeCommit: null };
  let seq = 0;

  const read = (path) => {
    let node = store;
    for (const k of parts(path)) {
      if (node === null || node === undefined || typeof node !== 'object') return null;
      node = node[k];
    }
    return node === undefined ? null : clone(node);
  };

  const write = (path, value) => {
    const ks = parts(path);
    let node = store;
    for (let i = 0; i < ks.length - 1; i++) {
      if (typeof node[ks[i]] !== 'object' || node[ks[i]] === null) node[ks[i]] = {};
      node = node[ks[i]];
    }
    const last = ks[ks.length - 1];
    if (value === null || value === undefined) delete node[last];
    else node[last] = clone(value);
  };

  const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

  function ref(path) {
    return {
      path,
      async once() {
        const v = read(path);
        return { val: () => v, exists: () => v !== null };
      },
      async set(v) { if (hooks.failWrites) throw new Error('write failed'); write(path, v); },
      async update(obj) {
        if (hooks.failWrites) throw new Error('write failed');
        for (const [k, v] of Object.entries(obj)) write(path + '/' + k, v);
      },
      async remove() { write(path, null); },
      push(v) {
        const key = '-key' + String(++seq).padStart(6, '0');
        if (v !== undefined) write(path + '/' + key, v);
        return { key, async set(x) { write(path + '/' + key, x); } };
      },
      limitToFirst() { return ref(path); },
      limitToLast() { return ref(path); },
      orderByChild() { return ref(path); },
      equalTo() { return ref(path); },

      async transaction(fn) {
        let cached = coldCache ? null : read(path);
        let out = fn(cached);
        if (out === undefined) {
          // abort final: persis seperti firebase-admin, server tidak pernah dilihat
          return { committed: false, snapshot: { val: () => read(path) } };
        }
        for (let i = 0; i < 25; i++) {
          if (hooks.beforeCommit) { const h = hooks.beforeCommit; hooks.beforeCommit = null; await h(); }
          const server = read(path);
          if (!same(server, cached)) {
            cached = server;
            out = fn(cached);
            if (out === undefined) return { committed: false, snapshot: { val: () => read(path) } };
            continue;
          }
          write(path, out);
          return { committed: true, snapshot: { val: () => clone(out) } };
        }
        return { committed: false, snapshot: { val: () => read(path) } };
      }
    };
  }

  return {
    ref,
    __read: read,
    __write: write,
    __hooks: hooks,
    __store: store
  };
}

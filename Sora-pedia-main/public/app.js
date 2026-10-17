/* Sora Pedia - frontend. Semua data lewat /api (Vercel Functions + Firebase Realtime Database). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const fmtDate = (t) => new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

const mem = {};
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } },
  set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) {} }
};

let token = ls.get('sp_token');
let me = null;
let SERVICES = [];
let cur = 'dasbor';
let pollTimer = null;
let cdTimer = null;

/* ---------- API ---------- */
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api/' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    if (res.status === 401 && token) logout(false);
    throw new Error(data.error || 'Terjadi kesalahan, coba lagi');
  }
  return data;
}
function toast(t) {
  const d = document.createElement('div');
  d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = t;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3000);
}

/* ---------- ikon ---------- */
const IC = {
  dash: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="11" width="8" height="10" rx="1"/><rect x="3" y="14" width="8" height="7" rx="1"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11L21 7H6"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12.5h2M3 10h18"/>',
  chat: '<path d="M4 4h16a1 1 0 011 1v10a1 1 0 01-1 1h-8l-5 4v-4H4a1 1 0 01-1-1V5a1 1 0 011-1z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
  set: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6M17 15v6M14 18h6"/>',
  doc: '<path d="M6 3h8l5 5v13H6zM14 3v5h5M9 13h6M9 17h6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>'
};
const ico = (k) => `<svg class="i" viewBox="0 0 24 24">${IC[k]}</svg>`;

/* ---------- landing ---------- */
$('#burgerL').onclick = () => {
  const o = $('#navL').classList.toggle('open');
  $('#burgerL').setAttribute('aria-expanded', o);
};
$$('#navL a').forEach((a) => a.addEventListener('click', () => { $('#navL').classList.remove('open'); $('#burgerL').setAttribute('aria-expanded', 'false'); }));

const TS = [
  ['Menggunakan booster di sini sangat aman dan nyaman.', 'Azka', 'Pengguna Telegram'],
  ['Harganya murah dan proses pesanan cepat, cocok untuk reseller.', 'Rina', 'Reseller Instagram'],
  ['Admin responsif, kalau ada kendala langsung dibantu.', 'Dimas', 'Kreator TikTok']
];
let ti = 0;
const tShow = () => { const t = TS[ti]; $('#tQ').textContent = '\u201C' + t[0] + '\u201D'; $('#tN').textContent = t[1]; $('#tR').textContent = t[2]; $('#tA').textContent = t[1][0]; };
$('#tPrev').onclick = () => { ti = (ti + TS.length - 1) % TS.length; tShow(); };
$('#tNext').onclick = () => { ti = (ti + 1) % TS.length; tShow(); };
tShow();

function countUp(el, end) {
  const t0 = performance.now();
  const step = (t) => { const p = Math.min((t - t0) / 1000, 1); el.textContent = Math.round(end * p).toLocaleString('id-ID'); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
api('stats').then((s) => { countUp($('#stUsers'), s.users); countUp($('#stOrders'), s.orders); countUp($('#stServices'), s.services); }).catch(() => {});

/* ---------- auth dialog ---------- */
let authMode = 'login';
function setAuthMode(m) {
  authMode = m;
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === m));
  $('#fName').classList.toggle('hidden', m !== 'register');
  $('#authGo').textContent = m === 'login' ? 'Masuk' : 'Buat akun';
  $('#authTitle').textContent = m === 'login' ? 'Masuk ke Sora Pedia' : 'Daftar Sora Pedia';
  $('#aPass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('#passHint').textContent = m === 'register' ? 'Minimal 8 karakter.' : '';
  $('#authErr').textContent = '';
}
$$('.tabs button').forEach((b) => (b.onclick = () => setAuthMode(b.dataset.tab)));
$('#authClose').onclick = () => $('#authDlg').close();
$('#authGo').onclick = async () => {
  const btn = $('#authGo'); btn.disabled = true; $('#authErr').textContent = '';
  try {
    const body = { email: $('#aEmail').value, password: $('#aPass').value };
    if (authMode === 'register') body.name = $('#aName').value;
    const r = await api(authMode === 'login' ? 'auth/login' : 'auth/register', { method: 'POST', body });
    token = r.token; ls.set('sp_token', token);
    $('#authDlg').close(); $('#aPass').value = '';
    await enterApp();
  } catch (e) { $('#authErr').textContent = e.message; }
  btn.disabled = false;
};
$('#authDlg').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#authGo').click(); });

$$('[data-open-app]').forEach((b) => (b.onclick = async () => {
  if (token) { try { await enterApp(); return; } catch (e) {} }
  setAuthMode('login'); $('#authDlg').showModal();
}));

async function enterApp() {
  const r = await api('me');
  me = r.user;
  if (!SERVICES.length) SERVICES = (await api('services')).services;
  $('#landing').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#navL').classList.remove('open');
  view('dasbor');
}
function logout(show = true) {
  token = null; me = null; ls.del('sp_token'); clearInterval(pollTimer); clearInterval(cdTimer);
  $('#app').classList.add('hidden'); $('#landing').classList.remove('hidden'); $('#dd').classList.add('hidden');
  if (show) toast('Kamu sudah keluar.');
  window.scrollTo(0, 0);
}
$('#logout').onclick = () => logout();
$('#homeLink').onclick = (e) => { e.preventDefault(); view('dasbor'); };

/* ---------- menu ---------- */
const MENU = [
  ['MENU', [['dasbor', 'Dasbor', 'dash'], ['buat', 'Buat Pesanan', 'cart'], ['riwayat', 'Riwayat Pemesanan', 'cart'], ['deposit', 'Deposit', 'wallet'], ['rdeposit', 'Riwayat Deposit', 'wallet'], ['tiket', 'Tiket', 'chat'], ['layanan', 'Layanan', 'list'], ['berita', 'Berita', 'news']]],
  ['AKUN', [['pengaturan', 'Pengaturan', 'set'], ['mutasi', 'Mutasi Saldo', 'wallet']]],
  ['SITEMAP', [['kontak', 'Kontak Kami', 'phone'], ['ketentuan', 'Ketentuan Layanan', 'doc'], ['target', 'Contoh Pengisian Target', 'doc'], ['status', 'Penjelasan Status', 'doc']]]
];
const PAGES = {
  ketentuan: ['Ketentuan Layanan', 'Pesanan yang sudah diproses tidak dapat dibatalkan. Pastikan target tidak diprivat dan username tidak diganti selama pesanan berjalan. Jangan membuat lebih dari satu pesanan untuk target yang sama sebelum pesanan sebelumnya selesai. Saldo yang sudah didepositkan tidak dapat ditarik kembali.'],
  target: ['Contoh Pengisian Target', 'Instagram: https://instagram.com/username (followers) atau link postingan (likes/views). TikTok: link video atau username sesuai keterangan layanan. YouTube: link video atau link channel. Baca keterangan tiap layanan sebelum memesan.'],
  status: ['Penjelasan Status', 'Pending: pesanan menunggu diproses. Proses: pesanan sedang dikerjakan. Selesai: pesanan berhasil sepenuhnya. Partial: sebagian terkirim, sisa saldo dikembalikan. Error/Dibatalkan: pesanan gagal dan saldo dikembalikan.'],
  kontak: ['Kontak Kami', 'Butuh bantuan? Buka menu Tiket lalu tulis kendalamu. Admin akan membalas secepatnya.']
};

function renderSide() {
  $('#side').innerHTML = `<div class="logo"><span class="mk"><svg class="i" viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-3-7-7-1z"/></svg></span><span><b>SORA</b> PEDIA</span></div>` +
    MENU.map(([h, items]) => `<h6>${h}</h6>` + items.map(([k, t, i]) => `<a href="#" data-view="${k}" class="${cur === k ? 'on' : ''}">${ico(i)}<span>${t}</span></a>`).join('')).join('') +
    `<div class="cp">&copy; 2026 SORA PEDIA</div>`;
  $('#tabbar').innerHTML = [['dasbor', 'Dasbor', 'dash'], ['buat', 'Pesan', 'cart'], ['deposit', 'Deposit', 'wallet'], ['layanan', 'Layanan', 'list']]
    .map(([k, t, i]) => `<a href="#" data-view="${k}" class="${cur === k ? 'on' : ''}">${ico(i)}<span>${t}</span></a>`).join('');
}
function closeSide() { $('#side').classList.remove('open'); $('#scrim').classList.add('hidden'); }
function refreshUser() { if (!me) return; $('#uName').textContent = me.name; $('#uMail').textContent = me.email; $('#ddSaldo').textContent = rp(me.balance); }

const pill = (s) => {
  const cls = { Selesai: 's-ok', success: 's-ok', Proses: 's-pr', Pending: 's-wt', pending: 's-wt', Partial: 's-pr', Error: 's-er', Dibatalkan: 's-er', expired: 's-er', failed: 's-er', Open: 's-wt', Dibalas: 's-ok' }[s] || 's-wt';
  const label = { success: 'Berhasil', pending: 'Menunggu', expired: 'Kedaluwarsa', failed: 'Gagal' }[s] || s;
  return `<span class="pill ${cls}">${esc(label)}</span>`;
};
function serviceRows(list) {
  if (!list.length) return '<div class="empty">Belum ada layanan.</div>';
  return `<div class="list">` + list.map((s) => `<div class="it"><span class="no">#${esc(s.no)}</span><div class="nm">${esc(s.name)}<small>${rp(s.price)} / 1000 &middot; Min ${Number(s.min).toLocaleString('id-ID')} &middot; Max ${Number(s.max).toLocaleString('id-ID')}</small></div><button class="cart" data-order="${esc(s.id)}" aria-label="Pesan layanan ${esc(s.no)}">${ico('cart')}</button></div>`).join('') + `</div>`;
}

/* ---------- views ---------- */
async function view(k, arg) {
  clearInterval(pollTimer); clearInterval(cdTimer);
  cur = k; renderSide(); closeSide(); $('#dd').classList.add('hidden');
  const m = $('#main');
  m.innerHTML = '<div class="empty">Memuat...</div>';
  try {
    if (k === 'dasbor') {
      const o = await api('orders');
      m.innerHTML = `<h1 class="pg-title">Dasbor</h1>
        <div class="g3">
          <div class="card kpi"><div class="ic">${ico('wallet')}</div><div><small>Sisa Saldo</small><b>${rp(me.balance)}</b></div></div>
          <div class="card kpi"><div class="ic">${ico('cart')}</div><div><small>Total Pesanan</small><b>${o.orders.length}</b></div></div>
          <div class="card kpi"><div class="ic">${ico('list')}</div><div><small>Layanan Tersedia</small><b>${SERVICES.length}</b></div></div>
        </div>
        <div class="card"><h3>Layanan Terpopuler</h3>${serviceRows(SERVICES.slice(0, 7))}<p style="margin-top:14px"><button class="btn" data-view="layanan">Lihat semua layanan</button></p></div>`;
    } else if (k === 'layanan') {
      const cats = [...new Set(SERVICES.map((s) => s.cat))];
      m.innerHTML = `<h1 class="pg-title">Layanan</h1><div class="card"><div class="tools"><select id="fc" style="max-width:200px" aria-label="Kategori"><option value="">Semua kategori</option>${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select><input id="fq" placeholder="Cari layanan..." style="flex:1;min-width:160px" aria-label="Cari layanan"></div><div id="sl">${serviceRows(SERVICES)}</div></div>`;
      const f = () => { const c = $('#fc').value, q = $('#fq').value.toLowerCase(); $('#sl').innerHTML = serviceRows(SERVICES.filter((s) => (!c || s.cat === c) && s.name.toLowerCase().includes(q))); };
      $('#fc').onchange = f; $('#fq').oninput = f;
    } else if (k === 'buat') {
      const cats = [...new Set(SERVICES.map((s) => s.cat))];
      m.innerHTML = `<h1 class="pg-title">Buat Pesanan</h1><div class="card">
        <label for="oc">Kategori</label><select id="oc">${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
        <label for="os">Layanan</label><select id="os"></select>
        <p id="oinfo" class="hint" style="margin-top:6px"></p>
        <label for="ot">Target (link atau username)</label><input id="ot" placeholder="https://tiktok.com/@username" autocomplete="off">
        <label for="oq">Jumlah</label><input id="oq" type="number" inputmode="numeric" placeholder="1000">
        <div class="total"><span>Total harga</span><b id="otot">Rp 0</b></div>
        <button class="btn btn-full" id="odo">Pesan</button></div>`;
      const upd = () => { const s = SERVICES.find((x) => x.id === $('#os').value); if (!s) return; const q = +$('#oq').value || 0; $('#oinfo').textContent = `${rp(s.price)} per 1000 · Min ${s.min.toLocaleString('id-ID')} · Max ${s.max.toLocaleString('id-ID')}`; $('#otot').textContent = rp(Math.ceil(s.price * q / 1000)); };
      const fill = () => { const c = $('#oc').value; $('#os').innerHTML = SERVICES.filter((s) => s.cat === c).map((s) => `<option value="${esc(s.id)}">${esc(s.no)} - ${esc(s.name)}</option>`).join(''); upd(); };
      $('#oc').onchange = fill; $('#os').onchange = upd; $('#oq').oninput = upd;
      if (arg) { const s = SERVICES.find((x) => x.id === arg); if (s) { $('#oc').value = s.cat; fill(); $('#os').value = s.id; upd(); } } else fill();
      $('#odo').onclick = async () => {
        const btn = $('#odo'); btn.disabled = true;
        try {
          const r = await api('orders/create', { method: 'POST', body: { serviceId: $('#os').value, target: $('#ot').value, qty: $('#oq').value } });
          me.balance = r.balance; refreshUser(); toast('Pesanan berhasil dibuat.'); view('riwayat');
        } catch (e) { toast(e.message); btn.disabled = false; }
      };
    } else if (k === 'riwayat') {
      const { orders } = await api('orders');
      m.innerHTML = `<h1 class="pg-title">Riwayat Pemesanan</h1><div class="card">${orders.length ? `<div class="list">` + orders.map((o) => `<div class="it"><div class="nm">${esc(o.serviceName)}<small>${esc(o.target)} &middot; ${Number(o.qty).toLocaleString('id-ID')} &middot; ${rp(o.total)} &middot; ${fmtDate(o.createdAt)}</small></div>${pill(o.status)}</div>`).join('') + `</div>` : `<div class="empty">Belum ada pesanan. Buat pesanan pertamamu dari menu Buat Pesanan.</div>`}</div>`;
    } else if (k === 'deposit') {
      if (arg) return showDeposit(arg);
      m.innerHTML = `<h1 class="pg-title">Deposit</h1><div class="card">
        <label for="dn">Nominal deposit (Rp)</label><input id="dn" type="number" inputmode="numeric" placeholder="50000">
        <div class="tools" style="margin-top:10px">${[10000, 25000, 50000, 100000].map((n) => `<button class="btn btn-ghost btn-sm" data-amt="${n}">${rp(n)}</button>`).join('')}</div>
        <button class="btn btn-full" id="ddo">Bayar dengan QRIS</button>
        <p class="hint" style="margin-top:12px">Saldo bertambah otomatis setelah pembayaran terkonfirmasi. Bisa dibayar lewat semua e-wallet dan mobile banking yang mendukung QRIS.</p></div>`;
      $$('[data-amt]').forEach((b) => (b.onclick = () => ($('#dn').value = b.dataset.amt)));
      $('#ddo').onclick = async () => {
        const btn = $('#ddo'); btn.disabled = true;
        try { const r = await api('deposit/create', { method: 'POST', body: { amount: $('#dn').value } }); showDeposit(r.deposit); }
        catch (e) { toast(e.message); btn.disabled = false; }
      };
    } else if (k === 'rdeposit') {
      const { deposits } = await api('deposits');
      m.innerHTML = `<h1 class="pg-title">Riwayat Deposit</h1><div class="card">${deposits.length ? `<div class="list">` + deposits.map((d) => `<div class="it"><div class="nm"><b>${rp(d.amount)}</b><small>${fmtDate(d.createdAt)}</small></div>${d.status === 'pending' && Date.now() < d.expiresAt ? `<button class="btn btn-sm" data-dep='${esc(JSON.stringify(d))}'>Bayar</button>` : pill(d.status)}</div>`).join('') + `</div>` : `<div class="empty">Belum ada deposit.</div>`}</div>`;
      $$('[data-dep]').forEach((b) => (b.onclick = () => showDeposit(JSON.parse(b.dataset.dep))));
    } else if (k === 'mutasi') {
      const { mutations } = await api('mutations');
      m.innerHTML = `<h1 class="pg-title">Mutasi Saldo</h1><div class="card">${mutations.length ? `<div class="list">` + mutations.map((x) => `<div class="it"><div class="nm">${esc(x.note)}<small>${fmtDate(x.createdAt)}</small></div><b style="color:${x.amount < 0 ? 'var(--danger)' : 'var(--green)'}">${x.amount < 0 ? '-' : '+'}${rp(Math.abs(x.amount))}</b></div>`).join('') + `</div>` : `<div class="empty">Belum ada mutasi.</div>`}</div>`;
    } else if (k === 'tiket') {
      const { tickets } = await api('tickets');
      m.innerHTML = `<h1 class="pg-title">Tiket</h1>
        <div class="card"><h3>Buat tiket baru</h3><label for="tsub">Subjek</label><input id="tsub" maxlength="100"><label for="tmsg">Pesan</label><textarea id="tmsg" maxlength="1500"></textarea><button class="btn btn-full" id="tgo">Kirim tiket</button></div>
        <div class="card"><h3>Tiket kamu</h3>${tickets.length ? `<div class="list">` + tickets.map((t) => `<div class="it" style="align-items:flex-start"><div class="nm"><b>${esc(t.subject)}</b><small>${fmtDate(t.createdAt)}</small><p style="margin-top:6px">${esc(t.message)}</p>${t.reply ? `<p style="margin-top:8px;padding:10px 12px;background:var(--soft);border-radius:12px"><b>Admin:</b> ${esc(t.reply)}</p>` : ''}</div>${pill(t.status)}</div>`).join('') + `</div>` : '<div class="empty">Belum ada tiket.</div>'}</div>`;
      $('#tgo').onclick = async () => { try { await api('tickets/create', { method: 'POST', body: { subject: $('#tsub').value, message: $('#tmsg').value } }); toast('Tiket terkirim.'); view('tiket'); } catch (e) { toast(e.message); } };
    } else if (k === 'berita') {
      const { news } = await api('news');
      m.innerHTML = `<h1 class="pg-title">Berita</h1>` + (news.length ? news.map((n) => `<div class="card"><b>${esc(n.title)}</b><p class="hint" style="margin:2px 0 8px">${fmtDate(n.createdAt)}</p><p>${esc(n.body)}</p></div>`).join('') : `<div class="card"><div class="empty">Belum ada berita.</div></div>`);
    } else if (k === 'pengaturan') {
      m.innerHTML = `<h1 class="pg-title">Pengaturan</h1>
        <div class="card"><h3>Profil</h3><label for="sn">Nama</label><input id="sn" value="${esc(me.name)}"><label for="se">Email</label><input id="se" value="${esc(me.email)}" disabled><button class="btn btn-full" id="ssv">Simpan nama</button></div>
        <div class="card"><h3>Ganti password</h3><label for="op">Password lama</label><input id="op" type="password" autocomplete="current-password"><label for="np">Password baru (min. 8 karakter)</label><input id="np" type="password" autocomplete="new-password"><button class="btn btn-full" id="psv">Ganti password</button></div>`;
      $('#ssv').onclick = async () => { try { await api('me/update', { method: 'POST', body: { name: $('#sn').value } }); me.name = $('#sn').value.trim(); refreshUser(); toast('Nama disimpan.'); } catch (e) { toast(e.message); } };
      $('#psv').onclick = async () => { try { await api('me/update', { method: 'POST', body: { oldPassword: $('#op').value, newPassword: $('#np').value } }); $('#op').value = $('#np').value = ''; toast('Password diganti.'); } catch (e) { toast(e.message); } };
    } else if (PAGES[k]) {
      m.innerHTML = `<h1 class="pg-title">${PAGES[k][0]}</h1><div class="card"><p>${PAGES[k][1]}</p></div>`;
    }
  } catch (e) { m.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; }
  refreshUser(); window.scrollTo(0, 0);
}

/* ---------- tampilan QRIS deposit + polling status ---------- */
function showDeposit(dep) {
  clearInterval(pollTimer); clearInterval(cdTimer);
  cur = 'deposit'; renderSide();
  const m = $('#main');
  m.innerHTML = `<h1 class="pg-title">Bayar Deposit</h1><div class="card qrbox">
    <div id="depBody"></div>
    <button class="btn btn-ghost btn-full" id="dchk">Cek status pembayaran</button>
    <button class="btn btn-ghost btn-full" data-view="rdeposit" style="margin-top:8px">Lihat riwayat deposit</button></div>`;
  const paint = (d) => {
    let inner = '';
    if (d.status === 'success') inner = `<h3 style="color:var(--green)">Pembayaran berhasil</h3><p class="amt">${rp(d.amount)}</p><p class="hint">Saldo sudah ditambahkan.</p>`;
    else if (d.status === 'expired' || d.status === 'failed') inner = `<h3 style="color:var(--danger)">${d.status === 'expired' ? 'QR kedaluwarsa' : 'Pembayaran gagal'}</h3><p class="hint">Silakan buat deposit baru.</p>`;
    else inner = `${d.qr_url ? `<img src="${esc(d.qr_url)}" alt="QRIS pembayaran deposit" width="260" height="260">` : ''}<p class="amt">${rp(d.total_amount)}</p><p class="hint">Bayar tepat sesuai nominal di atas.<br>Berlaku sampai <b id="cd"></b></p>${d.payment_url ? `<p style="margin-top:10px"><a class="btn btn-sm" href="${esc(d.payment_url)}" target="_blank" rel="noopener">Buka halaman bayar</a></p>` : ''}`;
    $('#depBody').innerHTML = inner;
    const cd = $('#cd'); if (cd) { const left = Math.max(0, d.expiresAt - Date.now()); cd.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`; }
  };
  let last = dep; paint(dep);
  const check = async (manual) => {
    try {
      const r = await api('deposit/check', { method: 'POST', body: { id: last.id } });
      last = r.deposit;
      if (typeof r.balance === 'number') { me.balance = r.balance; refreshUser(); }
      paint(last);
      if (last.status !== 'pending') { clearInterval(pollTimer); if (last.status === 'success') toast('Deposit berhasil!'); }
      else if (manual) toast(r.throttled ? 'Tunggu sebentar sebelum cek lagi.' : 'Pembayaran belum diterima.');
    } catch (e) { if (manual) toast(e.message); }
  };
  $('#dchk').onclick = () => check(true);
  pollTimer = setInterval(() => { if (last.status === 'pending') check(false); paint(last); }, 21000);
  cdTimer = setInterval(() => { if (cur === 'deposit' && last.status === 'pending') paint(last); }, 1000);
}

/* ---------- event global ---------- */
document.addEventListener('click', (e) => {
  const v = e.target.closest('[data-view]'); if (v) { e.preventDefault(); view(v.dataset.view); return; }
  const o = e.target.closest('[data-order]'); if (o) { view('buat', o.dataset.order); return; }
  if (e.target.closest('[data-chat]')) { $('#chatBox').classList.toggle('hidden'); return; }
  if (!e.target.closest('#dd') && !e.target.closest('#avBtn')) $('#dd').classList.add('hidden');
});
$('#burgerApp').onclick = () => { $('#side').classList.add('open'); $('#scrim').classList.remove('hidden'); };
$('#scrim').onclick = closeSide;
$('#avBtn').onclick = (e) => { e.stopPropagation(); const h = $('#dd').classList.toggle('hidden'); $('#avBtn').setAttribute('aria-expanded', !h); };
$('#theme').onclick = () => { const r = document.documentElement; const d = r.dataset.theme === 'dark'; r.dataset.theme = d ? 'light' : 'dark'; ls.set('sp_theme', r.dataset.theme); };
{ const t = ls.get('sp_theme'); if (t) document.documentElement.dataset.theme = t; }
$('#chatBtn').classList.remove('hidden');
$('#chatBtn').onclick = () => $('#chatBox').classList.toggle('hidden');
$('#chatTicket').onclick = async () => {
  $('#chatBox').classList.add('hidden');
  if (token && me) view('tiket'); else { setAuthMode('login'); $('#authDlg').showModal(); }
};

/* auto-masuk kalau sesi masih ada */
if (token) enterApp().catch(() => {});

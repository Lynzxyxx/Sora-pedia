const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const fmtDate = (t) => (t ? new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

let token = null;
try { token = sessionStorage.getItem('sp_admin'); } catch (e) {}
let tab = 'ringkasan';
let cache = {};

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api/' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let d = {}; try { d = await res.json(); } catch (e) {}
  if (!res.ok) { if (res.status === 401 && token) out(); throw new Error(d.error || 'Terjadi kesalahan'); }
  return d;
}
function toast(t) {
  const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = t;
  document.body.appendChild(d); setTimeout(() => d.remove(), 3000);
}
function out() { token = null; try { sessionStorage.removeItem('sp_admin'); } catch (e) {} $('#panel').classList.add('hidden'); $('#login').classList.remove('hidden'); }

$('#ago').onclick = async () => {
  const b = $('#ago'); b.disabled = true; $('#aerr').textContent = '';
  try {
    const r = await api('admin/login', { method: 'POST', body: { email: $('#ae').value, password: $('#ap').value } });
    token = r.token; try { sessionStorage.setItem('sp_admin', token); } catch (e) {}
    $('#ap').value = ''; start();
  } catch (e) { $('#aerr').textContent = e.message; }
  b.disabled = false;
};
$('#login').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#ago').click(); });
$('#alogout').onclick = out;

const TABS = [['ringkasan', 'Ringkasan'], ['pengguna', 'Pengguna'], ['pesanan', 'Pesanan'], ['deposit', 'Deposit'], ['layanan', 'Layanan'], ['berita', 'Berita'], ['tiket', 'Tiket'], ['setelan', 'Pengaturan']];

function start() {
  $('#login').classList.add('hidden'); $('#panel').classList.remove('hidden');
  $('#tabs').innerHTML = TABS.map(([k, t]) => `<button data-tab="${k}" role="tab" class="${k === tab ? 'on' : ''}">${t}</button>`).join('');
  show(tab);
}
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; $$('#tabs button').forEach((x) => x.classList.toggle('on', x === b)); show(tab); } });

const table = (cols, rows) => `<div class="tbl-wrap"><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${cols.length}" style="text-align:center;color:var(--muted);padding:26px">Belum ada data.</td></tr>`}</tbody></table></div>`;
const pill = (s) => { const c = { Selesai: 's-ok', success: 's-ok', Proses: 's-pr', Partial: 's-pr', Error: 's-er', Dibatalkan: 's-er', expired: 's-er', failed: 's-er', Dibalas: 's-ok' }[s] || 's-wt'; return `<span class="pill ${c}">${esc(s)}</span>`; };
const kpi = (label, val) => `<div class="card kpi"><div><small>${label}</small><b>${val}</b></div></div>`;

async function show(k) {
  const c = $('#content'); c.innerHTML = '<div class="card"><div class="empty">Memuat...</div></div>';
  try {
    if (k === 'ringkasan') {
      const o = await api('admin/overview');
      c.innerHTML = `<div class="g3">${kpi('Pengguna', o.users)}${kpi('Total pesanan', o.orders)}${kpi('Pesanan berjalan', o.pendingOrders)}${kpi('Omzet pesanan', rp(o.revenue))}${kpi('Total deposit sukses', rp(o.depositTotal))}${kpi('Total saldo pengguna', rp(o.userBalance))}</div>
      <div class="card" style="margin-top:14px"><h3>Status koneksi</h3>
        <p>Deposit otomatis (BuatQRIS): ${o.payment ? pill('success').replace('success', 'Terhubung') : pill('Error').replace('Error', 'Belum diatur')}${o.sandbox ? ' <span class="pill s-pr">Mode sandbox</span>' : ''}</p>
        <p style="margin-top:8px">Provider layanan: ${o.provider ? pill('success').replace('success', 'Terhubung') : pill('Pending').replace('Pending', 'Belum diatur (pesanan manual)')}</p>
        <p style="margin-top:8px">Database: ${pill('success').replace('success', 'Firebase Realtime Database aktif')}</p></div>`;
    } else if (k === 'pengguna') {
      const { users } = await api('admin/users'); cache.users = users;
      c.innerHTML = `<div class="card"><div class="tools"><input id="uq" placeholder="Cari nama / email..." aria-label="Cari pengguna"></div><div id="ut"></div></div>`;
      const draw = () => { const q = $('#uq').value.toLowerCase(); $('#ut').innerHTML = table(['Pengguna', 'Saldo', 'Daftar', 'Status', 'Aksi'], users.filter((u) => (u.name + u.email).toLowerCase().includes(q)).map((u) => `<tr><td><b>${esc(u.name)}</b><small>${esc(u.email)}</small></td><td>${rp(u.balance)}</td><td>${fmtDate(u.createdAt)}</td><td>${u.banned ? pill('Error').replace('Error', 'Diblokir') : pill('success').replace('success', 'Aktif')}</td><td><div class="acts"><button class="btn btn-ghost btn-sm" data-bal="${esc(u.id)}">Ubah saldo</button><button class="btn ${u.banned ? 'btn-ghost' : 'btn-danger'} btn-sm" data-ban="${esc(u.id)}" data-to="${u.banned ? 0 : 1}">${u.banned ? 'Buka blokir' : 'Blokir'}</button></div></td></tr>`)); };
      $('#uq').oninput = draw; draw();
    } else if (k === 'pesanan') {
      const { orders } = await api('admin/orders');
      const st = ['Pending', 'Proses', 'Selesai', 'Partial', 'Error', 'Dibatalkan'];
      c.innerHTML = `<div class="card"><div class="tools"><button class="btn btn-ghost btn-sm" id="orf">Sinkron status dari provider</button></div>${table(['Pesanan', 'Pengguna', 'Total', 'Status', 'Ubah status'], orders.map((o) => `<tr><td>${esc(o.serviceName)}<small>${esc(o.target)} &middot; ${Number(o.qty).toLocaleString('id-ID')} &middot; ${fmtDate(o.createdAt)}</small></td><td>${esc(o.userName)}</td><td>${rp(o.total)}</td><td>${pill(o.status)}</td><td><select data-ost="${esc(o.id)}" aria-label="Status">${st.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`))}</div>`;
      $('#orf').onclick = async () => { try { const r = await api('admin/orders/refresh', { method: 'POST', body: {} }); toast(r.updated + ' pesanan diperbarui'); show('pesanan'); } catch (e) { toast(e.message); } };
    } else if (k === 'deposit') {
      const { deposits } = await api('admin/deposits');
      c.innerHTML = `<div class="card">${table(['Pengguna', 'Nominal', 'Dibayar', 'Status', 'Waktu'], deposits.map((d) => `<tr><td>${esc(d.userName)}</td><td>${rp(d.amount)}</td><td>${rp(d.total_amount)}</td><td>${pill(d.status)}</td><td>${fmtDate(d.createdAt)}</td></tr>`))}</div>`;
    } else if (k === 'layanan') {
      const { services } = await api('admin/services'); cache.services = services;
      c.innerHTML = `<div class="card"><div class="tools"><button class="btn btn-sm" id="snew">Tambah layanan</button><button class="btn btn-ghost btn-sm" id="ssync">Impor dari provider</button></div>${table(['No', 'Layanan', 'Harga / 1000', 'Min - Max', 'ID Provider', 'Aktif', 'Aksi'], services.map((s) => `<tr><td>${esc(s.no)}</td><td>${esc(s.name)}<small>${esc(s.cat)}</small></td><td>${rp(s.price)}</td><td>${Number(s.min).toLocaleString('id-ID')} - ${Number(s.max).toLocaleString('id-ID')}</td><td>${esc(s.providerServiceId || '-')}</td><td>${s.active ? 'Ya' : 'Tidak'}</td><td><div class="acts"><button class="btn btn-ghost btn-sm" data-sedit="${esc(s.id)}">Edit</button><button class="btn btn-danger btn-sm" data-sdel="${esc(s.id)}">Hapus</button></div></td></tr>`))}</div><div id="sform"></div>`;
      $('#snew').onclick = () => serviceForm({});
      $('#ssync').onclick = async () => { if (!confirm('Impor semua layanan dari provider? Harga memakai markup di menu Pengaturan.')) return; try { const r = await api('admin/services/sync', { method: 'POST', body: {} }); toast(r.imported + ' layanan diimpor'); show('layanan'); } catch (e) { toast(e.message); } };
    } else if (k === 'berita') {
      const { news } = await api('news');
      c.innerHTML = `<div class="card"><h3>Tambah berita</h3><label for="nt">Judul</label><input id="nt" maxlength="120"><label for="nb">Isi</label><textarea id="nb" maxlength="2000"></textarea><button class="btn btn-full" id="nsv">Terbitkan</button></div><div class="card" style="margin-top:14px">${table(['Berita', 'Waktu', 'Aksi'], news.map((n) => `<tr><td><b>${esc(n.title)}</b><small>${esc(n.body)}</small></td><td>${fmtDate(n.createdAt)}</td><td><button class="btn btn-danger btn-sm" data-ndel="${esc(n.id)}">Hapus</button></td></tr>`))}</div>`;
      $('#nsv').onclick = async () => { try { await api('admin/news/save', { method: 'POST', body: { title: $('#nt').value, body: $('#nb').value } }); toast('Berita terbit'); show('berita'); } catch (e) { toast(e.message); } };
    } else if (k === 'tiket') {
      const { tickets } = await api('admin/tickets');
      c.innerHTML = `<div class="card">${table(['Tiket', 'Status', 'Balas'], tickets.map((t) => `<tr><td><b>${esc(t.subject)}</b><small>${esc(t.userName)} &middot; ${fmtDate(t.createdAt)}</small><p style="margin-top:6px">${esc(t.message)}</p>${t.reply ? `<p style="margin-top:6px;color:var(--muted)"><b>Balasan:</b> ${esc(t.reply)}</p>` : ''}</td><td>${pill(t.status)}</td><td><textarea data-rt="${esc(t.id)}" style="min-height:70px;min-width:200px" aria-label="Balasan"></textarea><button class="btn btn-sm" style="margin-top:6px" data-reply="${esc(t.id)}">Kirim</button></td></tr>`))}</div>`;
    } else if (k === 'setelan') {
      const { settings: s } = await api('admin/settings');
      c.innerHTML = `<div class="card"><h3>Pengaturan</h3><div class="grid2">
        <div><label for="s1">Minimal deposit (Rp)</label><input id="s1" type="number" value="${s.minDeposit}"></div>
        <div><label for="s2">Maksimal deposit (Rp)</label><input id="s2" type="number" value="${s.maxDeposit}"></div>
        <div><label for="s3">Markup impor provider (%)</label><input id="s3" type="number" value="${s.markup}"></div>
        <div><label for="s4">Kurs / pengali harga provider</label><input id="s4" type="number" step="any" value="${s.multiplier}"></div></div>
        <button class="btn btn-full" id="ssv">Simpan pengaturan</button>
        <p class="hint" style="margin-top:12px">Kunci API (BuatQRIS, provider, Firebase) diatur lewat Environment Variables di Vercel, bukan di halaman ini.</p></div>`;
      $('#ssv').onclick = async () => { try { await api('admin/settings', { method: 'POST', body: { minDeposit: $('#s1').value, maxDeposit: $('#s2').value, markup: $('#s3').value, multiplier: $('#s4').value } }); toast('Tersimpan'); } catch (e) { toast(e.message); } };
    }
  } catch (e) { c.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; }
}

function serviceForm(s) {
  $('#sform').innerHTML = `<div class="card" style="margin-top:14px"><h3>${s.id ? 'Edit' : 'Tambah'} layanan</h3><div class="grid2">
    <div><label for="f1">Kategori</label><input id="f1" value="${esc(s.cat || '')}" placeholder="TikTok"></div>
    <div><label for="f2">Nomor tampil</label><input id="f2" type="number" value="${esc(s.no || '')}"></div></div>
    <label for="f3">Nama layanan</label><input id="f3" value="${esc(s.name || '')}">
    <div class="grid2"><div><label for="f4">Harga per 1000 (Rp)</label><input id="f4" type="number" value="${esc(s.price ?? '')}"></div>
    <div><label for="f5">ID layanan di provider (opsional)</label><input id="f5" value="${esc(s.providerServiceId || '')}"></div>
    <div><label for="f6">Minimal</label><input id="f6" type="number" value="${esc(s.min ?? 100)}"></div>
    <div><label for="f7">Maksimal</label><input id="f7" type="number" value="${esc(s.max ?? 10000)}"></div></div>
    <label><input type="checkbox" id="f8" style="width:auto;margin-right:8px" ${s.active === false ? '' : 'checked'}>Aktif (tampil ke pengguna)</label>
    <button class="btn btn-full" id="fsv">Simpan</button></div>`;
  $('#sform').scrollIntoView({ behavior: 'smooth' });
  $('#fsv').onclick = async () => {
    try {
      await api('admin/services/save', { method: 'POST', body: { id: s.id, cat: $('#f1').value, no: $('#f2').value, name: $('#f3').value, price: $('#f4').value, providerServiceId: $('#f5').value, min: $('#f6').value, max: $('#f7').value, active: $('#f8').checked } });
      toast('Layanan disimpan'); show('layanan');
    } catch (e) { toast(e.message); }
  };
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('button'); if (!t) return;
  try {
    if (t.dataset.ban !== undefined) { await api('admin/users/update', { method: 'POST', body: { uid: t.dataset.ban, banned: t.dataset.to === '1' } }); show('pengguna'); }
    else if (t.dataset.bal !== undefined) {
      const v = prompt('Tambah / kurangi saldo (Rp). Contoh: 10000 atau -5000'); if (!v) return;
      const note = prompt('Catatan (opsional)') || '';
      await api('admin/users/update', { method: 'POST', body: { uid: t.dataset.bal, balanceDelta: v, note } }); toast('Saldo diperbarui'); show('pengguna');
    }
    else if (t.dataset.sedit !== undefined) serviceForm((cache.services || []).find((x) => x.id === t.dataset.sedit) || {});
    else if (t.dataset.sdel !== undefined) { if (!confirm('Hapus layanan ini?')) return; await api('admin/services/delete', { method: 'POST', body: { id: t.dataset.sdel } }); show('layanan'); }
    else if (t.dataset.ndel !== undefined) { await api('admin/news/delete', { method: 'POST', body: { id: t.dataset.ndel } }); show('berita'); }
    else if (t.dataset.reply !== undefined) { const id = t.dataset.reply; await api('admin/tickets/reply', { method: 'POST', body: { id, reply: $(`[data-rt="${id}"]`).value } }); toast('Balasan terkirim'); show('tiket'); }
  } catch (err) { toast(err.message); }
});
document.addEventListener('change', async (e) => {
  const s = e.target.closest('[data-ost]'); if (!s) return;
  try { await api('admin/orders/update', { method: 'POST', body: { id: s.dataset.ost, status: s.value } }); toast('Status diperbarui'); } catch (err) { toast(err.message); show('pesanan'); }
});

if (token) start();

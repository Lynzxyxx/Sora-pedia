/* Logika halaman /login dan /daftar. Memakai API dan kunci sesi (sp_token) yang sama dengan app.js. */
(function () {
  const $ = (s) => document.querySelector(s);
  const register = document.body.dataset.mode === 'register';
  const mem = {};
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* sudah login? langsung ke dasbor. Sesi rusak/kedaluwarsa dibersihkan supaya bisa login ulang */
  const old = ls.get('sp_token');
  if (old) {
    fetch('/api/me', { headers: { Authorization: 'Bearer ' + old } })
      .then((r) => { if (r.ok) location.replace('/'); else ls.del('sp_token'); })
      .catch(() => {});
  }

  $('#showPw').addEventListener('change', (e) => { $('#aPass').type = e.target.checked ? 'text' : 'password'; });

  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#authGo'), err = $('#authErr');
    err.textContent = '';
    const body = { email: $('#aEmail').value, password: $('#aPass').value };
    if (register) {
      body.name = $('#aName').value;
      if (body.password.length < 8) { err.textContent = 'Password minimal 8 karakter.'; return; }
    }
    btn.disabled = true;
    const label = btn.textContent; btn.textContent = 'Mohon tunggu...';
    try {
      const res = await fetch('/api/auth/' + (register ? 'register' : 'login'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      let d = {}; try { d = await res.json(); } catch (x) {}
      if (!res.ok) throw new Error(d.error || 'Terjadi kesalahan, coba lagi');
      ls.set('sp_token', d.token);
      location.replace('/');
    } catch (x) {
      err.textContent = x.message;
      btn.disabled = false; btn.textContent = label;
    }
  });
})();

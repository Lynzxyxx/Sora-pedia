'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import initAdmin from '@/lib/client/admin';

const Mark = () => (
  <span className="mk">
    <svg className="i" viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-3-7-7-1z" /></svg>
  </span>
);

export default function AdminPanel() {
  useEffect(() => { initAdmin(); }, []);

  return (
    <>
      <div id="login" className="adm-wrap">
        <div className="card login-card">
          <div className="logo" style={{ marginBottom: '6px' }}><Mark /><span><b>SORA</b> PEDIA</span></div>
          <h1 style={{ fontSize: '22px', margin: '10px 0 4px' }}>Admin Panel</h1>
          <p className="hint">Masuk dengan akun admin.</p>
          <label htmlFor="ae">Email</label><input id="ae" type="email" autoComplete="username" />
          <label htmlFor="ap">Password</label><input id="ap" type="password" autoComplete="current-password" />
          <p className="err" id="aerr" role="alert"></p>
          <button className="btn btn-full" id="ago">Masuk</button>
          <p style={{ marginTop: '14px', textAlign: 'center' }}><Link href="/" className="hint">Kembali ke website</Link></p>
        </div>
      </div>

      <div id="panel" className="adm-wrap hidden">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div className="logo"><Mark /><span><b>SORA</b> PEDIA &middot; Admin</span></div>
          <div style={{ display: 'flex', gap: '8px' }}><Link className="btn btn-ghost btn-sm" href="/">Lihat website</Link><button className="btn btn-danger btn-sm" id="alogout">Keluar</button></div>
        </div>
        <div className="adm-tabs" id="tabs" role="tablist"></div>
        <div id="content"></div>
      </div>
    </>
  );
}

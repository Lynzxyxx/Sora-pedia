import LandingBoot from './LandingBoot';

const Mark = () => (
  <span className="mk">
    <svg className="i" viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-3-7-7-1z" /></svg>
  </span>
);

const DashIcon = () => (
  <svg className="i" viewBox="0 0 24 24">
    <rect x="3" y="3" width="8" height="8" rx="1" />
    <rect x="13" y="3" width="8" height="5" rx="1" />
    <rect x="13" y="11" width="8" height="10" rx="1" />
    <rect x="3" y="14" width="8" height="7" rx="1" />
  </svg>
);

export default function Page() {
  return (
    <>
      {/* ===== LANDING ===== */}
      <div id="landing">
        <header className="nav">
          <div className="nav-in">
            <a href="#" className="logo" aria-label="Sora Pedia"><Mark /><span><b>SORA</b> PEDIA</span></a>
            <button className="burger" id="burgerL" aria-label="Buka menu" aria-expanded="false" aria-controls="navL">
              <svg className="i" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <nav className="nav-links" id="navL" aria-label="Navigasi utama">
              <a href="#utama">Utama</a>
              <a href="#layanan-l">Layanan</a>
              <a href="#kontak">Kontak</a>
              <button className="btn-white" data-open-app=""><DashIcon />Dasbor</button>
            </nav>
          </div>
        </header>

        <section className="hero" id="utama">
          <div className="hero-in">
            <div className="hero-art">
              <svg viewBox="0 0 320 220" width="100%" style={{ maxWidth: '340px' }} aria-hidden="true">
                <rect x="112" y="16" width="96" height="176" rx="14" fill="#f4fbfe" stroke="#1d6c86" strokeWidth="4" />
                <rect x="124" y="40" width="72" height="34" rx="6" fill="#bfe6f3" />
                <rect x="124" y="82" width="72" height="8" rx="4" fill="#d8eef6" /><rect x="124" y="98" width="52" height="8" rx="4" fill="#d8eef6" />
                <rect x="124" y="120" width="72" height="50" rx="6" fill="#9ed7ea" />
                <circle cx="66" cy="60" r="18" fill="#3b5fc4" /><text x="66" y="67" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="700">f</text>
                <circle cx="252" cy="52" r="16" fill="#e0405b" /><path d="M246 52l8-5v10z" fill="#fff" />
                <circle cx="262" cy="118" r="14" fill="#a06be0" /><circle cx="58" cy="128" r="14" fill="#f0a23a" />
                <path d="M40 200c20-30 40-40 62-34M280 200c-18-26-36-34-56-30" stroke="#1d6c86" strokeWidth="4" fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 500, letterSpacing: '.5px', opacity: .9 }}>SORA PEDIA</div>
              <h1>Social Media Marketing Panel Indonesia Terbaik</h1>
              <p>SORA PEDIA adalah platform SMM Panel yang menyediakan berbagai layanan social media marketing di Indonesia. Bergabunglah, lalu jadilah penyedia jasa sosial media atau reseller untuk followers, likes, views, komentar, subscribe, dan lainnya di Instagram, Facebook, Twitter, YouTube, TikTok, Threads, dan Telegram.</p>
              <p style={{ marginTop: '20px' }}><button className="btn-white" data-open-app=""><DashIcon />Dasbor</button></p>
            </div>
          </div>
        </section>

        <div className="stats">
          <div className="stat"><strong id="stUsers">0</strong><span>Pengguna Aktif</span></div>
          <div className="stat"><strong id="stOrders">0</strong><span>Pesanan Dikerjakan</span></div>
          <div className="stat"><strong id="stServices">0</strong><span>Layanan Tersedia</span></div>
        </div>

        <section className="blk about" id="layanan-l">
          <div className="logo"><Mark /><span><b>SORA</b> PEDIA</span></div>
          <div id="kontak">
            <h2>SORA PEDIA</h2>
            <p style={{ fontWeight: 600 }}>Panel SMM Indonesia</p>
            <p style={{ color: 'var(--muted)', margin: '8px 0 18px' }}>SMM Panel Indonesia adalah website penyedia layanan social media terlengkap, termurah, dan berkualitas.</p>
            <button className="btn" data-chat="">
              <svg className="i" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /></svg>Kontak Kami
            </button>
          </div>
        </section>

        <section className="why"><div className="why-in">
          <h2>Kenapa Harus SORA PEDIA?</h2>
          <div className="why-grid">
            <div className="why-item"><div className="ic"><svg className="i" viewBox="0 0 24 24"><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" /></svg></div><div><h3>Layanan Murah</h3><p>Booster sosial media dengan harga bersahabat untuk pemula maupun reseller.</p></div></div>
            <div className="why-item"><div className="ic"><svg className="i" viewBox="0 0 24 24"><path d="M7 11v9H3v-9zM7 11l4-8a2 2 0 012 2v4h6a2 2 0 012 2l-1.5 7a2 2 0 01-2 1.6H7" /></svg></div><div><h3>Layanan Termurah</h3><p>Kami berusaha memberikan layanan terbaik dengan harga paling rendah untuk pengguna.</p></div></div>
            <div className="why-item"><div className="ic"><svg className="i" viewBox="0 0 24 24"><path d="M12 21s-8-5-8-11a4.5 4.5 0 018-2.7A4.5 4.5 0 0120 10c0 6-8 11-8 11z" /></svg></div><div><h3>Pelayanan Terbaik</h3><p>Tim support siap membantu, dan kepuasan pelanggan adalah prioritas kami.</p></div></div>
          </div>
        </div></section>

        <section className="blk testi">
          <h2>Apa Kata Mereka?</h2>
          <div className="tcard">
            <button className="arrow" id="tPrev" aria-label="Ulasan sebelumnya"><svg className="i" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg></button>
            <div className="body" aria-live="polite"><q id="tQ"></q><div className="who"><span className="av" id="tA"></span><span><b id="tN"></b><br /><small id="tR" style={{ color: 'var(--muted)' }}></small></span></div></div>
            <button className="arrow" id="tNext" aria-label="Ulasan berikutnya"><svg className="i" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg></button>
          </div>
        </section>

        <section className="blk faq">
          <h2>Pertanyaan Umum</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>Berikut beberapa pertanyaan yang sering ditanyakan pelanggan terkait layanan kami.</p>
          <details open><summary>Apa itu SORA PEDIA?<svg className="i" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg></summary><p>SORA PEDIA adalah website booster sosial media marketing dengan layanan terbaik dan memuaskan.</p></details>
          <details><summary>Layanan apa saja yang tersedia?<svg className="i" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg></summary><p>Followers, likes, views, komentar, dan subscribe untuk Instagram, Facebook, Twitter, YouTube, TikTok, Threads, dan Telegram.</p></details>
          <details><summary>Bagaimana cara mendaftar?<svg className="i" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg></summary><p>Tekan tombol Dasbor, pilih Daftar, isi nama, email, dan password. Setelah itu deposit lalu mulai membuat pesanan.</p></details>
          <details><summary>Bagaimana cara deposit?<svg className="i" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg></summary><p>Masuk ke menu Deposit, isi nominal, lalu scan QRIS. Saldo bertambah otomatis setelah pembayaran terkonfirmasi.</p></details>
        </section>

        <footer className="ft">&copy; 2026 SORA PEDIA. Semua hak dilindungi.</footer>
      </div>

      {/* ===== AUTH ===== */}
      <dialog id="authDlg" aria-labelledby="authTitle">
        <div className="dlg">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 id="authTitle" style={{ fontSize: '22px' }}>Masuk ke Sora Pedia</h2>
            <button className="ib" id="authClose" aria-label="Tutup"><svg className="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          </div>
          <div className="tabs" role="tablist"><button className="on" data-tab="login" role="tab">Masuk</button><button data-tab="register" role="tab">Daftar</button></div>
          <div id="fName" className="hidden"><label htmlFor="aName">Nama</label><input id="aName" autoComplete="name" /></div>
          <label htmlFor="aEmail">Email</label><input id="aEmail" type="email" autoComplete="email" inputMode="email" />
          <label htmlFor="aPass">Password</label><input id="aPass" type="password" autoComplete="current-password" />
          <p className="hint" id="passHint" style={{ marginTop: '6px' }}></p>
          <p className="err" id="authErr" role="alert"></p>
          <button className="btn btn-full" id="authGo">Masuk</button>
        </div>
      </dialog>

      {/* ===== APP ===== */}
      <div id="app" className="hidden">
        <div className="top">
          <button className="ib" id="burgerApp" aria-label="Buka menu"><svg className="i" viewBox="0 0 24 24"><path d="M4 7h14M4 12h10M4 17h14" /></svg></button>
          <a href="#" className="logo" id="homeLink"><Mark /><span><b>SORA</b> PEDIA</span></a>
          <span className="sp"></span>
          <button className="ib" id="theme" aria-label="Ganti tema"><svg className="i" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></svg></button>
          <button className="avbtn" id="avBtn" aria-label="Menu akun" aria-expanded="false"><svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg></button>
        </div>
        <div className="dd hidden" id="dd">
          <div><b id="uName"></b><small id="uMail"></small></div>
          <div>Sisa Saldo : <b id="ddSaldo">Rp 0</b></div>
          <div>
            <button className="row" data-view="pengaturan"><svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6M17 15v6M14 18h6" /></svg>Pengaturan Akun</button>
            <button className="row" id="logout"><svg className="i" viewBox="0 0 24 24"><path d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4M16 8l4 4-4 4M20 12H9" /></svg>Keluar</button>
          </div>
        </div>
        <div className="scrim hidden" id="scrim"></div>
        <aside className="side" id="side" aria-label="Menu dasbor"></aside>
        <main className="main" id="main"></main>
        <nav className="tabbar" id="tabbar" aria-label="Menu cepat"></nav>
      </div>

      <button className="chat hidden" id="chatBtn" aria-label="Kontak admin"><svg className="i" viewBox="0 0 24 24" style={{ fill: '#fff', stroke: '#fff' }}><path d="M4 4h16a1 1 0 011 1v10a1 1 0 01-1 1h-8l-5 4v-4H4a1 1 0 01-1-1V5a1 1 0 011-1z" /></svg></button>
      <div className="chatbox hidden" id="chatBox">
        <header>Butuh bantuan?</header>
        <div className="body"><p>Kirim tiket lewat menu <b>Tiket</b> di dasbor, admin akan membalas secepatnya.</p><button className="btn btn-full" id="chatTicket">Buka Tiket</button></div>
      </div>

      <LandingBoot />
    </>
  );
}

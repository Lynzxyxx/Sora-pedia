# Sora Pedia - SMM Panel

Website SMM Panel siap deploy ke **Vercel**, dibangun dengan **Next.js (App Router)**.
Frontend di `app/` + API lewat **Route Handlers** (`app/api/**/route.js`) + **Firebase Realtime Database** + deposit otomatis **BuatQRIS** + **Admin Panel** (`/admin`).

## Struktur

```
app/
  layout.js               root layout (font, metadata, globals.css)
  globals.css             stylesheet (sebelumnya public/style.css)
  page.js                 landing + dasbor pengguna (sebelumnya public/index.html)
  LandingBoot.js          pemicu logika frontend setelah markup ter-mount
  admin/page.js           halaman admin (metadata noindex)
  admin/AdminPanel.js     markup admin (sebelumnya public/admin.html)
  api/**/route.js         Route Handler Next.js untuk tiap endpoint /api/*
lib/
  handlers.js             logika bisnis tiap endpoint (sebelumnya lib/routes.js)
  route.js                adapter body + error handling untuk Route Handler
  firebase.js, auth.js, buatqris.js, provider.js, defaultServices.js, http.js
  client/landing.js       logika frontend (sebelumnya public/app.js)
  client/admin.js         logika admin panel (sebelumnya public/admin.js)
next.config.mjs           header keamanan (sebelumnya vercel.json)
database.rules.json       aturan Realtime Database (semua akses lewat server)
.env.example              daftar environment variable
```

Routing `/api/*` kini ditangani otomatis oleh struktur folder `app/api/**`, jadi tidak ada lagi
`api/[...path].js` maupun `vercel.json`.

## Runtime

Node.js **22 LTS** (`engines.node: 22.x`, lihat juga `.nvmrc`). Kalau mau memakai Node 24 di Vercel,
ubah `engines.node` menjadi `24.x` lalu pilih versi Node yang sama di **Project Settings > Node.js Version**.

## Langkah deploy

1. **Firebase**
   - Buka Firebase Console, project `sorapay-53345`, Realtime Database sudah aktif.
   - Menu **Rules**: tempel isi `database.rules.json` lalu Publish. Rules ini mengunci akses langsung dari klien; semua data diakses lewat server (Admin SDK).
   - Menu **Project settings > Service accounts > Generate new private key**. Dari file JSON ambil `project_id`, `client_email`, `private_key`.

2. **Upload ke GitHub** (file `.env` jangan ikut, sudah ada di `.gitignore`), lalu **Import Project** di Vercel. Framework Preset: **Next.js** (terdeteksi otomatis). Build command bawaan `next build`.

3. **Environment Variables** di Vercel (Settings > Environment Variables). Nama dan penjelasan lengkap ada di `.env.example`:

   | Variable | Isi |
   |---|---|
   | `SESSION_SECRET` | string acak minimal 32 karakter |
   | `SITE_URL` | URL website, mis. `https://sorapedia.vercel.app` |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | akun untuk login `/admin` |
   | `FIREBASE_DATABASE_URL` | `https://sorapay-53345-default-rtdb.asia-southeast1.firebasedatabase.app` |
   | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | dari service account |
   | `BUATQRIS_ACCOUNT_ID`, `BUATQRIS_SECRET_TOKEN` | dari dasbor BuatQRIS > Open API |
   | `BUATQRIS_BASE_URL` | `https://api.buatqris.site` |
   | `BUATQRIS_WEBHOOK_SECRET` | Signing Secret webhook dari dasbor BuatQRIS |
   | `PROVIDER_API_URL`, `PROVIDER_API_KEY` | (opsional) provider layanan SMM |

   Setelah mengubah env, lakukan **Redeploy**.

4. **Webhook BuatQRIS**: di dasbor BuatQRIS > Open API > Webhook / Callback, isi **Callback URL 1** dengan
   `https://DOMAIN-KAMU/api/webhook/buatqris`, lalu salin **Signing Secret** ke `BUATQRIS_WEBHOOK_SECRET`.
   Deposit juga dicek berkala dari halaman deposit (fallback kalau webhook terlambat).

5. Uji dulu dengan `BUATQRIS_TEST=1` (sandbox), lalu ubah ke `0` untuk produksi.

## Cara kerja deposit otomatis

1. User isi nominal, server memanggil `api_create_qris` (Secret Token hanya ada di server).
2. QR ditampilkan di halaman deposit, user membayar lewat e-wallet / m-banking.
3. BuatQRIS mengirim webhook `payment.success` bertanda tangan HMAC-SHA256. Server membaca **raw body** lewat `request.text()`, memverifikasi signature dan nominal, lalu menambah saldo sekali saja (aman dari kredit ganda).

## Admin Panel (`/admin`)

Ringkasan, kelola pengguna (ubah saldo, blokir), pesanan (ubah status, refund otomatis), riwayat deposit, layanan (tambah/edit/hapus, impor dari provider dengan markup), berita, tiket, dan pengaturan deposit/markup.

## Catatan keamanan

- Jangan simpan Secret Token, password admin, atau private key di kode / GitHub. Semuanya hanya di Environment Variables.
- Ganti password admin secara berkala. Login admin dan user dibatasi setelah 5x gagal.
- Layanan contoh di database bersifat contoh; ganti dengan layanan aslimu di Admin Panel.

## Jalankan lokal

```
npm install
npm run dev     # http://localhost:3000
npm run lint
npm run build
```
Buat file `.env.local` dari `.env.example`.

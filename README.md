# Sora Pedia - SMM Panel

Website SMM Panel siap deploy ke **Vercel**.
Frontend statis (`public/`) + API serverless (`api/`) + **Firebase Realtime Database** + deposit otomatis **BuatQRIS** + **Admin Panel** (`/admin`).

## Struktur

```
public/            index.html (landing + dasbor), admin.html, app.js, admin.js, style.css
api/[...path].js   satu fungsi serverless untuk semua endpoint /api/*
lib/               firebase, auth, buatqris (deposit), provider (layanan SMM), routes
database.rules.json  aturan Realtime Database (semua akses lewat server)
.env.example       daftar environment variable
```

## Langkah deploy

1. **Firebase**
   - Buka Firebase Console, project `sorapay-53345`, Realtime Database sudah aktif.
   - Menu **Rules**: tempel isi `database.rules.json` lalu Publish. Rules ini mengunci akses langsung dari klien; semua data diakses lewat server (Admin SDK).
   - Menu **Project settings > Service accounts > Generate new private key**. Dari file JSON ambil `project_id`, `client_email`, `private_key`.

2. **Upload ke GitHub** (file `.env` jangan ikut, sudah ada di `.gitignore`), lalu **Import Project** di Vercel. Framework Preset: **Other**. Tidak perlu build command.

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
3. BuatQRIS mengirim webhook `payment.success` bertanda tangan HMAC-SHA256. Server memverifikasi signature dan nominal, lalu menambah saldo sekali saja (aman dari kredit ganda).

## Admin Panel (`/admin`)

Ringkasan, kelola pengguna (ubah saldo, blokir), pesanan (ubah status, refund otomatis), riwayat deposit, layanan (tambah/edit/hapus, impor dari provider dengan markup), berita, tiket, dan pengaturan deposit/markup.

## Catatan keamanan

- Jangan simpan Secret Token, password admin, atau private key di kode / GitHub. Semuanya hanya di Environment Variables.
- Ganti password admin secara berkala. Login admin dan user dibatasi setelah 5x gagal.
- Layanan contoh di database bersifat contoh; ganti dengan layanan aslimu di Admin Panel.

## Jalankan lokal

```
npm install
npx vercel dev
```
Buat file `.env.local` dari `.env.example`.

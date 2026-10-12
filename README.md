# Nilai Siswa (PWA) — satu Cloudflare Worker + D1

Struktur: `frontend/` (halaman statis) · `backend/` (kode API + `schema.sql`) · `wrangler.jsonc` di root.
Satu Worker melayani `frontend/` sebagai aset dan menangani `/api/*` lewat `backend/src/index.js`.

## Setup sekali saja
```bash
npm install
npx wrangler login
npx wrangler d1 create nilai-siswa        # salin database_id ke wrangler.jsonc
npm run db:remote                         # membuat tabel di D1
# Jika database SUDAH dibuat dari versi lama: npx wrangler d1 execute nilai-siswa --remote --file=backend/migrations/001_add_jk.sql
```
(Tanpa terminal: buat database `nilai-siswa` di dashboard Cloudflare > D1, tempel isi `backend/schema.sql` di tab Console, lalu isi `database_id` di `wrangler.jsonc`.)

## Deploy lewat GitHub (Workers Builds)
Pengaturan di dashboard: Root directory kosong atau `/`, Build command kosong, Deploy command `npx wrangler deploy`. Setiap push ke `main` otomatis deploy.

## Uji lokal
```bash
npm run db:local
npm run dev        # buka http://localhost:8787
```

⚠️ Belum ada autentikasi: siapa pun yang tahu alamat Worker bisa membaca/mengubah data. Pasang Cloudflare Access sebelum memakai data siswa sungguhan.

## Mengubah tampilan
Tampilan memakai Tailwind yang dikompilasi ke `frontend/tailwind.css` (sudah disertakan). Setelah mengubah kelas CSS di `frontend/app.js` / `index.html`: `npm install && npm run css`, lalu commit hasilnya.

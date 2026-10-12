# Nilai Siswa (PWA)
- `frontend/` — HTML/JS statis tanpa build. Tes lokal: `cd frontend && npx serve .` · Deploy: Cloudflare Pages, build command kosong, output directory `frontend`.
- `backend/` — Cloudflare Worker + D1 (belum dipakai frontend). `cd backend && npx wrangler d1 create nilai-siswa`, isi `database_id`, `npx wrangler d1 execute nilai-siswa --remote --file=schema.sql`, `npx wrangler deploy`.
- Menyambungkan: ganti isi `load()`/`save()` di `frontend/api.js` dengan `fetch` ke `/api/state`.

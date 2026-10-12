# Nilai Siswa (PWA) — Cloudflare Pages + Workers + D1

## 1. Backend (Worker + D1)
```bash
cd backend && npm i
npx wrangler login
npx wrangler d1 create nilai-siswa            # salin database_id ke wrangler.toml
npx wrangler d1 execute nilai-siswa --remote --file=schema.sql
npx wrangler deploy                           # catat URL Worker-nya
```
Uji lokal: `npx wrangler d1 execute nilai-siswa --local --file=schema.sql && npx wrangler dev` (port 8787).

## 2. Frontend (Pages)
- Edit `frontend/config.js`: ganti `GANTI-DENGAN-URL-WORKER` dengan URL Worker (akhiran `/api`).
- Lokal: `cd frontend && npx serve .` (otomatis memakai http://localhost:8787/api).
- Deploy: Cloudflare Pages, build command kosong, output directory `frontend`.

## Tabel D1
`students` (master: id, nisn, nama) · `years` · `enrollments` (kelas per tahun) · `scores` (Bab1-5, STS, SAS per semester) · `settings` (mapel & bobot).

## Impor siswa
Tab "Impor Excel": .xlsx/.xls/.csv, kolom Nama / NISN / Kelas dikenali otomatis. Siswa dicocokkan lewat NISN (atau nama bila NISN kosong), jadi impor ulang memperbarui, tidak menggandakan.

⚠️ Belum ada autentikasi: siapa pun yang tahu URL Worker bisa membaca/mengubah data. Tambahkan Cloudflare Access sebelum dipakai dengan data asli.

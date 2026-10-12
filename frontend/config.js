// Alamat API Worker. Lokal: `npx wrangler dev` (port 8787). Produksi: ganti dengan URL Worker Anda.
export const API_BASE = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://localhost:8787/api'
  : 'https://nilai.serojo.workers.dev/api';

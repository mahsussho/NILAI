// Membaca Excel/CSV -> daftar siswa {name, nisn, kelas}. SheetJS dimuat saat dibutuhkan (tersedia offline).
let loading;
export function loadX() {
  if (globalThis.XLSX) return Promise.resolve(globalThis.XLSX);
  return loading ??= new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = 'vendor/xlsx.full.min.js';
    s.onload = () => ok(globalThis.XLSX); s.onerror = () => no(new Error('Gagal memuat pustaka Excel')); document.head.appendChild(s);
  });
}
const norm = v => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const ROMAN = { I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6' };
export function normKelas(v) {
  const s = String(v ?? '').trim().toUpperCase().replace(/^(KELAS|KLS)\s*/, '');
  if (!s) return '';
  if (s === 'LULUS') return 'Lulus';
  if (ROMAN[s]) return ROMAN[s];
  const m = s.match(/^([1-6])([A-Z]?)$/); return m ? m[1] : '';
}
const isName = h => /^(nama|nama siswa|nama lengkap|nama peserta didik|siswa|peserta didik)$/.test(h);
const isNisn = h => h === 'nisn';
const isJk = h => /^(jk|l\/p|lp|jenis kelamin|gender)$/.test(h);
const isKelas = h => /^(kelas|kls|rombel|rombongan belajar)$/.test(h);

export async function parseFile(file) {
  const X = await loadX();
  const isText = /\.(csv|txt|tsv)$/i.test(file.name);
  const wb = isText ? X.read(await file.text(), { type: 'string' }) : X.read(await file.arrayBuffer(), { type: 'array' });
  const rows = []; let used = 0;
  for (const name of wb.SheetNames) {
    const data = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
    const hi = data.slice(0, 10).findIndex(r => r.some(c => isName(norm(c))));
    if (hi < 0) continue;
    const h = data[hi].map(norm), cn = h.findIndex(isName), cs = h.findIndex(isNisn), ck = h.findIndex(isKelas), cj = h.findIndex(isJk);
    const sheetKelas = (name.match(/(?:kelas|kls)\s*([1-6])/i) || [])[1] || '';
    used++;
    for (const r of data.slice(hi + 1)) {
      const nm = String(r[cn] ?? '').trim().replace(/\s+/g, ' ');
      if (!nm) continue;
      rows.push({ name: nm, jk: cj >= 0 ? String(r[cj] ?? '').trim() : '', nisn: cs >= 0 ? String(r[cs] ?? '').trim() : '', kelas: (ck >= 0 ? normKelas(r[ck]) : '') || sheetKelas, kelasRaw: ck >= 0 ? String(r[ck] ?? '').trim() : '' });
    }
  }
  if (!used) throw new Error('Kolom "Nama" tidak ditemukan. Pastikan ada baris judul berisi kolom Nama (serta NISN, Kelas bila ada) di 10 baris pertama.');
  return rows;
}
export const TEMPLATE = '\ufeffNama,NISN,Kelas,JK\nAhmad Fauzi,0012345678,3,L\nBinti Aisyah,0012345679,3,P\n';

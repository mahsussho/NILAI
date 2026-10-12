import { api } from './api.js';
import { API_BASE } from './config.js';
import { parseFile, loadX, TEMPLATE } from './importer.js';
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

const $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BABS = ['b1', 'b2', 'b3', 'b4', 'b5'], FIELDS = [...BABS, 'sts', 'sas'], KELAS = ['1', '2', '3', '4', '5', '6'];
let S;
const ui = { tab: 'siswa', year: null, sem: '1', mKelas: 'ALL', mq: '', aTa: 'ALL', aSmt: 'ALL', aKelas: 'ALL', aq: '', imp: null };

// ---------- perhitungan ----------
const blank = v => v === '' || v == null || isNaN(v);
function nilaiAkhir(sc) {
  const st = S.settings;
  if (!sc || blank(sc.sts) || blank(sc.sas)) return null;
  const b = BABS.map(k => sc[k]).filter(v => !blank(v)).map(Number); if (!b.length) return null;
  const avg = b.reduce((a, c) => a + c, 0) / b.length, w = st.wBab + st.wSts + st.wSas || 1;
  return Math.round((avg * st.wBab + sc.sts * st.wSts + sc.sas * st.wSas) / w);
}
const predOf = n => n == null ? '-' : n >= 88 ? 'A' : n >= 76 ? 'B' : n >= 65 ? 'C' : 'D';
const PRED_CLS = { A: 'bg-emerald-100 text-emerald-800 border-emerald-300', B: 'bg-blue-100 text-blue-800 border-blue-300', C: 'bg-amber-100 text-amber-800 border-amber-300', D: 'bg-rose-100 text-rose-800 border-rose-300' };
const badge = p => PRED_CLS[p] ? `<span class="px-2 py-0.5 rounded font-bold border ${PRED_CLS[p]}">${p}</span>` : '<span class="text-slate-400 font-bold">-</span>';
const hasScore = sc => sc && FIELDS.some(k => !blank(sc[k]));

// ---------- data ----------
const yr = id => S.years.find(y => y.id === id), cur = () => yr(ui.year);
const years = () => [...S.years].sort((a, b) => b.id.localeCompare(a.id));
const scoreOf = (y, sid, sem) => y.scores?.[sid]?.[sem] || {};
const kNum = k => k === 'Lulus' ? 7 : +k;
const byKelasNama = (a, b) => kNum(a.kelas) - kNum(b.kelas) || a.name.localeCompare(b.name);
const toast = m => { const t = $('#toast'); t.textContent = m; t.style.opacity = 1; clearTimeout(toast.t); toast.t = setTimeout(() => t.style.opacity = 0, 2800); };
const nextYear = id => id ? `${+id.split('/')[0] + 1}/${+id.split('/')[1] + 1}` : '';
const prevYear = id => id ? `${+id.split('/')[0] - 1}/${+id.split('/')[1] - 1}` : '';

let pending = 0, lastErr = '';function track(p) { pending++; return p.then(() => { pending--; lastErr = ''; }, e => { pending--; lastErr = e.message; toast('Gagal menyimpan: ' + e.message); }); }
async function act(fn) { try { await fn(); } catch (e) { toast(e.message); } }
const timers = {};
function queueScore(yid, sid, sem, now) {
  const k = [yid, sid, sem].join('|'); clearTimeout(timers[k]);
  const go = () => { delete timers[k]; const sc = yr(yid)?.scores?.[sid]?.[sem]; if (sc) return track(api.saveScore(yid, sid, sem, sc)); };
  if (now) return go(); timers[k] = setTimeout(go, 500); timers[k].go = go;
}
const flushAll = () => { Object.entries(timers).forEach(([k, t]) => { clearTimeout(t); t.go?.(); }); };
document.addEventListener('visibilitychange', () => document.hidden && flushAll());
async function reload() { S = await api.load(); renderAll(); }

// ---------- kerangka ----------
function renderHeader() {
  $('#app-title').textContent = 'ARSIP NILAI ' + S.settings.mapel.toUpperCase();
  $('#ta').innerHTML = years().map(y => `<option value="${y.id}" class="text-slate-800" ${y.id === ui.year ? 'selected' : ''}>${y.id}</option>`).join('') || '<option class="text-slate-800">—</option>';
  $('#smt').value = ui.sem;
}
function renderTabs() {
  const n = cur()?.students.length ?? 0, on = 'bg-emerald-700 text-white shadow-sm', off = 'text-emerald-200 hover:text-white hover:bg-emerald-800/60';
  $('#tabs').innerHTML = `<button data-tab="siswa" class="px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${ui.tab === 'siswa' ? on : off}"><span>👥</span> Data Siswa (Master) <span class="px-1.5 rounded-full bg-emerald-900/80 text-[11px] font-mono">${n}</span></button>
  <div class="h-6 w-px bg-white/20 self-center mx-1"></div>
  ${KELAS.map(k => `<button data-tab="${k}" class="px-3.5 py-2 rounded-lg transition-all ${ui.tab === k ? on : off}">Kelas ${k}</button>`).join('')}
  <div class="h-6 w-px bg-white/20 self-center mx-1"></div>
  <button data-tab="arsip" class="ml-auto px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${ui.tab === 'arsip' ? on : off}"><span>📑</span> Arsip & Leger</button>`;
}
function renderAll() {
  if (S.years.length && !yr(ui.year)) ui.year = years()[0].id;
  renderHeader(); renderTabs();
  if (!S.years.length) {
    $('#main').innerHTML = `<div class="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm"><span class="text-4xl block mb-2">🗓️</span>
    <p class="font-bold text-slate-800">Belum ada tahun ajaran</p><p class="text-sm text-slate-500 mb-4">Buat tahun ajaran dulu (boleh tahun lama), lalu impor siswa.</p>
    <button data-act="new-year" class="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2 rounded-lg">+ Buat Tahun Ajaran</button></div>`; return;
  }
  ({ siswa: viewSiswa, arsip: viewArsip }[ui.tab] || (() => viewKelas(ui.tab)))();
}

// ---------- komponen gaya ----------
const BTN = 'px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition flex items-center gap-1.5 ';
const B_PRI = BTN + 'bg-brand-600 hover:bg-brand-700 text-white border-brand-700 shadow-sm', B_SEC = BTN + 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300';
const INP = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const CARD = 'bg-white rounded-2xl shadow-sm border border-slate-200';
const TH = 'py-3 px-3 border border-slate-700';
const kelasOpts = (sel, all, lulus) => `${all ? `<option value="ALL" ${sel === 'ALL' ? 'selected' : ''}>${all}</option>` : ''}${KELAS.map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>Kelas ${k}</option>`).join('')}${lulus ? `<option value="Lulus" ${sel === 'Lulus' ? 'selected' : ''}>Lulus</option>` : ''}`;

// ---------- Tab: Data Siswa ----------
function viewSiswa() {
  $('#main').innerHTML = `<section class="space-y-5">
  <div class="${CARD} p-4 flex flex-wrap items-center justify-between gap-3">
    <div><h2 class="text-lg font-bold flex items-center gap-2"><span>📚</span> Master Data Siswa — T.A ${esc(ui.year)}</h2>
    <p class="text-xs text-slate-500 mt-0.5">Impor satu file Excel/CSV (boleh multi-sheet "KELAS 1" … "KELAS 6") atau tambah manual. Siswa dengan NISN sama diperbarui, bukan digandakan.</p></div>
    <div class="flex flex-wrap items-center gap-2.5">
      <button data-act="import" class="${B_PRI}"><span>📥</span> Impor Excel (Semua Kelas)</button>
      <button data-act="tpl" class="${B_SEC}"><span>📄</span> Unduh Template</button>
      <button data-act="add" class="${B_SEC}">+ Tambah Siswa</button></div></div>
  <div class="${CARD} p-3 flex flex-wrap items-center justify-between gap-3">
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-2"><span class="text-xs font-semibold text-slate-500">Filter Tingkat:</span>
        <select data-f="mKelas" class="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">${kelasOpts(ui.mKelas, 'Semua Kelas (1 s.d 6)', true)}</select></div>
      <div class="relative sm:w-64"><input data-f="mq" value="${esc(ui.mq)}" placeholder="Cari nama atau NISN..." class="${INP} pl-8 py-1.5"><span class="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span></div></div>
    <div class="text-xs text-slate-500 font-medium">Menampilkan <span id="cnt" class="font-bold text-slate-800">0</span> siswa</div></div>
  <div class="${CARD} overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-xs sm:text-sm text-left border-collapse">
    <thead><tr class="bg-slate-800 text-white font-semibold text-center"><th class="py-3 px-3 w-12">NO</th><th class="py-3 px-3 w-24">KELAS</th><th class="py-3 px-3 w-32">NISN</th><th class="py-3 px-4 text-left">NAMA LENGKAP SISWA</th><th class="py-3 px-3 w-20">L/P</th><th class="py-3 px-3 w-28">AKSI</th></tr></thead>
    <tbody id="tb" class="divide-y divide-slate-100 text-slate-700"></tbody></table></div></div></section>`;
  rowsSiswa();
}
function rowsSiswa() {
  const q = ui.mq.toLowerCase().trim();
  const list = cur().students.filter(s => (ui.mKelas === 'ALL' || s.kelas === ui.mKelas) && (!q || s.name.toLowerCase().includes(q) || (s.nisn || '').includes(q))).sort(byKelasNama);
  $('#cnt').textContent = list.length;
  $('#tb').innerHTML = list.length ? list.map((s, i) => `<tr class="hover:bg-slate-50">
    <td class="py-2.5 px-3 text-center font-medium text-slate-500">${i + 1}</td>
    <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">${s.kelas === 'Lulus' ? 'Lulus' : 'Kelas ' + s.kelas}</span></td>
    <td class="py-2.5 px-3 text-center font-mono text-slate-600">${esc(s.nisn || '-')}</td>
    <td class="py-2.5 px-4 font-semibold text-slate-800">${esc(s.name)}</td>
    <td class="py-2.5 px-3 text-center font-medium">${s.jk || '-'}</td>
    <td class="py-2.5 px-3 text-center space-x-1"><button data-act="edit" data-id="${s.id}" class="p-1 text-slate-500 hover:text-emerald-700" title="Edit">✏️</button><button data-act="del" data-id="${s.id}" class="p-1 text-slate-500 hover:text-rose-600" title="Hapus">🗑️</button></td></tr>`).join('')
    : `<tr><td colspan="6" class="text-center py-10 text-slate-400"><span class="text-3xl block mb-2">📂</span>Tidak ada data siswa. Klik "Impor Excel" atau "+ Tambah Siswa".</td></tr>`;
}

// ---------- Tab: Lembar Nilai Kelas ----------
const sheetList = k => cur().students.filter(s => s.kelas === k).sort((a, b) => a.name.localeCompare(b.name));
function viewKelas(k) {
  const st = S.settings, w = st.wBab + st.wSts + st.wSas;
  $('#main').innerHTML = `<section class="space-y-5">
  <div class="${CARD} p-4 flex flex-wrap items-center justify-between gap-3">
    <div><div class="flex items-center gap-3"><h2 class="text-lg font-bold">Lembar Penilaian - Kelas ${k}</h2>
      <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">T.A ${esc(ui.year)} • Semester ${ui.sem}</span></div>
    <p class="text-xs text-slate-500 mt-1">Siswa diambil dari <strong>Data Siswa</strong>. Nilai Akhir dan Predikat terhitung otomatis; nilai tersimpan otomatis ke database.</p></div>
    <div class="flex flex-wrap items-center gap-2">
      <button data-act="xl-kelas" class="${B_SEC}"><span>📊</span> Ekspor Excel (XLSX)</button></div></div>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
    <div class="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5"><span class="text-emerald-700 text-base">📐</span><div class="flex-1">
      <p class="font-bold text-emerald-950">Rumus Nilai Akhir (${esc(st.mapel)}):</p>
      <p class="text-emerald-800">NA = Round((Rerata Bab × ${st.wBab} + STS × ${st.wSts} + SAS × ${st.wSas}) / ${w})</p>
      <button data-act="settings" class="mt-1 underline font-semibold text-emerald-900">⚙️ Ubah bobot / mapel</button></div></div>
    <div class="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5"><span class="text-amber-700 text-base">🏷️</span><div><p class="font-bold text-amber-950">Standar Predikat:</p><p class="text-amber-800">A (&ge;88), B (76-87), C (65-75), D (&lt;65)</p></div></div>
    <div class="bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5"><span class="text-blue-700 text-base">⚡</span><div><p class="font-bold text-blue-950">Penyimpanan Terpadu:</p><p class="text-blue-800">Perubahan disimpan otomatis ke database per T.A & Semester.</p></div></div></div>
  <div class="${CARD} overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-xs sm:text-sm text-left border-collapse">
    <thead><tr class="bg-slate-800 text-white text-center font-semibold"><th class="${TH} w-12">NO</th><th class="${TH} w-28">NISN</th><th class="${TH} min-w-[200px] text-left">NAMA SISWA</th>
    ${[1, 2, 3, 4, 5].map(i => `<th class="${TH} w-16">BAB ${i}</th>`).join('')}<th class="${TH} w-16 bg-slate-700">STS</th><th class="${TH} w-16 bg-slate-700">SAS</th>
    <th class="${TH} w-20 bg-emerald-900 font-bold">RAPORT</th><th class="${TH} w-14 bg-emerald-950 font-bold">PRED</th><th class="${TH} w-14">AKSI</th></tr></thead>
    <tbody id="tb" class="divide-y divide-slate-200"></tbody>
    <tfoot><tr class="bg-slate-50 font-bold text-center text-slate-700 border-t-2 border-slate-300"><td colspan="3" class="py-2.5 px-3 text-right">RATA-RATA KELAS:</td>
    ${[...FIELDS, 'rapor', 'pred'].map(f => `<td class="p-2 ${f === 'rapor' ? 'bg-emerald-100 text-emerald-900 font-black text-sm' : ''}" id="avg-${f}">-</td>`).join('')}<td class="no-print"></td></tr></tfoot></table></div></div></section>`;
  rowsKelas(k);
}
function rowsKelas(k) {
  const y = cur(), list = sheetList(k);
  $('#tb').innerHTML = list.length ? list.map((s, i) => {
    const sc = scoreOf(y, s.id, ui.sem), na = nilaiAkhir(sc);
    return `<tr class="hover:bg-slate-50"><td class="py-1.5 px-2 text-center text-slate-500">${i + 1}</td><td class="py-1.5 px-3 text-center font-mono text-slate-600">${esc(s.nisn || '-')}</td><td class="py-1.5 px-3 font-semibold text-slate-800">${esc(s.name)}</td>
    ${FIELDS.map(f => `<td class="p-1"><input type="number" min="0" max="100" inputmode="numeric" data-sid="${s.id}" data-fld="${f}" value="${sc[f] ?? ''}" class="w-full text-center border border-slate-200 rounded-md py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"></td>`).join('')}
    <td class="py-1.5 px-2 text-center font-extrabold text-emerald-800 bg-emerald-50" id="r-${s.id}">${na ?? '-'}</td><td class="py-1.5 px-2 text-center" id="p-${s.id}">${badge(predOf(na))}</td>
    <td class="py-1.5 px-2 text-center"><button data-act="clear" data-id="${s.id}" class="text-slate-400 hover:text-rose-600" title="Kosongkan nilai siswa ini">🧹</button></td></tr>`;
  }).join('') : `<tr><td colspan="14" class="text-center py-10 text-slate-400"><span class="text-3xl block mb-2">📂</span>Belum ada siswa Kelas ${k} di T.A ini. Tambahkan di tab Data Siswa.</td></tr>`;
  footers(k);
}
function footers(k) {
  const y = cur(), list = sheetList(k), scs = list.map(s => scoreOf(y, s.id, ui.sem));
  const avg = a => { a = a.filter(v => !blank(v)).map(Number); return a.length ? +(a.reduce((x, c) => x + c, 0) / a.length).toFixed(1) : null; };
  FIELDS.forEach(f => $('#avg-' + f).textContent = avg(scs.map(c => c[f])) ?? '-');
  const r = avg(scs.map(nilaiAkhir)); $('#avg-rapor').textContent = r ?? '-'; $('#avg-pred').innerHTML = badge(predOf(r));
}

// ---------- Tab: Arsip & Leger ----------
function viewArsip() {
  $('#main').innerHTML = `<section class="space-y-5"><div class="${CARD} p-5">
  <div class="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h2 class="text-lg font-bold flex items-center gap-2"><span>🗄️</span> Leger & Rekapitulasi Arsip Nilai ${esc(S.settings.mapel)}</h2>
    <p class="text-xs text-slate-500">Filter lintas tahun ajaran, lalu unduh atau cetak laporan.</p></div>
    <div class="flex items-center gap-2"><button data-act="xl-arsip" class="${B_SEC}"><span>📊</span> Unduh Rekap (XLSX)</button><button data-act="print" class="${B_SEC}"><span>🖨️</span> Cetak Laporan</button></div></div>
  <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Tahun Ajaran</label><select data-f="aTa" class="${INP}"><option value="ALL">Semua Tahun Ajaran</option>${years().map(y => `<option ${y.id === ui.aTa ? 'selected' : ''}>${y.id}</option>`).join('')}</select></div>
    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Semester</label><select data-f="aSmt" class="${INP}"><option value="ALL">Semua Semester</option><option value="1" ${ui.aSmt === '1' ? 'selected' : ''}>Semester 1 (Ganjil)</option><option value="2" ${ui.aSmt === '2' ? 'selected' : ''}>Semester 2 (Genap)</option></select></div>
    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Tingkat Kelas</label><select data-f="aKelas" class="${INP}">${kelasOpts(ui.aKelas, 'Semua Kelas (1 - 6)', true)}</select></div>
    <div><label class="block text-xs font-semibold text-slate-600 mb-1">Cari Nama / NISN</label><input data-f="aq" value="${esc(ui.aq)}" placeholder="Ketik kata kunci..." class="${INP}"></div></div></div>
  <div id="print-area" class="${CARD} overflow-hidden p-1"><div class="hidden print:block p-4 text-center border-b border-slate-400 mb-4"><h2 class="text-xl font-bold uppercase tracking-wider">ARSIP & LEGER NILAI ${esc(S.settings.mapel)}</h2><p class="text-sm text-slate-600">REKAPITULASI RESMI PENILAIAN</p></div>
  <div class="overflow-x-auto"><table class="w-full text-xs text-left border-collapse"><thead class="bg-slate-800 text-white font-semibold text-center"><tr>
    ${['NO', 'T.A', 'SMT', 'KLS', 'NISN', 'NAMA SISWA', 'BAB 1', 'BAB 2', 'BAB 3', 'BAB 4', 'BAB 5', 'STS', 'SAS', 'RAPORT', 'PRED'].map((h, i) => `<th class="py-2 px-2 border border-slate-600 ${i === 4 || i === 5 ? 'text-left' : ''} ${i === 13 ? 'bg-emerald-900' : ''} ${i === 14 ? 'bg-emerald-950' : ''}">${h}</th>`).join('')}</tr></thead>
    <tbody id="tb" class="divide-y divide-slate-200"></tbody></table></div><p id="cnt" class="text-xs text-slate-500 p-2 no-print"></p></div></section>`;
  rowsArsip();
}
function arsipData() {
  const q = ui.aq.toLowerCase().trim(), out = [];
  [...S.years].sort((a, b) => b.id.localeCompare(a.id)).forEach(y => {
    if (ui.aTa !== 'ALL' && y.id !== ui.aTa) return;
    ['1', '2'].forEach(sm => { if (ui.aSmt !== 'ALL' && ui.aSmt !== sm) return;
      y.students.filter(s => (ui.aKelas === 'ALL' || s.kelas === ui.aKelas) && (!q || s.name.toLowerCase().includes(q) || (s.nisn || '').includes(q))).sort(byKelasNama).forEach(s => {
        const sc = scoreOf(y, s.id, sm); if (hasScore(sc)) out.push({ ta: y.id, sm, s, sc, na: nilaiAkhir(sc) }); }); });
  });
  return out;
}
function rowsArsip() {
  const d = arsipData();
  $('#tb').innerHTML = d.length ? d.map((r, i) => `<tr class="hover:bg-slate-50"><td class="py-1.5 px-2 text-center">${i + 1}</td><td class="px-2 text-center">${r.ta}</td><td class="px-1 text-center">${r.sm}</td><td class="px-2 text-center">${r.s.kelas}</td>
    <td class="px-3 font-mono">${esc(r.s.nisn || '-')}</td><td class="px-3 font-semibold">${esc(r.s.name)}</td>${FIELDS.map(f => `<td class="px-1 text-center">${r.sc[f] ?? '-'}</td>`).join('')}
    <td class="px-2 text-center font-extrabold text-emerald-800 bg-emerald-50">${r.na ?? '-'}</td><td class="px-2 text-center">${badge(predOf(r.na))}</td></tr>`).join('')
    : '<tr><td colspan="15" class="text-center py-10 text-slate-400">Tidak ada nilai yang cocok dengan filter.</td></tr>';
  $('#cnt').textContent = `${d.length} baris`;
}

// ---------- Excel ----------
async function saveXlsx(aoa, sheet, name) { const X = await loadX(), wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), sheet); X.writeFile(wb, name); }
const H = ['Bab 1', 'Bab 2', 'Bab 3', 'Bab 4', 'Bab 5', 'STS', 'SAS', 'Raport', 'Pred'];
const dl = (b, n) => { const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = n; l.click(); };

// ---------- Modal ----------
const modal = html => { $('#modal-box').innerHTML = html; $('#modal').classList.remove('hidden'); };
const closeModal = () => { $('#modal').classList.add('hidden'); ui.imp = null; };
const mHead = (t, sub) => `<div class="flex items-start justify-between pb-3 border-b border-slate-200"><div><h3 class="text-base font-bold text-slate-800">${t}</h3>${sub ? `<p class="text-xs text-slate-500">${sub}</p>` : ''}</div><button data-act="close" class="text-slate-400 hover:text-slate-600 text-2xl font-bold leading-none">&times;</button></div>`;
const mFoot = (ok, label) => `<div class="mt-5 pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5"><button data-act="close" class="${B_SEC}">Batal</button><button data-act="${ok}" class="${B_PRI}">${label}</button></div>`;
const field = (l, inner) => `<div><label class="block text-xs font-semibold text-slate-700 mb-1">${l}</label>${inner}</div>`;

function mStudent(id) {
  const s = id ? cur().students.find(x => x.id === id) : { kelas: KELAS.includes(ui.tab) ? ui.tab : '1', jk: 'L' };
  modal(`${mHead(id ? 'Edit Data Siswa' : 'Tambah Siswa Baru')}<div class="mt-4 space-y-3.5" data-id="${id || ''}">
  ${field('Tingkat Kelas', `<select id="f-kelas" class="${INP}">${kelasOpts(s.kelas, '', true)}</select>`)}
  ${field('NISN / Nomor Induk', `<input id="f-nisn" value="${esc(s.nisn || '')}" placeholder="Contoh: 0123456789" class="${INP}">`)}
  ${field('Nama Lengkap Siswa', `<input id="f-nama" value="${esc(s.name || '')}" placeholder="Nama lengkap..." class="${INP}">`)}
  ${field('Jenis Kelamin', `<select id="f-jk" class="${INP}"><option value="L" ${s.jk === 'L' ? 'selected' : ''}>Laki-laki (L)</option><option value="P" ${s.jk === 'P' ? 'selected' : ''}>Perempuan (P)</option></select>`)}</div>${mFoot('save-student', 'Simpan Data')}`);
}
function mImport() {
  const im = ui.imp ??= { name: '', rows: [], def: '' };
  const rows = im.rows.map(r => ({ ...r, k: r.kelas || im.def })), cnt = {}; rows.forEach(r => cnt[r.k || '?'] = (cnt[r.k || '?'] || 0) + 1);
  modal(`${mHead('Impor Seluruh Data Siswa dari Excel', 'Mendukung file multi-sheet (Sheet "KELAS 1" s.d. "KELAS 6") atau satu sheet dengan kolom Kelas. Target: T.A ' + esc(ui.year))}
  <div class="mt-4 space-y-4"><div id="drop" class="border-2 border-dashed border-emerald-300 bg-emerald-50/50 rounded-xl p-6 text-center">
    <input type="file" id="file" accept=".xlsx,.xls,.csv,.txt" class="hidden"><label for="file" class="cursor-pointer block"><span class="text-4xl block mb-2">📁</span>
    <span class="text-sm font-bold text-emerald-900 block">Pilih Berkas Excel / CSV</span><span class="text-xs text-slate-500 mt-1 block">${esc(im.name || 'Klik untuk menelusuri atau tarik file ke sini')}</span></label></div>
  ${rows.length ? `<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs space-y-2"><div class="flex items-center justify-between"><span class="font-bold text-emerald-900 text-sm">Hasil Deteksi Siswa Per Kelas:</span><span class="bg-emerald-700 text-white font-mono px-2 py-0.5 rounded-full font-bold">${rows.length} Siswa</span></div>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">${Object.entries(cnt).sort().map(([k, n]) => `<div class="bg-white rounded-lg border ${k === '?' ? 'border-rose-300 text-rose-700' : 'border-emerald-200'} px-2 py-1.5 font-semibold">${k === '?' ? 'Tanpa kelas' : 'Kelas ' + k}: ${n}</div>`).join('')}</div>
    ${cnt['?'] ? `<label class="block font-semibold text-slate-700">Kelas untuk yang kosong <select id="def" class="border border-slate-300 rounded px-2 py-1 ml-1"><option value="">(lewati)</option>${kelasOpts(im.def)}</select></label>` : ''}
    <div class="pt-2 border-t border-emerald-200 text-[11px] text-slate-600">Contoh: ${rows.slice(0, 5).map(r => esc(r.name)).join(', ')}${rows.length > 5 ? ', …' : ''}</div></div>` : ''}</div>
  ${mFoot('do-import', '🚀 Simpan & Masukkan ke Database')}`);
}
function mPromote() {
  const from = ui.year;
  modal(`${mHead('Kenaikan Kelas', 'Salin siswa ke tahun ajaran lain dan naikkan kelasnya.')}<div class="mt-4 space-y-3.5">
  ${field('Dari Tahun Ajaran', `<select id="p-from" class="${INP}">${years().map(y => `<option ${y.id === from ? 'selected' : ''}>${y.id}</option>`).join('')}</select>`)}
  ${field('Ke Tahun Ajaran (dibuat otomatis bila belum ada)', `<input id="p-to" value="${nextYear(from)}" class="${INP}">`)}
  <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">Kelas 1→2 … 5→6, <strong>Kelas 6 → Lulus</strong>. Nilai tidak ikut disalin. Siswa yang sudah terdaftar di tahun tujuan tidak diubah, jadi aman dijalankan ulang.</div></div>${mFoot('do-promote', '⬆️ Naikkan Kelas')}`);
  $('#p-from').onchange = e => $('#p-to').value = nextYear(e.target.value);
}
function mSettings() {
  const st = S.settings;
  modal(`${mHead('Pengaturan Mapel & Bobot', 'Nilai Akhir = (Rerata Bab × bobot Bab + STS × bobot STS + SAS × bobot SAS) / total bobot')}<div class="mt-4 space-y-3.5">
  ${field('Nama Mapel', `<input id="s-mapel" value="${esc(st.mapel)}" class="${INP}">`)}
  <div class="grid grid-cols-3 gap-3">${[['wBab', 'Bobot Bab'], ['wSts', 'Bobot STS'], ['wSas', 'Bobot SAS']].map(([k, l]) => field(l, `<input id="s-${k}" type="number" min="0" max="100" value="${st[k]}" class="${INP}">`)).join('')}</div></div>${mFoot('save-settings', 'Simpan')}`);
}

// ---------- aksi ----------
document.addEventListener('click', e => {
  const b = e.target.closest('[data-tab],[data-act]'); if (!b) return;
  if (b.dataset.tab) { ui.tab = b.dataset.tab; return renderAll(); }
  const a = b.dataset.act, y = S?.years.length ? cur() : null, id = b.dataset.id;
  if (a === 'close') return closeModal();
  if (a === 'new-year') return act(async () => { const v = prompt('ID tahun ajaran baru (contoh 2020/2021):', y ? prevYear(years().at(-1).id) : ''); if (!v) return; await api.newYear(v.trim()); await reload(); ui.year = v.trim(); renderAll(); toast('Tahun ajaran ' + v.trim() + ' dibuat'); });
  if (!y) return;
  if (a === 'promote') return mPromote();
  if (a === 'do-promote') return act(async () => { const to = $('#p-to').value.trim(), from = $('#p-from').value; const r = await api.promote(from, to); closeModal(); await reload(); ui.year = to; renderAll(); toast(`Naik kelas selesai: ${r.total - r.skipped} siswa disalin (${r.graduated} lulus)${r.skipped ? ', ' + r.skipped + ' sudah ada' : ''}`); });
  if (a === 'add') return mStudent();
  if (a === 'edit') return mStudent(id);
  if (a === 'save-student') return act(async () => {
    const sid = $('#modal-box [data-id]').dataset.id, v = { name: $('#f-nama').value, nisn: $('#f-nisn').value, kelas: $('#f-kelas').value, jk: $('#f-jk').value };
    if (!v.name.trim()) throw new Error('Nama wajib diisi');
    if (sid) await api.updateStudent({ year: y.id, id: sid, ...v }); else await api.importStudents(y.id, [v]);
    closeModal(); await reload(); toast('Data siswa disimpan');
  });
  if (a === 'del') { const s = y.students.find(x => x.id === id); if (!confirm(`Hapus ${s.name} dari T.A ${y.id}? Nilainya di tahun ini ikut terhapus.`)) return; y.students = y.students.filter(x => x.id !== id); delete y.scores[id]; renderAll(); return track(api.removeStudent(y.id, id)); }
  if (a === 'import') return mImport();
  if (a === 'do-import') return act(async () => {
    const im = ui.imp, rows = im.rows.map(r => ({ name: r.name, nisn: r.nisn, jk: r.jk, kelas: r.kelas || im.def })).filter(r => r.kelas);
    if (!rows.length) throw new Error('Belum ada siswa yang siap diimpor');
    let add = 0, upd = 0, skip = im.rows.length - rows.length;
    for (let i = 0; i < rows.length; i += 300) { const r = await api.importStudents(y.id, rows.slice(i, i + 300)); add += r.added; upd += r.updated; skip += r.skipped; }
    closeModal(); ui.tab = 'siswa'; ui.mKelas = 'ALL'; await reload(); toast(`Impor selesai: ${add} baru, ${upd} diperbarui${skip ? ', ' + skip + ' dilewati' : ''}`);
  });
  if (a === 'tpl') return dl(new Blob([TEMPLATE], { type: 'text/csv' }), 'template-siswa.csv');
  if (a === 'settings') return mSettings();
  if (a === 'save-settings') return act(async () => { const st = { mapel: $('#s-mapel').value.trim() || 'PAI', wBab: +$('#s-wBab').value, wSts: +$('#s-wSts').value, wSas: +$('#s-wSas').value }; if (st.wBab + st.wSts + st.wSas <= 0) throw new Error('Total bobot harus lebih dari 0'); await api.saveSettings(st); S.settings = st; closeModal(); renderAll(); toast('Pengaturan disimpan'); });
  if (a === 'clear') { const s = y.students.find(x => x.id === id); if (!confirm(`Kosongkan nilai ${s.name} (Semester ${ui.sem})?`)) return; (y.scores[id] ??= {})[ui.sem] = Object.fromEntries(FIELDS.map(f => [f, ''])); queueScore(y.id, id, ui.sem, true); return rowsKelas(ui.tab); }
  if (a === 'xl-kelas') return act(() => saveXlsx([['No', 'NISN', 'Nama', ...H], ...sheetList(ui.tab).map((s, i) => { const sc = scoreOf(y, s.id, ui.sem), na = nilaiAkhir(sc); return [i + 1, s.nisn || '', s.name, ...FIELDS.map(f => sc[f] ?? ''), na ?? '', predOf(na)]; })], 'Kelas ' + ui.tab, `nilai-${S.settings.mapel}-kelas${ui.tab}-${y.id.replace('/', '-')}-smt${ui.sem}.xlsx`));
  if (a === 'xl-arsip') return act(() => saveXlsx([['No', 'T.A', 'Smt', 'Kelas', 'NISN', 'Nama', ...H], ...arsipData().map((r, i) => [i + 1, r.ta, r.sm, r.s.kelas, r.s.nisn || '', r.s.name, ...FIELDS.map(f => r.sc[f] ?? ''), r.na ?? '', predOf(r.na)])], 'Arsip', `arsip-nilai-${S.settings.mapel}.xlsx`));
  if (a === 'print') return window.print();
});
async function loadFile(f) { if (!f) return; await act(async () => { const rows = await parseFile(f); if (!rows.length) throw new Error('Tidak ada baris siswa di file ini'); ui.imp.name = f.name; ui.imp.rows = rows; mImport(); }); }
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'ta') { ui.year = t.value; return renderAll(); }
  if (t.id === 'smt') { ui.sem = t.value; return renderAll(); }
  if (t.id === 'file') return loadFile(t.files[0]);
  if (t.id === 'def') { ui.imp.def = t.value; return mImport(); }
  if (t.dataset.f) { ui[t.dataset.f] = t.value; ui.tab === 'siswa' ? rowsSiswa() : rowsArsip(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.f && t.tagName === 'INPUT') { ui[t.dataset.f] = t.value; return ui.tab === 'siswa' ? rowsSiswa() : rowsArsip(); }
  if (t.dataset.sid) {
    const y = cur(), sid = t.dataset.sid, v = t.value === '' ? '' : Math.min(100, Math.max(0, +t.value));
    ((y.scores[sid] ??= {})[ui.sem] ??= {})[t.dataset.fld] = v;
    const na = nilaiAkhir(y.scores[sid][ui.sem]); $('#r-' + sid).textContent = na ?? '-'; $('#p-' + sid).innerHTML = badge(predOf(na));
    footers(ui.tab); queueScore(y.id, sid, ui.sem);
  }
});
document.addEventListener('dragover', e => { if (e.target.closest('#drop')) e.preventDefault(); });
document.addEventListener('drop', e => { if (e.target.closest('#drop')) { e.preventDefault(); loadFile(e.dataTransfer.files[0]); } });

async function start() {
  $('#main').innerHTML = '<p class="text-slate-500 text-sm">Memuat data…</p>';
  try { S = await api.load(); renderAll(); }
  catch (e) { $('#main').innerHTML = `<div class="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm"><p class="font-bold text-rose-700">Tidak bisa memuat data.</p><p class="text-sm mt-1">${esc(e.message)}</p><p class="text-xs text-slate-500 mt-1">API: ${esc(API_BASE)} — pastikan Worker berjalan dan tabel D1 sudah dibuat.</p><button id="retry" class="${B_PRI} mt-3">Coba lagi</button></div>`; $('#retry').onclick = start; }
}
start();

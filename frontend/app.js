import { api } from './api.js';
import { API_BASE } from './config.js';
import { parseFile, TEMPLATE } from './importer.js';
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
const $ = s => document.querySelector(s), esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BABS = ['b1', 'b2', 'b3', 'b4', 'b5'], KELAS = ['1', '2', '3', '4', '5', '6'];
let S, ui = { tab: 'input', year: null, kelas: '3', sem: '2', mode: 'leger', q: '', imp: null, defKelas: '' };
const TABS = { input: 'Input Nilai', siswa: 'Siswa', impor: 'Impor Excel', tahun: 'Tahun Ajaran', arsip: 'Arsip & Leger' };

// ---- perhitungan ----
const blank = v => v === '' || v == null || isNaN(v);
function nilaiAkhir(sc, st) {
  if (!sc || blank(sc.sts) || blank(sc.sas)) return null;
  const b = BABS.map(k => sc[k]).filter(v => !blank(v)).map(Number); if (!b.length) return null;
  const avg = b.reduce((a, c) => a + c, 0) / b.length, w = st.wBab + st.wSts + st.wSas || 1;
  return Math.round((avg * st.wBab + sc.sts * st.wSts + sc.sas * st.wSas) / w);
}
const yr = id => S.years.find(y => y.id === id), cur = () => yr(ui.year);
const scoreOf = (y, sid, sem) => y.scores?.[sid]?.[sem] || {};
const sorted = () => [...S.years].sort((a, b) => a.id.localeCompare(b.id));
const bySort = (a, b) => a.name.localeCompare(b.name);
const toast = m => { const t = $('#toast'); t.textContent = m; t.className = 's'; setTimeout(() => t.className = '', 2600); };

// ---- sinkronisasi ke D1 ----
let pending = 0, lastErr = '';
const setSync = () => { const e = $('#sync'); e.className = lastErr ? 'err' : ''; e.textContent = pending ? 'Menyimpan…' : lastErr ? '⚠ Gagal tersimpan' : '✓ Tersimpan'; };
function track(p) { pending++; setSync(); return p.then(() => { pending--; lastErr = ''; setSync(); }, e => { pending--; lastErr = e.message; setSync(); toast('Gagal menyimpan: ' + e.message); }); }
async function act(fn) { try { await fn(); } catch (e) { toast(e.message); } }
async function reload() { S = await api.load(); render(); }
const timers = {};
function queueScore(yid, sid, sem) {
  const k = [yid, sid, sem].join('|'); clearTimeout(timers[k]);
  timers[k] = setTimeout(() => { const sc = yr(yid)?.scores?.[sid]?.[sem]; if (sc) track(api.saveScore(yid, sid, sem, sc)); }, 500);
}

// ---- komponen ----
const yearSel = () => `<label>Tahun Ajaran<select data-k="year">${sorted().map(y => `<option ${y.id === ui.year ? 'selected' : ''}>${y.id}</option>`).join('')}</select></label>`;
const kelasSel = () => `<label>Kelas<select data-k="kelas">${KELAS.map(k => `<option ${k === ui.kelas ? 'selected' : ''}>${k}</option>`).join('')}</select></label>`;
const semSel = () => `<label>Semester<select data-k="sem"><option value="1" ${ui.sem == 1 ? 'selected' : ''}>1 (Ganjil)</option><option value="2" ${ui.sem == 2 ? 'selected' : ''}>2 (Genap)</option></select></label>`;

function impRows() {
  return (ui.imp || []).map(r => { const kelas = r.kelas || ui.defKelas; return { ...r, kelas, ok: !!kelas }; });
}
const views = {
  input() {
    const y = cur(), list = y.students.filter(s => s.kelas === ui.kelas).sort(bySort), st = S.settings;
    return `<div class="card"><div class="row">${yearSel()}${kelasSel()}${semSel()}</div>
  <p class="m">Mapel ${esc(st.mapel)} · Nilai Akhir = Rerata Bab ×${st.wBab}% + STS ×${st.wSts}% + SAS ×${st.wSas}%. Tersimpan otomatis ke database.</p>
  ${list.length ? `<div class="tw"><table><tr><th>No</th><th class="l">Nama</th>${[1, 2, 3, 4, 5].map(i => `<th>Bab ${i}</th>`).join('')}<th>STS</th><th>SAS</th><th>Rapor</th></tr>
  ${list.map((s, i) => { const sc = scoreOf(y, s.id, ui.sem); return `<tr><td>${i + 1}</td><td class="l">${esc(s.name)}</td>
  ${[...BABS, 'sts', 'sas'].map(k => `<td><input class="n" type="number" min="0" max="100" inputmode="numeric" data-sid="${s.id}" data-f="${k}" value="${sc[k] ?? ''}"></td>`).join('')}
  <td class="r" id="r-${s.id}">${nilaiAkhir(sc, st) ?? '–'}</td></tr>`; }).join('')}</table></div>` : '<p class="m">Belum ada siswa di kelas ini. Tambah di tab Siswa atau Impor Excel.</p>'}</div>
  <div class="card"><b>Pengaturan</b><div class="row" style="margin-top:8px">
  <label>Mapel<input data-set="mapel" value="${esc(st.mapel)}"></label>
  ${[['wBab', 'Bobot Bab %'], ['wSts', 'Bobot STS %'], ['wSas', 'Bobot SAS %']].map(([k, l]) => `<label>${l}<input class="n" type="number" data-set="${k}" value="${st[k]}" style="width:90px"></label>`).join('')}</div></div>`;
  },
  siswa() {
    const y = cur(), list = y.students.filter(s => s.kelas === ui.kelas).sort(bySort);
    return `<div class="card"><div class="row">${yearSel()}${kelasSel()}<button data-tab="impor">📥 Impor dari Excel/CSV</button></div>
  <div class="row"><label>Nama<input id="nm" placeholder="Nama siswa"></label><label>NISN (opsional)<input id="ns" inputmode="numeric"></label><button class="pri" data-a="add">Tambah</button></div>
  <p class="m">${list.length} siswa di Kelas ${ui.kelas}.</p>
  <div class="tw"><table><tr><th class="l">Nama</th><th>NISN</th><th>Pindah kelas</th><th></th></tr>
  ${list.map(s => `<tr><td class="l">${esc(s.name)}</td><td>${esc(s.nisn || '–')}</td><td><select data-mv="${s.id}">${[...KELAS, 'Lulus'].map(k => `<option ${k === s.kelas ? 'selected' : ''}>${k}</option>`).join('')}</select></td><td><button class="del" data-del="${s.id}">Hapus</button></td></tr>`).join('') || '<tr><td class="m">Kosong</td></tr>'}</table></div></div>`;
  },
  impor() {
    const rows = impRows(), okN = rows.filter(r => r.ok).length, badN = rows.length - okN;
    return `<div class="card"><h3>Impor Siswa dari Excel / CSV</h3>
  <div class="row">${yearSel()}<label>File (.xlsx, .xls, .csv)<input type="file" id="file" accept=".xlsx,.xls,.csv,.txt"></label><button data-a="tpl">Unduh template CSV</button></div>
  <p class="m">Kolom dikenali otomatis dari baris judul: <b>Nama</b>, <b>NISN</b>, <b>Kelas</b> (angka 1–6, "III", atau "Kelas 3"). Jika tidak ada kolom Kelas, nama sheet seperti "KELAS 3" dipakai, atau pilihan di bawah. Siswa yang NISN/namanya sudah ada akan diperbarui, bukan digandakan. Tips: format kolom NISN sebagai Teks agar angka 0 di depan tidak hilang.</p>
  ${ui.imp ? `<div class="row"><label>Kelas bila kosong<select data-k="defKelas"><option value="">— tidak ada —</option>${KELAS.map(k => `<option ${k === ui.defKelas ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
  <button class="pri" data-a="doimport" ${okN ? '' : 'disabled'}>Impor ${okN} siswa ke ${ui.year}</button></div>
  <p>${okN} siap diimpor${badN ? ` · <span class="err">${badN} belum punya kelas (akan dilewati)</span>` : ''}</p>
  <div class="tw"><table><tr><th>#</th><th class="l">Nama</th><th>NISN</th><th>Kelas</th></tr>
  ${rows.slice(0, 15).map((r, i) => `<tr><td>${i + 1}</td><td class="l">${esc(r.name)}</td><td>${esc(r.nisn || '–')}</td><td class="${r.ok ? '' : 'err'}">${esc(r.kelas || (r.kelasRaw ? '? ' + r.kelasRaw : '?'))}</td></tr>`).join('')}</table></div>
  ${rows.length > 15 ? `<p class="m">…dan ${rows.length - 15} baris lainnya.</p>` : ''}` : ''}</div>`;
  },
  tahun() {
    const l = sorted().at(-1), d = new Date(), y0 = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
    const next = l ? `${+l.id.split('/')[0] + 1}/${+l.id.split('/')[0] + 2}` : `${y0}/${y0 + 1}`;
    const n = l ? l.students.filter(s => s.kelas !== 'Lulus').length : 0, g = l ? l.students.filter(s => s.kelas === '6').length : 0;
    return `<div class="card"><h3>${l ? 'Buat Tahun Ajaran Baru' : 'Buat Tahun Ajaran Pertama'}</h3>
  ${l ? `<p>Tahun terakhir: <b>${l.id}</b> (${l.students.length} siswa). Data lama <b>tidak diubah</b>.</p>
  <p class="m">Kelas 1→2, 2→3 … 5→6, Kelas 6→Lulus (${g} siswa). ${n} siswa disalin; nilai tahun baru mulai kosong.</p>` : '<p class="m">Belum ada data. Buat tahun ajaran, lalu impor siswa.</p>'}
  <div class="row"><label>ID tahun ajaran<input id="ny" value="${next}"></label><button class="pri" data-a="newyear">${l ? 'Buat & Naikkan Kelas' : 'Buat'}</button></div></div>
  <div class="card"><b>Daftar tahun ajaran</b><ul>${sorted().map(y => `<li>${y.id} — ${y.students.length} siswa</li>`).join('') || '<li class="m">kosong</li>'}</ul></div>`;
  },
  arsip() {
    const y = cur(), st = S.settings;
    const mode = `<label>Tampilan<select data-k="mode"><option value="leger" ${ui.mode == 'leger' ? 'selected' : ''}>Leger Kelas</option><option value="riwayat" ${ui.mode == 'riwayat' ? 'selected' : ''}>Riwayat Siswa</option></select></label>`;
    if (ui.mode === 'riwayat') {
      const q = ui.q.toLowerCase(), rows = [];
      sorted().forEach(yy => yy.students.filter(s => s.name.toLowerCase().includes(q) || (s.nisn || '').includes(q)).forEach(s => [1, 2].forEach(sm => { const sc = scoreOf(yy, s.id, sm); if (Object.values(sc).some(v => v != null)) rows.push([s.name, yy.id, s.kelas, sm, sc, nilaiAkhir(sc, st)]); })));
      return `<div class="card"><div class="row">${mode}<label>Cari nama / NISN<input data-k="q" value="${esc(ui.q)}" placeholder="ketik nama"></label></div>${tbl(rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[3] - b[3]), true)}</div>`;
    }
    const rows = y.students.filter(s => s.kelas === ui.kelas).sort(bySort).map(s => { const sc = scoreOf(y, s.id, ui.sem); return [s.name, y.id, s.kelas, ui.sem, sc, nilaiAkhir(sc, st)]; });
    return `<div class="card"><div class="row">${mode}${yearSel()}${kelasSel()}${semSel()}<button data-a="csv">Unduh CSV</button><button data-a="print">Cetak</button></div>
  <h3>Leger ${esc(st.mapel)} — Kelas ${ui.kelas} · ${y.id} · Smt ${ui.sem}</h3>${tbl(rows, false)}</div>`;
  }
};
function tbl(rows, hist) {
  if (!rows.length) return '<p class="m">Tidak ada data.</p>';
  return `<div class="tw"><table><tr><th>No</th><th class="l">Nama</th>${hist ? '<th>Tahun</th><th>Kls</th><th>Smt</th>' : ''}${[1, 2, 3, 4, 5].map(i => `<th>B${i}</th>`).join('')}<th>STS</th><th>SAS</th><th>Rapor</th></tr>
  ${rows.map((r, i) => `<tr><td>${i + 1}</td><td class="l">${esc(r[0])}</td>${hist ? `<td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td>` : ''}${[...BABS, 'sts', 'sas'].map(k => `<td>${r[4][k] ?? '–'}</td>`).join('')}<td class="r">${r[5] ?? '–'}</td></tr>`).join('')}</table></div>`;
}
function render() {
  if (S.years.length && !S.years.some(y => y.id === ui.year)) ui.year = sorted().at(-1).id;
  if (!S.years.length) ui.tab = 'tahun';
  $('#nav').innerHTML = Object.entries(TABS).map(([k, v]) => `<button data-tab="${k}" class="${k === ui.tab ? 'on' : ''}">${v}</button>`).join('');
  $('#app').innerHTML = views[ui.tab]();
  setSync();
}

// ---- aksi ----
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return; const d = t.dataset, y = S && cur();
  if (d.tab) { if (S.years.length || d.tab === 'tahun') { ui.tab = d.tab; render(); } return; }
  if (d.del) { const sid = d.del; y.students = y.students.filter(s => s.id !== sid); delete y.scores[sid]; render(); return track(api.removeStudent(y.id, sid)); }
  const a = d.a; if (!a) return;
  if (a === 'retry') return start();
  if (a === 'add') { const n = $('#nm').value.trim(); if (!n) return; return act(async () => { await api.importStudents(y.id, [{ name: n, nisn: $('#ns').value, kelas: ui.kelas }]); await reload(); toast('Siswa disimpan'); }); }
  if (a === 'newyear') return act(async () => { const id = $('#ny').value.trim(); await api.newYear(id); await reload(); ui.year = id; ui.tab = 'siswa'; render(); toast('Tahun ajaran ' + id + ' dibuat'); });
  if (a === 'doimport') return act(async () => {
    const rows = impRows().filter(r => r.ok).map(r => ({ name: r.name, nisn: r.nisn, kelas: r.kelas })); let added = 0, updated = 0, skipped = 0;
    for (let i = 0; i < rows.length; i += 300) { const r = await api.importStudents(ui.year, rows.slice(i, i + 300)); added += r.added; updated += r.updated; skipped += r.skipped; }
    ui.kelas = rows[0].kelas === 'Lulus' ? ui.kelas : rows[0].kelas; ui.imp = null; ui.tab = 'siswa'; await reload();
    toast(`Impor selesai: ${added} baru, ${updated} diperbarui${skipped ? ', ' + skipped + ' dilewati' : ''}`);
  });
  if (a === 'tpl') { dl(new Blob([TEMPLATE], { type: 'text/csv' }), 'template-siswa.csv'); }
  if (a === 'print') window.print();
  if (a === 'csv') {
    const rows = y.students.filter(s => s.kelas === ui.kelas).sort(bySort).map((s, i) => { const sc = scoreOf(y, s.id, ui.sem); return [i + 1, s.name, ...BABS.map(k => sc[k] ?? ''), sc.sts ?? '', sc.sas ?? '', nilaiAkhir(sc, S.settings) ?? ''].map(v => `"${v}"`).join(','); });
    dl(new Blob(['\ufeffNo,Nama,Bab1,Bab2,Bab3,Bab4,Bab5,STS,SAS,Rapor\n' + rows.join('\n')], { type: 'text/csv' }), `leger-${y.id.replace('/', '-')}-kelas${ui.kelas}-smt${ui.sem}.csv`);
  }
});
const dl = (b, n) => { const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = n; l.click(); };
document.addEventListener('change', e => {
  const t = e.target, d = t.dataset;
  if (t.id === 'file') { const f = t.files[0]; if (!f) return; return act(async () => { ui.imp = await parseFile(f); if (!ui.imp.length) { ui.imp = null; throw new Error('Tidak ada baris siswa di file ini'); } render(); }); }
  if (d.k) { ui[d.k] = t.value; return render(); }
  if (d.mv) { cur().students.find(s => s.id === d.mv).kelas = t.value; render(); return track(api.moveStudent(ui.year, d.mv, t.value)); }
  if (d.set) { S.settings[d.set] = d.set === 'mapel' ? t.value : Math.max(0, +t.value || 0); render(); track(api.saveSettings(S.settings)); }
});
document.addEventListener('input', e => {
  const t = e.target, d = t.dataset;
  if (d.k === 'q') { ui.q = t.value; const p = t.selectionStart; render(); const i = $('[data-k=q]'); i.focus(); i.setSelectionRange(p, p); return; }
  if (d.sid) {
    const v = t.value === '' ? '' : Math.min(100, Math.max(0, +t.value)), y = cur();
    ((y.scores[d.sid] ??= {})[ui.sem] ??= {})[d.f] = v;
    $('#r-' + d.sid).textContent = nilaiAkhir(y.scores[d.sid][ui.sem], S.settings) ?? '–';
    queueScore(y.id, d.sid, ui.sem);
  }
});
async function start() {
  $('#app').innerHTML = '<p class="m">Memuat data…</p>';
  try { S = await api.load(); render(); }
  catch (e) { $('#app').innerHTML = `<div class="card"><b class="err">Tidak bisa memuat data.</b><p>${esc(e.message)}</p><p class="m">API: ${esc(API_BASE)} — pastikan Worker berjalan / alamat di <code>config.js</code> benar.</p><button class="pri" data-a="retry">Coba lagi</button></div>`; }
}
start();

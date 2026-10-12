// Cloudflare Worker + D1. Autentikasi sengaja ditunda (lihat README).
const KELAS = ['1', '2', '3', '4', '5', '6', 'Lulus'];
const F = ['b1', 'b2', 'b3', 'b4', 'b5', 'sts', 'sas'];
const DEF = { mapel: 'PAI', wBab: 40, wSts: 30, wSas: 30 };
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...cors } });
const cleanName = v => String(v ?? '').trim().replace(/\s+/g, ' ');
const cleanNisn = v => String(v ?? '').replace(/[^0-9A-Za-z]/g, '') || null;
const cleanJk = v => { const c = String(v ?? '').trim().toUpperCase()[0]; return c === 'L' || c === 'P' ? c : null; };
const bad = (m, s = 400) => Object.assign(new Error(m), { status: s });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    try { return await route(req, env); }
    catch (e) { return J({ error: e.status ? e.message : 'Kesalahan server: ' + e.message }, e.status || 500); }
  }
};

async function route(req, env) {
  const db = env.DB, u = new URL(req.url), p = u.pathname.replace(/\/$/, ''), m = req.method;
  const body = () => req.json().catch(() => { throw bad('JSON tidak valid'); });

  // Seluruh data (bentuknya sama dengan state di frontend)
  if (m === 'GET' && p === '/api/data') {
    const [Y, E, C, T] = await db.batch([
      db.prepare('SELECT id FROM years ORDER BY id'),
      db.prepare('SELECT s.id, s.nisn, s.name, s.jk, e.year_id, e.kelas FROM enrollments e JOIN students s ON s.id = e.student_id'),
      db.prepare('SELECT * FROM scores'),
      db.prepare('SELECT key, value FROM settings')
    ]);
    const settings = { ...DEF };
    for (const r of T.results) settings[r.key] = r.key === 'mapel' ? r.value : Number(r.value);
    const years = Y.results.map(r => ({ id: r.id, students: [], scores: {} }));
    const ix = Object.fromEntries(years.map(y => [y.id, y]));
    for (const r of E.results) ix[r.year_id].students.push({ id: r.id, name: r.name, nisn: r.nisn, jk: r.jk, kelas: r.kelas });
    for (const r of C.results) {
      const y = ix[r.year_id]; if (!y) continue;
      (y.scores[r.student_id] ??= {})[r.semester] = Object.fromEntries(F.map(k => [k, r[k]]));
    }
    return J({ settings, years });
  }

  if (m === 'PUT' && p === '/api/settings') {
    const b = await body();
    const mapel = String(b.mapel || '').trim().slice(0, 40) || DEF.mapel;
    const w = ['wBab', 'wSts', 'wSas'].map(k => { const n = Number(b[k]); if (!(n >= 0 && n <= 100)) throw bad('Bobot harus 0-100'); return n; });
    if (w[0] + w[1] + w[2] <= 0) throw bad('Total bobot harus lebih dari 0');
    const up = (k, v) => db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k, String(v));
    await db.batch([up('mapel', mapel), up('wBab', w[0]), up('wSts', w[1]), up('wSas', w[2])]);
    return J({ ok: true });
  }

  // Tahun ajaran baru: hanya membuat tahun kosong. Boleh tahun apa saja (juga tahun-tahun lama).
  if (m === 'POST' && p === '/api/years') {
    const { id } = await body();
    if (!/^\d{4}\/\d{4}$/.test(id || '')) throw bad('Format tahun ajaran: 2022/2023');
    if (await db.prepare('SELECT 1 FROM years WHERE id=?').bind(id).first()) throw bad('Tahun ajaran sudah ada', 409);
    await db.prepare('INSERT INTO years(id) VALUES(?)').bind(id).run();
    return J({ ok: true });
  }

  // Kenaikan kelas (tombol terpisah): salin siswa dari tahun asal ke tahun tujuan, kelas +1, 6 -> Lulus.
  // Tahun tujuan dibuat bila belum ada. Siswa yang sudah terdaftar di tahun tujuan tidak diubah.
  if (m === 'POST' && p === '/api/promote') {
    const { from, to } = await body();
    if (!/^\d{4}\/\d{4}$/.test(to || '')) throw bad('Format tahun ajaran tujuan: 2022/2023');
    if (from === to) throw bad('Tahun asal dan tujuan tidak boleh sama');
    if (!(await db.prepare('SELECT 1 FROM years WHERE id=?').bind(from).first())) throw bad('Tahun asal tidak ditemukan', 404);
    const c = await db.prepare(`SELECT COUNT(*) AS n, SUM(kelas = '6') AS g, SUM(student_id IN (SELECT student_id FROM enrollments WHERE year_id = ?2)) AS dup
      FROM enrollments WHERE year_id = ?1 AND kelas <> 'Lulus'`).bind(from, to).first();
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO years(id) VALUES(?)').bind(to),
      db.prepare(`INSERT OR IGNORE INTO enrollments(year_id, student_id, kelas)
        SELECT ?1, student_id, CASE kelas WHEN '6' THEN 'Lulus' ELSE CAST(CAST(kelas AS INTEGER) + 1 AS TEXT) END
        FROM enrollments WHERE year_id = ?2 AND kelas <> 'Lulus'`).bind(to, from)
    ]);
    return J({ ok: true, total: c.n, graduated: c.g || 0, skipped: c.dup || 0 });
  }

  // Impor / tambah siswa: cocokkan dengan NISN (atau nama bila NISN kosong), lalu upsert.
  if (m === 'POST' && p === '/api/import') {
    const b = await body();
    if (!Array.isArray(b.rows)) throw bad('rows harus berupa array');
    if (!(await db.prepare('SELECT 1 FROM years WHERE id=?').bind(b.year).first())) throw bad('Tahun ajaran tidak ditemukan', 404);
    let skipped = 0; const rows = new Map();
    for (const r of b.rows) {
      const name = cleanName(r.name), nisn = cleanNisn(r.nisn), jk = cleanJk(r.jk), kelas = String(r.kelas ?? '').trim();
      if (!name || !KELAS.includes(kelas)) { skipped++; continue; }
      rows.set(nisn || 'n:' + name.toLowerCase(), { name, nisn, kelas, jk });
    }
    const all = (await db.prepare('SELECT id, nisn, name, jk FROM students').all()).results;
    const byN = new Map(all.filter(s => s.nisn).map(s => [s.nisn, s]));
    const byName = new Map(); for (const s of all) { const k = s.name.toLowerCase(); if (!byName.has(k)) byName.set(k, s); }
    const ins = [], upd = [], enr = [], used = new Set();
    for (const r of rows.values()) {
      let s = r.nisn ? byN.get(r.nisn) : null;
      if (!s) { const c = byName.get(r.name.toLowerCase()); if (c && (!r.nisn || !c.nisn)) s = c; }
      if (s) {
        if (used.has(s.id)) { skipped++; continue; }
        used.add(s.id); upd.push({ id: s.id, name: r.name, nisn: r.nisn || s.nisn, jk: r.jk || s.jk }); enr.push({ id: s.id, kelas: r.kelas });
      } else {
        const id = crypto.randomUUID(); ins.push({ id, name: r.name, nisn: r.nisn, jk: r.jk }); enr.push({ id, kelas: r.kelas });
      }
    }
    const st = [];
    if (ins.length) st.push(db.prepare(`INSERT INTO students(id,nisn,name,jk) SELECT json_extract(value,'$.id'), json_extract(value,'$.nisn'), json_extract(value,'$.name'), json_extract(value,'$.jk') FROM json_each(?)`).bind(JSON.stringify(ins)));
    if (upd.length) st.push(db.prepare(`UPDATE students SET name = j.name, nisn = j.nisn, jk = j.jk FROM (SELECT json_extract(value,'$.id') AS id, json_extract(value,'$.name') AS name, json_extract(value,'$.nisn') AS nisn, json_extract(value,'$.jk') AS jk FROM json_each(?)) j WHERE students.id = j.id`).bind(JSON.stringify(upd)));
    if (enr.length) st.push(db.prepare(`INSERT INTO enrollments(year_id,student_id,kelas) SELECT ?2, json_extract(value,'$.id'), json_extract(value,'$.kelas') FROM json_each(?1) WHERE true ON CONFLICT(year_id,student_id) DO UPDATE SET kelas = excluded.kelas`).bind(JSON.stringify(enr), b.year));
    if (st.length) await db.batch(st);
    return J({ ok: true, added: ins.length, updated: upd.length, skipped });
  }

  // Edit satu siswa (nama, NISN, L/P) + kelasnya pada tahun tersebut
  if (m === 'PUT' && p === '/api/student') {
    const b = await body(), name = cleanName(b.name);
    if (!name) throw bad('Nama wajib diisi');
    if (!KELAS.includes(b.kelas)) throw bad('Kelas tidak valid');
    try {
      await db.batch([
        db.prepare('UPDATE students SET name=?, nisn=?, jk=? WHERE id=?').bind(name, cleanNisn(b.nisn), cleanJk(b.jk), b.id),
        db.prepare('UPDATE enrollments SET kelas=? WHERE year_id=? AND student_id=?').bind(b.kelas, b.year, b.id)
      ]);
    } catch (e) { if (/UNIQUE/i.test(e.message)) throw bad('NISN sudah dipakai siswa lain', 409); throw e; }
    return J({ ok: true });
  }

  if (m === 'PATCH' && p === '/api/enrollment') {
    const b = await body();
    if (!KELAS.includes(b.kelas)) throw bad('Kelas tidak valid');
    const r = await db.prepare('UPDATE enrollments SET kelas=? WHERE year_id=? AND student_id=?').bind(b.kelas, b.year, b.student).run();
    if (!r.meta.changes) throw bad('Data tidak ditemukan', 404);
    return J({ ok: true });
  }

  if (m === 'DELETE' && p === '/api/enrollment') {
    const y = u.searchParams.get('year'), s = u.searchParams.get('student');
    await db.batch([
      db.prepare('DELETE FROM scores WHERE year_id=? AND student_id=?').bind(y, s),
      db.prepare('DELETE FROM enrollments WHERE year_id=? AND student_id=?').bind(y, s),
      db.prepare('DELETE FROM students WHERE id=? AND NOT EXISTS (SELECT 1 FROM enrollments WHERE student_id=?)').bind(s, s)
    ]);
    return J({ ok: true });
  }

  if (m === 'PUT' && p === '/api/scores') {
    const b = await body();
    if (![1, 2].includes(Number(b.semester))) throw bad('Semester harus 1 atau 2');
    const v = F.map(k => {
      if (b[k] === '' || b[k] == null) return null;
      const n = Number(b[k]); if (!(n >= 0 && n <= 100)) throw bad(`Nilai ${k} harus 0-100`); return n;
    });
    await db.prepare(`INSERT INTO scores(year_id,student_id,semester,${F.join(',')}) VALUES(?,?,?,${F.map(() => '?').join(',')})
      ON CONFLICT(year_id,student_id,semester) DO UPDATE SET ${F.map(k => `${k}=excluded.${k}`).join(',')}`)
      .bind(b.year, b.student, Number(b.semester), ...v).run();
    return J({ ok: true });
  }

  throw bad('Endpoint tidak ditemukan', 404);
}

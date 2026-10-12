-- Jalankan: npx wrangler d1 execute nilai-siswa --remote --file=schema.sql   (--local untuk dev)
DROP TABLE IF EXISTS app_state;

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS years (id TEXT PRIMARY KEY CHECK (id GLOB '[0-9][0-9][0-9][0-9]/[0-9][0-9][0-9][0-9]'));

-- Data master siswa: satu baris per orang, tetap sama sepanjang tahun.
CREATE TABLE IF NOT EXISTS students (
  id   TEXT PRIMARY KEY,
  nisn TEXT UNIQUE,            -- boleh kosong (NULL), tapi unik bila diisi
  name TEXT NOT NULL,
  jk   TEXT                    -- 'L' / 'P' (opsional)
);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);

-- Kelas siswa per tahun ajaran (inilah yang 'dinaikkan' tiap tahun).
CREATE TABLE IF NOT EXISTS enrollments (
  year_id    TEXT NOT NULL REFERENCES years(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kelas      TEXT NOT NULL CHECK (kelas IN ('1','2','3','4','5','6','Lulus')),
  PRIMARY KEY (year_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_enr_kelas ON enrollments(year_id, kelas);

CREATE TABLE IF NOT EXISTS scores (
  year_id    TEXT NOT NULL,
  student_id TEXT NOT NULL,
  semester   INTEGER NOT NULL CHECK (semester IN (1,2)),
  b1 REAL CHECK (b1 BETWEEN 0 AND 100), b2 REAL CHECK (b2 BETWEEN 0 AND 100),
  b3 REAL CHECK (b3 BETWEEN 0 AND 100), b4 REAL CHECK (b4 BETWEEN 0 AND 100),
  b5 REAL CHECK (b5 BETWEEN 0 AND 100),
  sts REAL CHECK (sts BETWEEN 0 AND 100), sas REAL CHECK (sas BETWEEN 0 AND 100),
  PRIMARY KEY (year_id, student_id, semester),
  FOREIGN KEY (year_id, student_id) REFERENCES enrollments(year_id, student_id) ON DELETE CASCADE
);

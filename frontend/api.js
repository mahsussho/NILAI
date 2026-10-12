import { API_BASE } from './config.js';
async function call(method, path, body) {
  let r;
  try { r = await fetch(API_BASE + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('Tidak bisa terhubung ke server (' + API_BASE + ')'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}
export const api = {
  load: () => call('GET', '/data'),
  saveSettings: s => call('PUT', '/settings', s),
  newYear: id => call('POST', '/years', { id }),
  importStudents: (year, rows) => call('POST', '/import', { year, rows }),
  updateStudent: s => call('PUT', '/student', s),
  moveStudent: (year, student, kelas) => call('PATCH', '/enrollment', { year, student, kelas }),
  removeStudent: (year, student) => call('DELETE', `/enrollment?year=${encodeURIComponent(year)}&student=${encodeURIComponent(student)}`),
  saveScore: (year, student, semester, sc) => call('PUT', '/scores', { year, student, semester, ...sc })
};

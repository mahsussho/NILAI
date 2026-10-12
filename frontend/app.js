import {api} from './api.js';
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
const $=s=>document.querySelector(s), esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const BABS=['b1','b2','b3','b4','b5'], KELAS=['1','2','3','4','5','6'];
let S, ui={tab:'input',year:null,kelas:'3',sem:'2',mode:'leger',q:''};
const TABS={input:'Input Nilai',siswa:'Siswa',tahun:'Tahun Ajaran',arsip:'Arsip & Leger'};

// ---- perhitungan ----
const blank=v=>v===''||v==null||isNaN(v);
function nilaiAkhir(sc,st){
  if(!sc||blank(sc.sts)||blank(sc.sas))return null;
  const b=BABS.map(k=>sc[k]).filter(v=>!blank(v)).map(Number); if(!b.length)return null;
  const avg=b.reduce((a,c)=>a+c,0)/b.length, w=st.wBab+st.wSts+st.wSas||1;
  return Math.round((avg*st.wBab+sc.sts*st.wSts+sc.sas*st.wSas)/w);
}
const yr=id=>S.years.find(y=>y.id===id), cur=()=>yr(ui.year);
const scoreOf=(y,sid,sem)=>y.scores?.[sid]?.[sem]||{};
const toast=m=>{const t=$('#toast');t.textContent=m;t.className='s';setTimeout(()=>t.className='',1800)};
const save=()=>api.save(S);
const uid=()=>'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const sorted=()=>[...S.years].sort((a,b)=>a.id.localeCompare(b.id));
const yearSel=()=>`<label>Tahun Ajaran<select data-k="year">${sorted().map(y=>`<option ${y.id===ui.year?'selected':''}>${y.id}</option>`).join('')}</select></label>`;
const kelasSel=()=>`<label>Kelas<select data-k="kelas">${KELAS.map(k=>`<option ${k===ui.kelas?'selected':''}>${k}</option>`).join('')}</select></label>`;
const semSel=()=>`<label>Semester<select data-k="sem"><option value="1" ${ui.sem==1?'selected':''}>1 (Ganjil)</option><option value="2" ${ui.sem==2?'selected':''}>2 (Genap)</option></select></label>`;
const bySort=(a,b)=>a.name.localeCompare(b.name);

// ---- tampilan ----
const views={
input(){
  const y=cur(), list=y.students.filter(s=>s.kelas===ui.kelas).sort(bySort), st=S.settings;
  return `<div class="card"><div class="row">${yearSel()}${kelasSel()}${semSel()}</div>
  <p class="m">Mapel ${esc(st.mapel)} · Nilai Akhir = Rerata Bab ×${st.wBab}% + STS ×${st.wSts}% + SAS ×${st.wSas}%. Tersimpan otomatis.</p>
  ${list.length?`<div class="tw"><table><tr><th>No</th><th class="l">Nama</th>${[1,2,3,4,5].map(i=>`<th>Bab ${i}</th>`).join('')}<th>STS</th><th>SAS</th><th>Rapor</th></tr>
  ${list.map((s,i)=>{const sc=scoreOf(y,s.id,ui.sem);return `<tr><td>${i+1}</td><td class="l">${esc(s.name)}</td>
  ${[...BABS,'sts','sas'].map(k=>`<td><input class="n" type="number" min="0" max="100" inputmode="numeric" data-sid="${s.id}" data-f="${k}" value="${sc[k]??''}"></td>`).join('')}
  <td class="r" id="r-${s.id}">${nilaiAkhir(sc,st)??'–'}</td></tr>`}).join('')}</table></div>`:'<p class="m">Belum ada siswa di kelas ini. Tambah di tab Siswa.</p>'}</div>
  <div class="card"><b>Pengaturan</b><div class="row" style="margin-top:8px">
  <label>Mapel<input data-set="mapel" value="${esc(st.mapel)}"></label>
  ${[['wBab','Bobot Bab %'],['wSts','Bobot STS %'],['wSas','Bobot SAS %']].map(([k,l])=>`<label>${l}<input class="n" type="number" data-set="${k}" value="${st[k]}" style="width:90px"></label>`).join('')}</div></div>`;
},
siswa(){
  const y=cur(), list=y.students.filter(s=>s.kelas===ui.kelas).sort(bySort);
  return `<div class="card"><div class="row">${yearSel()}${kelasSel()}</div>
  <div class="row"><label>Tambah siswa<input id="nm" placeholder="Nama siswa"></label><button class="pri" data-a="add">Tambah</button></div>
  <label>Atau tempel banyak nama (satu per baris)<textarea id="bulk" rows="3"></textarea></label>
  <div class="row" style="margin-top:8px"><button data-a="bulk">Tambah dari daftar</button></div>
  <table><tr><th class="l">Nama</th><th>Pindah kelas</th><th></th></tr>
  ${list.map(s=>`<tr><td class="l">${esc(s.name)}</td><td><select data-mv="${s.id}">${[...KELAS,'Lulus'].map(k=>`<option ${k===s.kelas?'selected':''}>${k}</option>`).join('')}</select></td><td><button class="del" data-del="${s.id}">Hapus</button></td></tr>`).join('')||'<tr><td class="m">Kosong</td></tr>'}</table></div>`;
},
tahun(){
  const l=sorted().at(-1), a=+l.id.split('/')[0], next=`${a+1}/${a+2}`;
  const n=l.students.filter(s=>s.kelas!=='Lulus').length, g=l.students.filter(s=>s.kelas==='6').length;
  return `<div class="card"><h3>Buat Tahun Ajaran Baru</h3>
  <p>Tahun terakhir: <b>${l.id}</b> (${l.students.length} siswa). Data lama <b>tidak diubah</b>.</p>
  <p class="m">Kelas 1→2, 2→3 … 5→6, Kelas 6→Lulus (${g} siswa). ${n} siswa disalin; nilai tahun baru mulai kosong.</p>
  <div class="row"><label>ID tahun baru<input id="ny" value="${next}"></label><button class="pri" data-a="newyear">Buat & Naikkan Kelas</button></div></div>
  <div class="card"><b>Daftar tahun ajaran</b><ul>${sorted().map(y=>`<li>${y.id} — ${y.students.length} siswa</li>`).join('')}</ul></div>`;
},
arsip(){
  const y=cur(), st=S.settings;
  const mode=`<label>Tampilan<select data-k="mode"><option value="leger" ${ui.mode=='leger'?'selected':''}>Leger Kelas</option><option value="riwayat" ${ui.mode=='riwayat'?'selected':''}>Riwayat Siswa</option></select></label>`;
  if(ui.mode==='riwayat'){
    const q=ui.q.toLowerCase(), rows=[];
    sorted().forEach(yy=>yy.students.filter(s=>s.name.toLowerCase().includes(q)).forEach(s=>[1,2].forEach(sm=>{const sc=scoreOf(yy,s.id,sm);if(Object.keys(sc).length)rows.push([s.name,yy.id,s.kelas,sm,sc,nilaiAkhir(sc,st)])})));
    return `<div class="card"><div class="row">${mode}<label>Cari nama<input data-k="q" value="${esc(ui.q)}" placeholder="ketik nama"></label></div>${tbl(rows.sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1])||a[3]-b[3]),true)}</div>`;
  }
  const rows=y.students.filter(s=>s.kelas===ui.kelas).sort(bySort).map(s=>{const sc=scoreOf(y,s.id,ui.sem);return [s.name,y.id,s.kelas,ui.sem,sc,nilaiAkhir(sc,st)]});
  return `<div class="card"><div class="row">${mode}${yearSel()}${kelasSel()}${semSel()}<button data-a="csv">Unduh CSV</button><button data-a="print">Cetak</button></div>
  <h3>Leger ${esc(st.mapel)} — Kelas ${ui.kelas} · ${y.id} · Smt ${ui.sem}</h3>${tbl(rows,false)}</div>`;
}};
function tbl(rows,hist){
  if(!rows.length)return '<p class="m">Tidak ada data.</p>';
  return `<div class="tw"><table><tr><th>No</th><th class="l">Nama</th>${hist?'<th>Tahun</th><th>Kls</th><th>Smt</th>':''}${[1,2,3,4,5].map(i=>`<th>B${i}</th>`).join('')}<th>STS</th><th>SAS</th><th>Rapor</th></tr>
  ${rows.map((r,i)=>`<tr><td>${i+1}</td><td class="l">${esc(r[0])}</td>${hist?`<td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td>`:''}${[...BABS,'sts','sas'].map(k=>`<td>${r[4][k]??'–'}</td>`).join('')}<td class="r">${r[5]??'–'}</td></tr>`).join('')}</table></div>`;
}
function render(){
  if(!S.years.some(y=>y.id===ui.year))ui.year=sorted().at(-1).id;
  $('#nav').innerHTML=Object.entries(TABS).map(([k,v])=>`<button data-tab="${k}" class="${k===ui.tab?'on':''}">${v}</button>`).join('');
  $('#app').innerHTML=views[ui.tab]();
}

// ---- aksi ----
document.addEventListener('click',e=>{
  const t=e.target, y=cur();
  if(t.dataset.tab){ui.tab=t.dataset.tab;return render()}
  if(t.dataset.del){y.students=y.students.filter(s=>s.id!==t.dataset.del);delete y.scores[t.dataset.del];save();return render()}
  const a=t.dataset.a; if(!a)return;
  if(a==='add'){const n=$('#nm').value.trim();if(!n)return;y.students.push({id:uid(),name:n,kelas:ui.kelas});save();toast('Siswa ditambahkan');render()}
  if(a==='bulk'){$('#bulk').value.split('\n').map(x=>x.trim()).filter(Boolean).forEach(n=>y.students.push({id:uid(),name:n,kelas:ui.kelas}));save();render()}
  if(a==='newyear'){
    const id=$('#ny').value.trim(); if(!/^\d{4}\/\d{4}$/.test(id))return toast('Format: 2022/2023');
    if(yr(id))return toast('Tahun ajaran sudah ada');
    const src=sorted().at(-1);
    S.years.push({id,scores:{},students:src.students.filter(s=>s.kelas!=='Lulus').map(s=>({...s,kelas:s.kelas==='6'?'Lulus':String(+s.kelas+1)}))});
    ui.year=id;ui.tab='siswa';save();toast('Tahun ajaran '+id+' dibuat');render()}
  if(a==='print')window.print();
  if(a==='csv'){
    const rows=y.students.filter(s=>s.kelas===ui.kelas).sort(bySort).map((s,i)=>{const sc=scoreOf(y,s.id,ui.sem);return [i+1,s.name,...BABS.map(k=>sc[k]??''),sc.sts??'',sc.sas??'',nilaiAkhir(sc,S.settings)??''].map(v=>`"${v}"`).join(',')});
    const b=new Blob(['\ufeffNo,Nama,Bab1,Bab2,Bab3,Bab4,Bab5,STS,SAS,Rapor\n'+rows.join('\n')],{type:'text/csv'});
    const l=document.createElement('a');l.href=URL.createObjectURL(b);l.download=`leger-${y.id.replace('/','-')}-kelas${ui.kelas}-smt${ui.sem}.csv`;l.click()}
});
document.addEventListener('change',e=>{
  const t=e.target,d=t.dataset;
  if(d.k){ui[d.k]=t.value;return render()}
  if(d.mv){cur().students.find(s=>s.id===d.mv).kelas=t.value;save();return render()}
  if(d.set){S.settings[d.set]=d.set==='mapel'?t.value:Math.max(0,+t.value||0);save();render()}
});
document.addEventListener('input',e=>{
  const t=e.target,d=t.dataset;
  if(d.k==='q'){ui.q=t.value;const p=t.selectionStart;render();const i=$('[data-k=q]');i.focus();i.setSelectionRange(p,p);return}
  if(d.sid){
    const v=t.value===''?'':Math.min(100,Math.max(0,+t.value)), y=cur();
    ((y.scores[d.sid]??={})[ui.sem]??={})[d.f]=v; save();
    $('#r-'+d.sid).textContent=nilaiAkhir(y.scores[d.sid][ui.sem],S.settings)??'–';
  }
});
S=await api.load(); render();

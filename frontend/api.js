// Lapisan data. Versi awal: localStorage. Nanti ganti isi load/save dengan fetch('/api/state') ke Worker.
const KEY='nilai-siswa:v1';
const seed=()=>({
  settings:{mapel:'PAI',wBab:40,wSts:30,wSas:30},
  years:[{id:'2021/2022',students:[
    {id:'s1',name:'Ahmad Fauzi',kelas:'3'},{id:'s2',name:'Binti Aisyah',kelas:'3'},
    {id:'s3',name:'Candra Wijaya',kelas:'3'},{id:'s4',name:'Dewi Lestari',kelas:'6'}],
   scores:{s1:{2:{b1:80,b2:85,b3:78,b4:90,b5:82,sts:84,sas:88}},s2:{2:{b1:90,b2:92,b3:88,b4:95,b5:91,sts:89,sas:93}}}}]});
export const api={
  async load(){try{return JSON.parse(localStorage.getItem(KEY))||seed()}catch{return seed()}},
  async save(s){localStorage.setItem(KEY,JSON.stringify(s))}
};

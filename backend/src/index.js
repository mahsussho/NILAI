// Worker minimal: GET/PUT /api/state (satu dokumen JSON di D1). Tambahkan autentikasi (mis. Cloudflare Access) sebelum produksi.
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,PUT,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const J=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'Content-Type':'application/json',...cors}});
export default{async fetch(req,env){
  const u=new URL(req.url);
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(u.pathname!=='/api/state')return J({error:'not found'},404);
  if(req.method==='GET'){const r=await env.DB.prepare("SELECT json FROM app_state WHERE id='main'").first();return J(r?JSON.parse(r.json):null)}
  if(req.method==='PUT'){const b=await req.text();JSON.parse(b);
    await env.DB.prepare("INSERT INTO app_state(id,json) VALUES('main',?) ON CONFLICT(id) DO UPDATE SET json=excluded.json,updated_at=CURRENT_TIMESTAMP").bind(b).run();return J({ok:true})}
  return J({error:'method'},405)}};

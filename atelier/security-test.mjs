import fs from "node:fs";
import assert from "node:assert/strict";
const src=fs.readFileSync(new URL("./atelier.js",import.meta.url),"utf8");
const nodes=new Map();
const node=id=>{if(!nodes.has(id))nodes.set(id,{classList:{add(){},remove(){},toggle(){}},value:"",textContent:"",disabled:false,replaceChildren(){},reset(){},setAttribute(){}});return nodes.get(id)};
const document={addEventListener(){},querySelector:q=>node(q),querySelectorAll:()=>[]};
const sessionStorage={removeItem(){},getItem(){return null}};
const run=new Function("document","sessionStorage","crypto",src+`
const xssId=String.fromCharCode(34)+' onclick='+String.fromCharCode(34)+'alert(1)';
const badImage=garmentCard({id:xssId,name:"Zapatos",image:"javascript:alert(1)"});
const goodImage=garmentCard({id:"safe",name:"Prenda",image:"data:image/jpeg;base64,AAAA"});
const badLook=lookCard({id:xssId,name:"Look",garmentIds:[]});
return {badImage,goodImage,badLook,escaped:esc("<script>alert(1)</script>"),logout:showAuth};
`);
const r=run(document,sessionStorage,{randomUUID:()=> "test"});
assert.ok(r.badImage.includes('data-garment="&quot; onclick=&quot;alert(1)"'));
assert.ok(!r.badImage.includes("javascript:"));
assert.ok(r.goodImage.includes("data:image/jpeg;base64,AAAA"));
assert.ok(r.badLook.includes('data-look="&quot; onclick=&quot;alert(1)"'));
assert.equal(r.escaped,"&lt;script&gt;alert(1)&lt;/script&gt;");
r.logout();
console.log("PASS: XSS escaping, photo URL validation, and logout state reset");

const rollbackProbe=new Function("document","sessionStorage","crypto",src+`
return (async()=>{
  appState.profile={id:"noelia"};
  lastSavedData={garments:[{id:"persisted"}],looks:[]};
  appState.data={garments:[{id:"unsaved"}],looks:[]};
  dbSet=async()=>{throw new Error("QuotaExceededError")};
  render=()=>{};
  const ok=await saveState();
  return {ok,ids:appState.data.garments.map(x=>x.id)};
})();
`);
const oldError=console.error;
console.error=()=>{};
let rollback;
try{rollback=await rollbackProbe(document,sessionStorage,{randomUUID:()=>"test"})}finally{console.error=oldError}
assert.equal(rollback.ok,false);
assert.deepEqual(rollback.ids,["persisted"]);
console.log("PASS: Failed IndexedDB writes restore last persisted state");

// Sincronización: fusión por clave con marcas de tiempo, claves desconocidas, borrados frente a ediciones y vestidos en las bases
const syncProbe=new Function("document","sessionStorage","crypto",src+`
const L=normalizeData({preferences:{occasion:"work",temperature:20},feedback:{a:"up"},stamps:{"p:occasion":"2026-10-01","p:temperature":"2026-10-05","f:a":"2026-10-01","f:b":"2026-10-03"},futureKey:{x:1}});
const R=normalizeData({preferences:{occasion:"party",temperature:12},feedback:{a:"down",b:"up"},stamps:{"p:occasion":"2026-10-02","p:temperature":"2026-10-04","f:a":"2026-10-02","f:b":"2026-10-02"}});
const m=mergeData(L,R);
const plan={id:"plan:2026-10-10",date:"2026-10-10",garmentIds:[],updatedAt:"2026-10-09T10:00:00Z"};
const revived=mergeData(normalizeData({plans:[plan]}),normalizeData({deleted:{"plan:2026-10-10":"2026-10-09T09:00:00Z"}})).plans.length;
const stale=mergeData(normalizeData({plans:[{...plan,updatedAt:"2026-10-09T08:00:00Z"}]}),normalizeData({deleted:{"plan:2026-10-10":"2026-10-09T09:00:00Z"}})).plans.length;
const gs=[];for(let i=0;i<25;i++)gs.push({id:"t"+i,category:"Arriba",color:"Blanco"},{id:"b"+i,category:"Abajo",color:"Negro"});gs.push({id:"d1",category:"Vestidos",color:"Rojo"},{id:"d2",category:"Vestidos",color:"Azul"});
const bases=outfitBases(gs);
return {m,revived,stale,bases:bases.length,dresses:bases.filter(b=>b[0].category==="Vestidos").length,tops:new Set(bases.flat().filter(g=>g.category==="Arriba").map(g=>g.id)).size};
`)(document,sessionStorage,{randomUUID:()=>"test"});
assert.equal(syncProbe.m.preferences.occasion,"party","Gana la preferencia cambiada más tarde (remota)");
assert.equal(syncProbe.m.preferences.temperature,20,"Gana la preferencia cambiada más tarde (local)");
assert.equal(syncProbe.m.feedback.a,"down");
assert.equal(syncProbe.m.feedback.b,undefined,"Un 👍 quitado más tarde no debe volver");
assert.deepEqual(syncProbe.m.futureKey,{x:1},"Las claves de versiones futuras se conservan");
assert.equal(syncProbe.revived,1,"Un plan editado después de borrarse debe volver");
assert.equal(syncProbe.stale,0,"Un plan borrado después de su última edición no debe volver");
assert.ok(syncProbe.bases<=400&&syncProbe.dresses===2&&syncProbe.tops===25,"Las bases deben incluir los vestidos y repartir las prendas");
console.log("PASS: Sync merges by key, keeps unknown keys, tombstones vs edits, balanced outfit bases");

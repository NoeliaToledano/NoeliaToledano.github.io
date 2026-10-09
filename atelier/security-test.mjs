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
assert.ok(/background-image:url\((blob:|data:image\/jpeg;base64,AAAA)/.test(r.goodImage),"Una foto válida se pinta (como blob: o data:)");
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

// Motor de estilismo: banco de pruebas con armarios de 20, 100 y 500 prendas
const engineProbe=new Function("document","sessionStorage","crypto",src+`
const COLORS=["Negro","Blanco","Gris","Beige","Azul","Vaquero","Rojo","Verde","Rosa","Marrón"],STY=["casual","casual","smart","sport","party"];
function wardrobe(n){
 const cats=[["Arriba",.3],["Abajo",.2],["Vestidos",.08],["Capas",.12],["Zapatos",.15],["Bolsos",.08],["Accesorios",.07]],g=[];let k=0;
 for(const [c,f] of cats)for(let i=0;i<Math.max(2,Math.round(n*f));i++){k++;g.push({id:c[0]+k,name:c+" "+k,category:c,color:COLORS[k%COLORS.length],style:STY[k%STY.length],season:"all",
  pattern:k%7===0?"stripes":"plain",warmth:c==="Capas"?["bajo","medio","alto"][k%3]:undefined,createdAt:"2026-10-01",updatedAt:"x"})}
 return g;
}
const out={};
for(const n of [20,100,500]){
 appState.profile={id:"noelia"};appState.data=emptyData();appState.data.garments=wardrobe(n);
 const P=appState.data.preferences;P.occasion="daily";
 const t0=Date.now();P.temperature=25;const warm=rankOutfits({max:3});const ms=Date.now()-t0;
 P.temperature=10;const cold=rankOutfits({max:3});
 P.temperature=25;P.occasion="work";const work=rankOutfits({max:3});
 P.occasion="daily";const req=appState.data.garments.find(g=>g.category==="Abajo"),around=rankOutfits({required:req.id,max:5,occasion:null});
 const big=l=>l.garments.filter(g=>["Arriba","Abajo","Vestidos"].includes(g.category)).map(g=>g.id);
 out[n]={ms,
  layersWarm:warm.filter(l=>l.garments.some(g=>g.category==="Capas")).length,
  coldWithLayer:cold.filter(l=>l.garments.some(g=>g.category==="Capas")).length,
  coldCovered:cold.every(l=>l.garments.some(g=>g.category==="Capas")||l.warnings.some(w=>/frío/.test(w))),
  coldWarmest:cold.every(l=>{const c=l.garments.find(g=>g.category==="Capas");return !c||c.warmth==="alto"}),
  shoesDistinct:new Set(warm.map(l=>l.garments.find(g=>g.category==="Zapatos")?.id).filter(Boolean)).size,
  baseOverlap:warm.some((a,i)=>warm.some((b,j)=>j>i&&big(a).some(id=>big(b).includes(id)))),
  workSport:work.some(l=>l.garments.some(g=>g.style==="sport"&&g.category!=="Zapatos")),
  dresses:rankOutfits({max:40}).filter(l=>l.garments.some(g=>g.category==="Vestidos")).length,
  required:around.every(l=>l.ids.includes(req.id)),
  reasons:warm.every(l=>Array.isArray(l.reasons)),
  dup:new Set(warm.map(l=>l.ids.slice().sort().join("|"))).size===warm.length};
}
return out;
`)(document,sessionStorage,{randomUUID:()=>"test"});
for(const [n,r] of Object.entries(engineProbe)){
 assert.equal(r.layersWarm,0,n+": sin capa a 25 °C");
 assert.ok(r.coldCovered&&r.coldWithLayer>=(n==="20"?1:3),n+": a 10 °C, capa (o aviso si ninguna combina)");
 if(n!=="20")assert.ok(r.coldWarmest,n+": con frío, la capa que más abriga");
 assert.ok(r.shoesDistinct>=2,n+": calzado variado entre las 3 propuestas");
 assert.ok(!r.baseOverlap,n+": las 3 propuestas no repiten prendas principales");
 assert.ok(!r.workSport,n+": «Trabajo» no propone ropa de deporte (las deportivas sí, como smart casual)");
 assert.ok(r.dresses>=1,n+": los vestidos aparecen");
 assert.ok(r.required&&r.reasons&&r.dup,n+": prenda obligatoria, motivos y sin duplicados");
 assert.ok(r.ms<1500,n+": rankOutfits en "+r.ms+" ms");
}
console.log("PASS: Styling engine (20/100/500 prendas): capas según tiempo, variedad, ocasión, vestidos — tiempos "+Object.entries(engineProbe).map(([n,r])=>n+":"+r.ms+"ms").join(" "));

// Estilos flexibles (#52): deportivas + vaqueros + americana sí; mallas + sudadera en informal; nada de gimnasio en boda ni con vestido de fiesta
const styleProbe=new Function("document","sessionStorage","crypto",src+`
const G=(id,category,color,style,extra={})=>({id,name:id,category,color,style,season:"all",pattern:"plain",createdAt:"2026-10-01",updatedAt:"x",...extra});
appState.profile={id:"noelia"};appState.data=emptyData();
const W=appState.data.garments=[G("camiseta","Arriba","Blanco","casual"),G("vaquero","Abajo","Vaquero","casual"),G("deportivas","Zapatos","Blanco","sport"),
 G("americana","Capas","Negro","smart",{warmth:"bajo"}),G("mocasines","Zapatos","Marrón","smart"),G("vestido-fiesta","Vestidos","Negro","party"),
 G("mallas","Abajo","Negro","sport"),G("sudadera","Arriba","Gris","sport"),G("tacones","Zapatos","Negro","party"),G("pantalon-traje","Abajo","Negro","smart"),G("blusa","Arriba","Blanco","smart")];
const by=id=>W.find(g=>g.id===id),P=appState.data.preferences;P.temperature=18;
const ctx=d=>engineContext({occasion:"daily",dress:d});
const smartCasual=scoreOutfit([by("camiseta"),by("vaquero"),by("deportivas"),by("americana")],ctx("arreglada"));
P.dressStyle="informal";const informal=rankOutfits({max:6,occasion:"daily"});
P.dressStyle=null;const wedding=rankOutfits({max:5,occasion:"formal"});
return {smartCasual:smartCasual.score,smartReasons:smartCasual.reasons,completes:completeOutfit([by("camiseta"),by("vaquero")],W,ctx("arreglada")).map(g=>g.id),
 sportParty:pairs(by("mallas"),by("vestido-fiesta"))||stylesOk(by("sudadera"),by("vestido-fiesta")),sportCasual:pairs(by("sudadera"),by("vaquero")),
 informalSport:informal.some(l=>l.ids.includes("mallas")&&l.ids.includes("sudadera")),
 weddingSport:wedding.some(l=>l.garments.some(g=>g.style==="sport")),weddingCount:wedding.length,
 dressParty:rankOutfits({max:20,occasion:null}).some(l=>l.ids.includes("vestido-fiesta")&&l.garments.some(g=>g.style==="sport"&&g.category!=="Zapatos"))};
`)(document,sessionStorage,{randomUUID:()=>"test"});
assert.ok(styleProbe.smartCasual>=60,"Deportivas + vaqueros + americana debe puntuar bien en «arreglada» ("+styleProbe.smartCasual+")");
assert.ok(styleProbe.smartReasons.some(r=>/deportivas/i.test(r)),"Explica la mezcla con deportivas");
assert.ok(!styleProbe.sportParty,"Ropa de deporte con vestido de fiesta: no");
assert.ok(styleProbe.sportCasual,"Sudadera deportiva con vaqueros: sí");
assert.ok(styleProbe.informalSport,"En «informal» se proponen mallas + sudadera");
assert.ok(!styleProbe.weddingSport&&styleProbe.weddingCount>=1,"Ocasión formal: sin ropa de gimnasio");
assert.ok(!styleProbe.dressParty,"El vestido de fiesta nunca con prendas deportivas");
console.log("PASS: Flexible styles (#52): athleisure, sport+casual, no gym clothes at formal events");

// Revisiones de Codex: planes antiguos con id aleatorio → uno por día; ocasión sin prendas → sin looks inventados
const codexProbe=new Function("document","sessionStorage","crypto",src+`
const legacy=normalizeData({plans:[{id:"a1",date:"2026-10-10",garmentIds:["x"],updatedAt:"2026-10-01"},{id:"b2",date:"2026-10-10",garmentIds:["y"],updatedAt:"2026-10-02"},{id:"plan:2026-10-11",date:"2026-10-11",garmentIds:["z"],updatedAt:"x"}]});
const merged=mergeData(normalizeData({plans:[{id:"c3",date:"2026-10-12",garmentIds:["p"],updatedAt:"2026-10-05"}]}),{plans:[{id:"d4",date:"2026-10-12",garmentIds:["q"],updatedAt:"2026-10-06"}]});
appState.profile={id:"noelia"};appState.data=emptyData();
appState.data.garments=[{id:"t",category:"Arriba",color:"Blanco",style:"casual"},{id:"b",category:"Abajo",color:"Negro",style:"casual"}];
return {legacy:legacy.plans.map(p=>p.id+"="+p.garmentIds[0]).sort().join(","),merged:merged.plans.map(p=>p.id+"="+p.garmentIds[0]).join(","),formal:rankOutfits({occasion:"formal",max:3}).length,daily:rankOutfits({occasion:"daily",max:3}).length};
`)(document,sessionStorage,{randomUUID:()=>"test"});
assert.equal(codexProbe.legacy,"plan:2026-10-10=y,plan:2026-10-11=z","Planes antiguos: un plan por día, gana el más reciente");
assert.equal(codexProbe.merged,"plan:2026-10-12=q","Fusión: dos planes del mismo día de dos móviles → uno");
assert.equal(codexProbe.formal,0,"Ocasión formal sin prendas formales: no se inventan looks informales");
assert.ok(codexProbe.daily>=1);
console.log("PASS: Codex review fixes: legacy plan ids, same-day plans, strict occasion filter");

// B4/B6: sesiones revocables por perfil, renovación deslizante y CORS común
{
  process.env.ATELIER_SESSION_SECRET="test-secret";
  const auth=await import("../atelier-api/_lib/auth.js");
  const sessionApi=(await import("../atelier-api/api/session.js")).default;
  const call=(token,origin="https://noeliatoledano.github.io")=>{const res={h:{},code:0,body:null,setHeader(k,v){this.h[k]=v},status(c){this.code=c;return this},json(b){this.body=b;return this},end(){return this}};
    sessionApi({method:"GET",headers:{authorization:"Bearer "+token,origin}},res);return res};
  const t=auth.issueSession("noelia");
  let r=call(t);assert.equal(r.code,200);assert.equal(r.body.profileId,"noelia");assert.equal(r.body.token,undefined,"Sesión reciente: sin renovación");
  assert.equal(r.h["Access-Control-Allow-Origin"],"https://noeliatoledano.github.io");
  assert.equal(call(t,"https://evil.example").h["Access-Control-Allow-Origin"],undefined,"CORS: origen ajeno sin permiso");
  // Sesión antigua (firmada hace 10 días, sin versión): sigue valiendo y se renueva
  const crypto=await import("node:crypto"),now=Math.floor(Date.now()/1000);
  const sign=p=>{const e=Buffer.from(JSON.stringify(p)).toString("base64url");return e+"."+crypto.createHmac("sha256","test-secret").update(e).digest("base64url")};
  r=call(sign({sub:"noelia",iat:now-864000,exp:now+864000}));assert.equal(r.code,200);assert.ok(r.body.token,"Sesión de más de 7 días: se renueva");
  assert.equal(call(r.body.token).body.token,undefined);
  // Revocación: subir la versión del perfil invalida sus sesiones, no las de otros
  const ana=auth.issueSession("ana-maria");
  process.env.ATELIER_SESSION_VERSION_NOELIA="2";
  assert.equal(call(t).code,401,"Versión subida: sesión revocada");
  assert.equal(call(ana).code,200,"Otros perfiles no se ven afectados");
  assert.equal(call(auth.issueSession("noelia")).code,200,"Nueva sesión con la versión nueva");
  delete process.env.ATELIER_SESSION_VERSION_NOELIA;
  assert.equal(call(sign({sub:"intruso",iat:now,exp:now+100})).code,401,"Perfil desconocido");
  const src=["analyze","looks"].map(f=>fs.readFileSync(new URL("../atelier-api/api/"+f+".js",import.meta.url),"utf8")).join("");
  assert.ok(!/detail:\s*data/.test(src),"B6: sin detalles de OpenAI en las respuestas");
  console.log("PASS: B4/B6 revocable sessions, sliding renewal, shared CORS, generic errors");
}

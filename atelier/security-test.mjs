import fs from "node:fs";
import {execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
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

const weatherProbe=new Function("document","sessionStorage","crypto",src+";return {hot:weatherCompatible({category:\"Accesorios\",name:\"Gorro de lana\"},[],{temp:27}),cold:weatherCompatible({category:\"Zapatos\",name:\"Chanclas\"},[],{temp:9}),mixed:weatherCompatible({category:\"Accesorios\",name:\"Gorro de lana\"},[{category:\"Zapatos\",name:\"Chanclas\"}],{temp:16}),summer:weatherCompatible({category:\"Zapatos\",name:\"Sandalias\"},[{category:\"Vestidos\",name:\"Vestido ligero\"}],{temp:27})}")(document,sessionStorage,crypto);
assert.deepEqual(weatherProbe,{hot:false,cold:false,mixed:false,summer:true});
console.log("PASS: coherent warm/cold footwear and accessories");
const beachFootwearProbe=new Function("document","sessionStorage","crypto",src+`
appState.profile={id:"audit"};appState.data=emptyData();
appState.data.garments=[
 {id:"swim",name:"Bañador",category:"Baño",color:"Azul",style:"sport",season:"all"},
 {id:"flip",name:"Chanclas",type:"Otro",category:"Zapatos",color:"Negro",style:"casual",season:"all"}
];
appState.data.preferences.occasion="beach";
return rankOutfits({occasion:"beach",temp:28,max:2}).map(l=>l.ids);
`)(document,sessionStorage,{randomUUID:()=>"test"});
assert.ok(beachFootwearProbe.length>0&&beachFootwearProbe[0].includes("flip"),"Playa debe admitir chanclas aunque su tipo sea Otro");
console.log("PASS: beach includes flip-flops recognized by name");
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

// S3: descarga de fotos en paralelo, guardada al llegar; una foto que falla no bloquea las demás ni el estado
const s3Probe=new Function("document","sessionStorage","crypto",src+`
return (async()=>{
  toast=()=>{};const IMG="data:image/jpeg;base64,AAAA",s={imgs:{}};let calls=0,active=0,peak=0;
  const data=normalizeData({garments:[1,2,3,4,5,6,7,8].map(i=>({id:"g"+i,name:"p"+i,category:"Arriba",updatedAt:"x"}))});
  const call=async path=>{calls++;active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;
    if(path.includes("g3"))throw new TypeError("Failed to fetch");if(path.includes("g5"))return {status:500,body:{}};return {status:200,body:{image:IMG}}};
  const server=new Set(data.garments.map(g=>g.id));
  const failed=await downloadImages(data,server,call,s,"noelia");
  const got=data.garments.filter(g=>g.image).length;
  // Reintento de la fusión (otra copia de los datos): solo se piden las que faltaban
  const again=normalizeData({garments:data.garments.map(g=>({...g,image:undefined}))});calls=0;
  const failed2=await downloadImages(again,server,call,s,"noelia");
  let fatal=null;try{await downloadImages(normalizeData({garments:[{id:"g9",updatedAt:"x"}]}),new Set(["g9"]),async()=>{throw new Error("SESSION_EXPIRED")},s,"noelia")}catch(e){fatal=e.message}
  // Subida: una foto rechazada (413) no bloquea las demás y no se reintenta
  appState.profile={id:"noelia"};appState.data=normalizeData({garments:["a","b","c"].map(id=>({id,name:id,category:"Arriba",image:IMG,updatedAt:"x"}))});
  const up=new Set(),us={imgs:{}};let posts=0;
  const callUp=async(p,o)=>{posts++;const id=JSON.parse(o.body).id;return id==="b"?{status:413,body:{}}:{status:200,body:{}}};
  const upFailed=await uploadImages(up,callUp,us);const posts1=posts;await uploadImages(up,callUp,us);
  return {failed,got,peak,calls2:calls,failed2,fatal,upFailed,uploaded:[...up].sort().join(),posts1,posts2:posts-posts1};
})();
`);
const s3=await s3Probe(document,sessionStorage,{randomUUID:()=>"t"});
assert.equal(s3.failed,2,"Dos fotos fallan (red y 500)");assert.equal(s3.got,6,"Las demás se descargan");
assert.ok(s3.peak>1&&s3.peak<=4,"Descarga en paralelo, máximo 4 a la vez");
assert.equal(s3.calls2,2,"Reintento: solo se piden las que faltaban");assert.equal(s3.failed2,2);
assert.equal(s3.fatal,"SESSION_EXPIRED","Una sesión caducada sí detiene la sincronización");
assert.equal(s3.upFailed,1);assert.equal(s3.uploaded,"a,c","Una foto rechazada no bloquea las demás");
assert.equal(s3.posts2,0,"La foto rechazada no se reintenta hasta que cambie");
console.log("PASS: S3 photo sync: parallel downloads kept on arrival, per-photo failures don't block");

// R4: sincronización ligera — si nada cambió en el servidor, no se descarga el armario
const r4Probe=new Function("document","sessionStorage","crypto",src+`
return (async()=>{
  dbSet=async()=>{};render=()=>{};toast=()=>{};scheduleSync=()=>{};
  appState.profile={id:"noelia"};appState.token="t";appState.data=normalizeData({garments:[{id:"g1",name:"a",category:"Arriba",updatedAt:"x"}]});
  sync={...freshSync(),ever:true,rev:5};const urls=[];
  syncFetch=async(path,o={})=>{urls.push((o.method||"GET")+" "+path);
    if(o.method==="PUT")return {status:200,body:{rev:6}};
    return path.includes("since=5")?{status:200,body:{rev:5,unchanged:true,images:[]}}:{status:200,body:{rev:6,data:null,images:[]}}};
  await syncNow();const clean=urls.slice();urls.length=0;
  sync.dirty=true;await syncNow();
  return {clean,dirty:urls,garments:appState.data.garments.length,rev:sync.rev,status:sync.status};
})();
`);
const r4=await r4Probe(document,sessionStorage,{randomUUID:()=>"t"});
assert.deepEqual(r4.clean,["GET /api/sync?since=5"],"Al día: una sola petición ligera, sin subir nada");
assert.deepEqual(r4.dirty,["GET /api/sync?since=5","PUT /api/sync"],"Con cambios locales: se suben sin descargar el armario");
assert.equal(r4.garments,1);assert.equal(r4.rev,6);assert.equal(r4.status,"ok");
console.log("PASS: R4 light sync: rev-only check when nothing changed");

// S6: un móvil sin sincronizar más de 90 días no resucita lo borrado (lápidas ya caducadas)
const s6Probe=new Function("document","sessionStorage","crypto",src+`
const last="2026-01-01T00:00:00Z";
const local=normalizeData({garments:[{id:"old",name:"borrada en otro móvil",category:"Arriba",updatedAt:"2025-12-01T00:00:00Z"},{id:"kept",name:"en ambos",category:"Arriba",updatedAt:"2025-12-01T00:00:00Z"},{id:"new",name:"creada sin conexión",category:"Arriba",updatedAt:"2026-02-01T00:00:00Z"}]});
const remote=normalizeData({garments:[{id:"kept",name:"en ambos",category:"Arriba",updatedAt:"2025-12-01T00:00:00Z"}]});
return {stale:mergeData(local,remote,last).garments.map(g=>g.id).sort().join(),normal:mergeData(local,remote).garments.length};
`);
const s6=s6Probe(document,sessionStorage,{randomUUID:()=>"t"});
assert.equal(s6.stale,"kept,new","Más de 90 días sin conexión: lo borrado en otro móvil no vuelve; lo nuevo se conserva");
assert.equal(s6.normal,3,"Sin caducidad: la fusión normal no cambia");
console.log("PASS: S6 long-offline devices don't resurrect deletions");
// R3: el Worker de fotos se construye con las funciones de atelier.js y la CSP lo permite sin bloquear el service worker
{
  const probe=new Function("document","sessionStorage","crypto",src+`return photoWorkerSource()`);
  const ws=probe(document,sessionStorage,{randomUUID:()=>"t"});
  new Function(ws); // sintaxis válida
  for(const fn of ["garmentMask","whiteBackground","retouchOnly","isCatalogPhoto","enhancePhotoHere","mkCanvas","toJpeg","labArrays","applyTone","sharpen","quantile","curveLUT","SRGB_LIN","MASK_MAX"])assert.ok(ws.includes(fn),"Worker incluye "+fn);
  const html=fs.readFileSync(new URL("./index.html",import.meta.url),"utf8");
  assert.ok(/worker-src &#39;self&#39; blob:/.test(html),"CSP: Worker de fotos (blob:) y service worker ('self')");
  console.log("PASS: R3 photo Worker source and CSP");
}

// B5: «¿Lo compro?» no llama a la IA sola; el color se estima en el móvil
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const lab=rgb=>{const [L,A,B]=labArrays(Uint8ClampedArray.from([...rgb,255]),1);return colorName(L[0],A[0],B[0])};
  return {names:[[20,20,22],[245,245,240],[128,128,128],[40,40,200],[110,60,140],[200,30,40],[230,150,175],[214,196,164],[110,72,45],[60,130,70],[230,205,50],[80,105,140]].map(lab).join(),
   start:String(startBuyCheck)};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.equal(r.names,"Negro,Blanco,Gris,Azul,Morado,Rojo,Rosa,Beige,Marrón,Verde,Amarillo,Vaquero");
  assert.ok(!r.start.includes("/api/analyze"),"B5: la foto de «¿Lo compro?» no se analiza con IA automáticamente");
  console.log("PASS: B5 buy check: local colour estimate, AI only on demand");
}

// Fondo blanco por defecto (decisión de Noelia, 09/10): también con recorte dudoso; solo un recorte roto conserva el fondo
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  return (async()=>{isCatalogPhoto=async()=>false;retouchOnly=async()=>"data:image/jpeg;base64,RETOQUE";
   const run=async w=>{whiteBackground=async()=>w;return enhancePhotoHere("data:image/jpeg;base64,X")};
   return {ok:await run({image:"W",doubtful:false}),doubtful:await run({image:"W",doubtful:true,broken:false}),broken:await run({image:"W",doubtful:true,broken:true}),none:await run(null)};
  })();`);
  const r=await probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.equal(r.ok.image,"W");assert.equal(r.ok.white,true);
  assert.equal(r.doubtful.image,"W","Recorte dudoso: fondo blanco por defecto");assert.equal(r.doubtful.retouched,"data:image/jpeg;base64,RETOQUE","…con el retoque como alternativa");
  assert.equal(r.broken.white,false,"Recorte roto: se conserva el fondo");assert.equal(r.broken.doubtfulWhite,"W","…y el fondo blanco se ofrece aparte");
  assert.equal(r.none.white,false);
  console.log("PASS: White background by default (doubtful cutouts too; broken ones keep the background)");
}

// Regla obligatoria (Noelia, 09/10): todo look lleva arriba y abajo, o vestido/mono
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=c=>({category:c});
  return {cases:[["Arriba","Abajo"],["Vestidos"],["Arriba","Zapatos"],["Abajo","Capas","Zapatos"],["Casa"],["Baño"],[]].map(a=>lookComplete(a.map(G))).join(),
   engine:(()=>{appState.profile={id:"noelia"};appState.data=normalizeData({garments:[
     ...["Arriba","Arriba","Abajo","Abajo","Vestidos","Zapatos","Zapatos","Capas","Bolsos"].map((c,i)=>({id:"g"+i,name:c+i,category:c,color:["Negro","Blanco","Beige","Azul"][i%4],style:"casual",season:"all",updatedAt:"x"}))]});
     const all=[...rankOutfits({max:6}),...["g5","g7","g8"].flatMap(id=>rankOutfits({required:id,max:4,occasion:null}))];
     return all.length>0&&all.every(r=>lookComplete(r.garments));})()};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.equal(r.cases,"true,true,false,false,true,true,false");
  assert.ok(r.engine,"El motor (Hoy, Mi semana, Combinar prenda) solo propone looks completos, también partiendo de zapatos, capa o bolso");
  const ai=fs.readFileSync(new URL("../atelier-api/api/looks.js",import.meta.url),"utf8");assert.ok(ai.includes("c=Arriba y c=Abajo, o c=Vestidos"));
  console.log("PASS: Looks always have top+bottom or a dress/jumpsuit");
}

// «Guardar el look que llevo»: /api/analyze con mode "outfit" devuelve prendas validadas (tipos y recuadros acotados)
{
  process.env.ATELIER_SESSION_SECRET="test-secret";process.env.OPENAI_API_KEY="k";
  const auth=await import("../atelier-api/_lib/auth.js"),analyze=(await import("../atelier-api/api/analyze.js")).default;
  const realFetch=globalThis.fetch;let prompt="";
  globalThis.fetch=async(url,o)=>{const b=JSON.parse(o.body);prompt=b.input[0].content[0].text;return {ok:true,json:async()=>({output_text:JSON.stringify({items:[
    {type:"top",name:"Camiseta",color:"Blanco",box:[30,20,40,30]},{type:"underwear",name:"x",box:[0,0,10,10]},{type:"shoes",name:"Zapatos",box:[90,95,50,50]},{type:"bag",name:"Bolso"}]})})}};
  const res={code:0,body:null,h:{},setHeader(k,v){this.h[k]=v},status(c){this.code=c;return this},json(b){this.body=b;return this},end(){return this}};
  await analyze({method:"POST",headers:{authorization:"Bearer "+auth.issueSession("noelia"),origin:"https://noeliatoledano.github.io"},body:{image:"data:image/jpeg;base64,AAAA",mode:"outfit"}},res);
  globalThis.fetch=realFetch;
  assert.equal(res.code,200);assert.ok(prompt.includes("box"),"Prompt de looks");
  assert.deepEqual(res.body.items.map(x=>x.type),["top","shoes","bag"],"Sin ropa interior");
  assert.deepEqual(res.body.items[1].box,[90,95,10,5],"Recuadro dentro de la imagen");
  assert.deepEqual(res.body.items[2].box,[0,0,100,100],"Sin recuadro: la foto entera");
  console.log("PASS: Outfit photo analysis returns validated garments with boxes");
}

// Motivo de un recorte fallido, para la guía de fotos
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  return (async()=>{isCatalogPhoto=async()=>false;retouchOnly=async()=>"data:image/jpeg;base64,R";
   const run=async(w,reason)=>{whiteBackground=async(src,info)=>{if(info&&reason)info.reason=reason;return w};return (await enhancePhotoHere("data:image/jpeg;base64,X")).reason};
   return [await run(null,"fondo"),await run(null,"contraste"),await run({image:"W",doubtful:true,broken:true}),await run({image:"W",doubtful:false})].join()+"|"+Object.keys(PHOTO_TIPS).join();
  })();`);
  const r=await probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.equal(r,"fondo,contraste,roto,|fondo,contraste,encuadre,roto");
  console.log("PASS: Failed cutouts report a reason with a photo tip");
}

/* Quality benchmark harness: 72 context runs over a local fixture.
   The external 1000-photo dataset is a separate offline/manual evaluation. */
{
 const root=dirname(fileURLToPath(import.meta.url));
 const resultFile=join(tmpdir(),"atelier-look-audit-"+process.pid+".json");
 try{
  execFileSync(process.execPath,[join(root,"benchmarks/evaluate-outfits.mjs"),
   join(root,"benchmarks/sample-garments.json"),resultFile],{timeout:90000});
  const report=JSON.parse(fs.readFileSync(resultFile,"utf8"));
  assert.equal(report.scenarios.length,72,"4 armarios × 3 temperaturas × 6 ocasiones");
  assert.ok(report.looks.length>0,"Debe generar looks auditables");
  assert.equal(report.looks.filter(l=>l.flags.includes("mixed_summer_winter")||
    l.flags.includes("summer_shoes_in_cold")||l.flags.includes("winter_hat_in_heat")).length,0,
    "El motor no debe producir complementos incompatibles con la temperatura");
  console.log("PASS: Visual look benchmark harness generated "+report.looks.length+" reviewed-ready outfits");
 }finally{try{fs.unlinkSync(resultFile)}catch{}}
}

// Evaluación visual #99: trabajo sin prendas informales ni gorras; gorros y sombreros solo con motivo
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,color,style="casual",season="all",extra={})=>({id,name:type+" "+color,category,type,color,style,season,updatedAt:"x",...extra});
  appState.profile={id:"noelia"};appState.data=normalizeData({garments:[
   G("t1","Arriba","Camiseta","Blanco"),G("t2","Arriba","Camisa","Azul","smart"),G("b1","Abajo","Shorts","Vaquero","casual","warm"),G("b2","Abajo","Pantalón","Negro","smart"),
   G("z1","Zapatos","Zuecos","Verde","casual","warm"),G("z2","Zapatos","Mocasines","Marrón","smart"),G("z3","Zapatos","Sandalias","Beige","casual","warm"),
   G("c1","Capas","Abrigo","Negro","casual","cold",{warmth:"alto"}),
   G("h1","Accesorios","Gorro","Gris","casual","cold"),G("h2","Accesorios","Gorra","Negro"),G("h3","Accesorios","Sombrero","Beige","casual","warm")]});
  const ids=o=>rankOutfits(o).map(r=>r.ids);
  const work=[...ids({max:3,occasion:"work",date:"2026-07-15",temp:28}),...ids({max:3,occasion:"work",date:"2026-01-15",temp:8})].flat();
  const daily28=ids({max:3,occasion:"daily",date:"2026-07-15",temp:28}).flat(),daily17=ids({max:3,occasion:"daily",date:"2026-04-15",temp:17}).flat(),daily6=ids({max:3,occasion:"daily",date:"2026-01-15",temp:6}).flat();
  return {work,daily28,daily17,daily6};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  for(const id of ["b1","z1","z3","h1","h2","h3"])assert.ok(!r.work.includes(id),"Trabajo sin "+id);
  assert.ok(r.work.includes("z2"),"Trabajo con mocasines");
  assert.ok(!r.daily17.some(id=>["h1","h2","h3"].includes(id)),"A 17 °C, sin gorros ni sombreros");
  assert.ok(!r.daily28.includes("h1"),"Gorro de lana nunca con calor");
  assert.ok(r.daily6.every(id=>!["h2","h3"].includes(id)),"Con frío, sin gorra ni sombrero");
  console.log("PASS: #99 work looks without casual pieces; headwear only when it makes sense");
}

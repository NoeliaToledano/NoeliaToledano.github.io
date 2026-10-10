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
const qualityProbe=new Function("document","sessionStorage","crypto",src+`
const garment=(category,name,color="Negro")=>({id:name,name,category,color,style:"casual",season:"all"});
const fallback=garment("Zapatos","Mocasines marrones");
return {warm:heavyKnitInHeat(garment("Arriba","Jersey grueso"),27),
 light:heavyKnitInHeat(garment("Arriba","Jersey fino"),27),
 cold:insufficientColdLayer(garment("Capas","Chaleco acolchado"),8),
 mild:insufficientColdLayer(garment("Capas","Chaleco acolchado"),17),
 formal:smartFallbackShoes(fallback),
 bright:vividColorRepeat([garment("Arriba","a","Rojo"),garment("Abajo","b","Rojo"),garment("Capas","c","Rojo")])};
`)(document,sessionStorage,{randomUUID:()=>"test"});
assert.deepEqual(qualityProbe,{warm:true,light:false,cold:true,mild:false,formal:true,bright:1});
console.log("PASS: P2/P5/P7/P9 styling context regressions");
// P7: Mocasines casual de temporada son alternativa válida si no hay zapatos de fiesta.
const formalFallbackProbe=new Function("document","sessionStorage","crypto",src+`
appState.profile={id:"audit"};appState.data=emptyData();
appState.data.garments=[
 {id:"shirt",name:"Camisa",category:"Arriba",color:"Blanco",style:"smart",season:"all"},
 {id:"pants",name:"Pantalón",category:"Abajo",color:"Negro",style:"smart",season:"all"},
 {id:"loafer",name:"Mocasines negros",category:"Zapatos",color:"Negro",style:"casual",season:"all"}
];
return rankOutfits({occasion:"party",temp:17,max:2}).map(l=>l.ids);
`)(document,sessionStorage,{randomUUID:()=>"test"});
assert.ok(formalFallbackProbe.length&&formalFallbackProbe[0].includes("loafer"),"La fiesta debe recuperar mocasines aunque sean casual");
console.log("PASS: P7 formal fallback bypasses occasion footwear filter");
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

// Cerebro de estilista (#160): relaciones entre pares, coherencia global y solo piezas que aportan
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,color,extra={})=>({id,name:type+" "+color,category,type,color,style:"casual",season:"all",pattern:"plain",updatedAt:"x",...extra});
  appState.profile={id:"noelia"};const by=id=>myGarments().find(g=>g.id===id),out={};
  // 1) La tercera pieza se mide con todas: la americana de cuadros va con la camisa, no con el pantalón de rayas
  appState.data=normalizeData({garments:[G("t","Arriba","Camisa","Blanco",{style:"smart",sleeve:"larga"}),G("p","Abajo","Pantalón","Azul",{style:"smart",pattern:"stripes"}),
   G("c","Capas","Americana","Gris",{style:"smart",warmth:"bajo",pattern:"checks"}),G("z","Zapatos","Mocasines","Negro",{style:"smart"}),G("a","Accesorios","Pañuelo","Rosa",{pattern:"graphic"})]});
  let ctx=engineContext({occasion:"daily",temp:18,date:"2026-04-15"});
  out.ct=relationOf(by("c"),by("t"),ctx).s;out.cp=relationOf(by("c"),by("p"),ctx).s;
  out.third=rankOutfits({max:3,occasion:"daily",temp:18,date:"2026-04-15"}).map(l=>l.ids);
  // 2) Mezcla intencionada: americana con vaquero no resta
  appState.data=normalizeData({garments:[G("t","Arriba","Camiseta","Blanco"),G("j","Abajo","Vaqueros","Vaquero"),G("s","Zapatos","Deportivas","Blanco",{style:"sport"}),
   G("b","Capas","Americana","Negro",{style:"smart",formality:"smartcasual",warmth:"bajo"})]});
  ctx=engineContext({occasion:"daily",temp:16,date:"2026-04-15"});
  out.mix=intentionalMix(by("b"),by("j"));out.mixS=relationOf(by("b"),by("j"),ctx).s;
  out.mixLook=rankOutfits({max:1,occasion:"daily",temp:16,date:"2026-04-15"})[0].ids;
  out.combina=relationsFor(by("j")).map(x=>x.g.id+":"+x.r.register);
  out.combinaOcc=["daily","work","party"].map(o=>relationsFor(by("j"),.6,o).every(x=>x.r.contexts.includes(o)&&occasionFits(x.g,o)&&occasionFits(by("j"),o)));
  // 3) Sin calzado coherente: aviso, no un calzado malo
  appState.data=normalizeData({garments:[G("t","Arriba","Blusa","Azul",{style:"party",formality:"party"}),G("p","Abajo","Falda","Azul",{style:"party",formality:"party"}),
   G("z","Zapatos","Chanclas","Naranja",{style:"sport",formality:"sport",pattern:"graphic"})]});
  const party=rankOutfits({max:1,occasion:"party",temp:22,date:"2026-07-15"})[0];out.partyIds=party.ids;out.partyWarn=party.warnings;
  // 4) Arriba + abajo sin calzado ni extras es un look válido; un complemento solo entra si suma
  appState.data=normalizeData({garments:[G("t","Arriba","Camiseta","Blanco"),G("j","Abajo","Vaqueros","Vaquero"),G("a","Accesorios","Pañuelo","Verde",{pattern:"graphic"})]});
  appState.data.preferences.extras={shoes:false,bag:false};
  out.two=rankOutfits({max:1,occasion:"daily",temp:24,date:"2026-07-15"})[0]?.ids;
  // 5) Edición sincronizada con fecha anterior al máximo: la relación se recalcula (revisión de ChatGPT, #164)
  appState.data=normalizeData({garments:[G("A","Arriba","Blusa","Blanco",{updatedAt:"2026-10-09T10:00:00Z"}),G("B","Abajo","Pantalón","Negro",{updatedAt:"2026-10-01T10:00:00Z"}),
   G("C","Arriba","Camisa","Azul",{updatedAt:"2026-10-02T10:00:00Z",pattern:"stripes"})]});
  ensureRelations();const before=pairEvidence(by("B"),by("C")).colorKind;
  by("B").pattern="checks";ensureRelations();out.remote=[before,pairEvidence(by("B"),by("C")).colorKind];
  // 6) Mono (categoría Vestidos): núcleo de una sola pieza, sin parte de abajo
  appState.data=normalizeData({garments:[G("m","Vestidos","Mono largo","Negro",{style:"smart"}),G("t","Arriba","Camiseta","Blanco"),G("j","Abajo","Vaqueros","Vaquero"),G("z","Zapatos","Sandalias","Negro")]});
  appState.data.preferences.extras={shoes:true,bag:false};
  out.mono=rankOutfits({max:3,occasion:"daily",temp:26,date:"2026-07-15"}).map(l=>l.ids).filter(ids=>ids.includes("m"));out.monoNucleus=nucleusOf([by("m"),by("z")]).map(g=>g.id);
  // 7) Bolso activado en Ajustes, pero el único choca con el look: mejor sin bolso
  appState.data=normalizeData({garments:[G("t","Arriba","Blusa","Azul",{style:"party",formality:"party"}),G("p","Abajo","Falda","Azul",{style:"party",formality:"party"}),
   G("z","Zapatos","Tacones","Negro",{style:"party",formality:"party"}),G("b","Bolsos","Mochila","Naranja",{style:"sport",formality:"sport",pattern:"graphic"})]});
  out.badBag=rankOutfits({max:1,occasion:"party",temp:22,date:"2026-07-15",extras:{shoes:true,bag:true}})[0].ids;
  // 8) Con 17 °C la capa es opcional: unos tacones que «permiten» añadir la americana no ganan a unas deportivas que combinan mejor con la sudadera
  appState.data=normalizeData({garments:[G("s","Arriba","Sudadera","Gris",{formality:"casual"}),G("j","Abajo","Vaqueros","Vaquero",{formality:"casual"}),G("d","Zapatos","Deportivas","Negro",{occasions:["daily"]}),
   G("h","Zapatos","Tacones","Beige",{style:"party",formality:"party",occasions:["party","event","work"]}),G("b","Capas","Blazer","Beige",{style:"smart",formality:"smartcasual",warmth:"bajo"})]});
  out.optLayer=rankOutfits({max:1,occasion:"daily",temp:17,date:"2026-04-15"})[0].ids;
  // 9) Con 15 °C la capa no es obligatoria, pero si sin ella hay aviso de frío, cuenta: se elige el calzado que la admite (revisión de Codex, #168)
  appState.data=normalizeData({garments:[G("tp","Arriba","Top","Negro",{style:"party",formality:"party",sleeve:"sin mangas",thickness:"ligero"}),G("fd","Abajo","Falda","Negro",{style:"party",formality:"party",length:"cropped",thickness:"ligero"}),
   G("dp","Zapatos","Deportivas","Naranja",{style:"sport",formality:"sport",pattern:"graphic",favorite:true,occasions:["daily","party"]}),G("tc","Zapatos","Tacones","Negro",{style:"party",formality:"party"}),
   G("cz","Capas","Chaqueta de cuero","Negro",{style:"party",formality:"party",warmth:"medio",pattern:"checks"})]});
  const cl=rankOutfits({max:1,occasion:"party",temp:15,date:"2026-04-15"})[0];out.coolLayer={ids:cl.ids,warnings:cl.warnings};
  return out;`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.ok(r.coolLayer.ids.includes("cz")&&!r.coolLayer.warnings.some(w=>/frío/.test(w)),"15 °C con aviso de frío sin capa: la capa se mantiene ("+JSON.stringify(r.coolLayer)+")");
  assert.ok(r.optLayer.includes("d")&&!r.optLayer.includes("h"),"Capa opcional: no se eligen tacones solo para poder añadirla ("+r.optLayer+")");
  assert.ok(r.ct>=.6&&r.cp<.6,"La americana de cuadros combina con la camisa ("+r.ct+") pero no con el pantalón de rayas ("+r.cp+")");
  assert.ok(r.third.every(ids=>!(ids.includes("c")&&ids.includes("p"))),"La tercera pieza se mide con todas: sin americana de cuadros con pantalón de rayas");
  assert.ok(r.third.every(ids=>!ids.includes("a")),"Un complemento que no aporta no se añade por obligación");
  assert.equal(r.mix,"americana con vaquero");assert.ok(r.mixS>=.75&&r.mixLook.includes("b"),"Mezcla intencionada: americana con vaquero ("+r.mixS+")");
  assert.deepEqual(r.combinaOcc,[true,true,true],"«Combina con» por ocasión: solo parejas que valen las dos para esa ocasión");
  assert.ok(r.combina.length>=3&&r.combina.some(x=>x.startsWith("b:arreglado")),"«Combina con»: relaciones con registro ("+r.combina+")");
  assert.ok(!r.partyIds.includes("z")&&r.partyWarn.some(w=>/calzado/.test(w)),"Sin calzado coherente: aviso en lugar de chanclas en una fiesta");
  assert.deepEqual(r.two,["t","j"],"Camiseta y vaquero es un look válido sin añadir nada");
  assert.deepEqual(r.remote,["",  "two-patterns"].map(x=>x),"Una edición con fecha anterior al máximo recalcula la relación ("+r.remote+")");
  assert.ok(r.mono.length&&r.mono.every(ids=>!ids.includes("j")&&!ids.includes("t"))&&r.monoNucleus.join()==="m","El mono es núcleo de una sola pieza ("+JSON.stringify(r.mono)+")");
  assert.ok(!r.badBag.includes("b"),"Bolso que choca: mejor sin bolso ("+r.badBag+")");
  console.log("PASS: Stylist brain: weakest link, third piece vs all, intentional mix, no filler pieces, honest shoe warning");
}

// Frío de verdad (cata n.º 3, banco Polyvore «P-mitad», trabajo a 8 °C): si el abrigo no combina con una base, gana la base que lo admite
{
  const L=JSON.parse(fs.readFileSync(new URL("./benchmarks/real-photos/labels-polyvore.json",import.meta.url))),W=JSON.parse(fs.readFileSync(new URL("./benchmarks/real-photos/wardrobes-polyvore.json",import.meta.url)));
  const probe=new Function("document","sessionStorage","crypto","GS",src+`
  appState.profile={id:"noelia"};appState.data=normalizeData({garments:GS});
  const l=rankOutfits({max:1,occasion:"work",temp:8,date:"2026-01-15"})[0];return {cats:l.garments.map(g=>g.category+":"+g.type),warnings:l.warnings,clo:outfitClo(l.garments),target:cloTarget(8)};`);
  const set=new Set(W["P-mitad"]),r=probe(document,sessionStorage,{randomUUID:()=>"t"},L.filter(g=>set.has(g.id)).map(g=>({...g,image:"",updatedAt:"x"})));
  assert.ok(!r.warnings.some(w=>/frío/.test(w))&&r.cats.includes("Capas:Abrigo"),"Trabajo a 8 °C: abrigo y sin aviso de frío ("+r.cats+" · "+r.warnings+")");
  console.log("PASS: Real cold: the look that admits the coat beats a short blazer at 8 °C");
}

// «Casi» (cata n.º 4): la prenda marcada se aprende por perfil; mochila de montaña solo en deporte
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,color,extra={})=>({id,name:type+" "+color,category,type,color,style:"casual",season:"all",pattern:"plain",updatedAt:"x",...extra});
  appState.profile={id:"noelia"};const by=id=>myGarments().find(g=>g.id===id),out={};
  appState.data=normalizeData({garments:[G("t1","Arriba","Camiseta","Blanco"),G("t2","Arriba","Blusa","Vaquero"),G("j1","Abajo","Vaqueros","Azul"),G("j2","Abajo","Pantalón","Negro"),
   G("z1","Zapatos","Deportivas","Blanco"),G("z2","Zapatos","Bailarinas","Negro"),G("m","Bolsos","Mochila","Amarillo",{name:"Mochila North Face",formality:"sport"}),G("v","Vestidos","Vestido midi","Rosa")]});
  const ctx=()=>engineContext({occasion:"daily",temp:24,date:"2026-07-15"}),looks=()=>rankOutfits({max:3,occasion:"daily",temp:24,date:"2026-07-15",extras:{shoes:true,bag:true}}).map(l=>l.ids);
  out.pack=looks().some(ids=>ids.includes("m"));
  out.packSport=occasionFits(by("m"),"sport");
  out.before=relationOf(by("t1"),by("j1"),ctx()).s;
  saveAlmost([by("t1"),by("j1"),by("z1")],["j1"],["pega"],"daily");ensureRelations();
  out.after=relationOf(by("t1"),by("j1"),ctx()).s;out.pairGone=looks().every(ids=>!(ids.includes("t1")&&ids.includes("j1")));
  saveAlmost([by("t2"),by("j2"),by("z2")],["t2"],["prenda"],"daily");out.disliked=looks()[0].includes("t2");
  saveAlmost([by("v"),by("z1")],["v"],["ocasion"],"daily");out.offOcc=looks().some(ids=>ids.includes("v"));out.otherOcc=rankOutfits({max:5,occasion:"party",temp:24,date:"2026-07-15"}).length>=0;
  out.keys=Object.keys(appState.data.feedback).sort();
  // Deshacer (revisión de ChatGPT, #169): quitar la marca restaura la pareja, también tras fusionar con otro dispositivo; la marca vale en todas las ocasiones
  out.otherOccBlocked=relationOf(by("t1"),by("j1"),engineContext({occasion:"work",temp:17,date:"2026-04-15"})).s<=.3;
  const prev=JSON.parse(JSON.stringify(appState.data));delete appState.data.feedback["p:j1|t1"];stampChanges(appState.data,prev);
  const remote=JSON.parse(JSON.stringify(prev));remote.stamps={...(remote.stamps||{}),"f:p:j1|t1":"2000-01-01T00:00:00.000Z"};
  appState.data=mergeData(appState.data,remote);ensureRelations();out.undone=!("p:j1|t1" in appState.data.feedback);out.restored=relationOf(by("t1"),by("j1"),ctx()).s;
  // Dos prendas marcadas con «no pega»: también se guarda su pareja; una sola prenda sin pareja no guarda nada
  saveAlmost([by("t1"),by("j1")],["t1","j1"],["pega"],"daily");out.bothPair="p:j1|t1" in appState.data.feedback;out.single=almostLearns([by("v")],["v"],["pega"]);
  // Mochila de montaña obligatoria: en diario no hay looks; en «Combinar prenda», looks de deporte si los hay
  out.packDaily=rankOutfits({max:3,occasion:"daily",temp:24,date:"2026-07-15",required:"m"}).length;
  // Camisa vaquera con pantalón de cuadros de vestir: compiten (Noelia, 10/10/2026); con un pantalón liso, sí
  appState.data=normalizeData({garments:[G("cv","Arriba","Camisa","Vaquero",{fabric:"denim",formality:"casual",style:"smart"}),G("pc","Abajo","Pantalón","Beige",{pattern:"checks",formality:"smartcasual",style:"smart"}),G("pn","Abajo","Pantalón","Negro",{formality:"smartcasual",style:"smart"})]});
  const c2=engineContext({occasion:"work",temp:17,date:"2026-04-15"});out.clash=relationOf(by("cv"),by("pc"),c2).s;out.plain=relationOf(by("cv"),by("pn"),c2).s;
  return out;`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.equal(r.pack,false,"Mochila de montaña: no entra como bolso en un look de diario");
  assert.ok(r.before>=.6&&r.after<=.3&&r.pairGone,"«No pega»: la pareja pasa a débil y no se propone junta ("+r.before+" → "+r.after+")");
  assert.equal(r.disliked,false,"«No me gusta la prenda»: deja de salir en la primera propuesta");
  assert.equal(r.offOcc,false,"«No es para esta ocasión»: no se propone en esa ocasión");
  assert.ok(r.otherOccBlocked,"«No pega» vale en todas las ocasiones");
  assert.ok(r.undone&&r.restored>=.6,"Quitar la marca restaura la pareja, también tras fusionar con otro dispositivo ("+r.restored+")");
  assert.ok(r.bothPair&&!r.single,"«No pega» con dos prendas marcadas guarda su pareja; con una sola prenda no hay nada que aprender");
  assert.equal(r.packDaily,0,"Mochila de montaña obligatoria en diario: sin looks");
  assert.ok(r.clash<.6&&r.plain>=.6,"Camisa vaquera: no con pantalón de cuadros de vestir ("+r.clash+"), sí con uno liso ("+r.plain+")");
  assert.deepEqual(r.keys,["g:t2","o:v|daily","p:j1|t1","p:j1|z1"],"Claves guardadas en feedback (se fusionan por clave entre dispositivos)");
  console.log("PASS: «Casi» learns per profile (pair, garment, occasion); outdoor backpack only for sport");
}

// Versiones de un look (Noelia, 10/10/2026): mismo núcleo, otra intención; nunca relleno
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,color,extra={})=>({id,name:type+" "+color,category,type,color,style:"casual",season:"all",pattern:"plain",updatedAt:"x",...extra});
  appState.profile={id:"noelia"};const by=id=>myGarments().find(g=>g.id===id),out={};
  appState.data=normalizeData({garments:[G("v","Vestidos","Vestido midi","Negro",{style:"smart",formality:"smartcasual",sleeve:"corta"}),G("t","Zapatos","Tacones","Negro",{style:"smart",formality:"smartcasual"}),
   G("d","Zapatos","Deportivas","Blanco",{formality:"casual"}),G("c","Capas","Cazadora","Negro",{warmth:"bajo",formality:"casual"}),G("p","Accesorios","Pendientes","Dorado",{formality:"smartcasual"})]});
  const ctx=engineContext({occasion:"daily",temp:18,date:"2026-04-15"}),main=[by("v"),by("t"),by("p")];
  const vs=lookVersions(main,ctx),s0=scoreOutfit(main,ctx).score;
  out.labels=vs.map(v=>v.label);out.informalHasSneakers=vs.find(v=>v.label==="Más informal")?.ids.includes("d");
  versionPick.set("t:0",vs[0].label);out.picked=lookSig(pickedLook("t:0",main,ctx).map(g=>g.id))===lookSig(vs[0].ids);versionPick.set("t:0","Intención que ya no existe");out.fallback=pickedLook("t:0",main,ctx)===main&&!versionPick.has("t:0");
  out.allValid=vs.every(v=>v.ids.includes("v")&&!lookIssues(v.garments,ctx).length&&v.score>=s0-6&&(v.ids.includes("d")!==main.some(g=>g.id==="d")||v.ids.includes("c")));
  // «Otro look» salta al siguiente núcleo aunque haya varios zapatos, y elegir otra versión reactiva «Me lo pongo» (revisiones de ChatGPT y Codex, #171)
  appState.data=normalizeData({garments:[G("A","Vestidos","Vestido midi","Negro",{style:"smart",formality:"smartcasual",sleeve:"corta"}),G("B","Vestidos","Vestido midi","Azul",{style:"smart",formality:"smartcasual",sleeve:"corta"}),
   G("z1","Zapatos","Tacones","Negro",{formality:"smartcasual"}),G("z2","Zapatos","Bailarinas","Negro",{formality:"smartcasual"}),G("z3","Zapatos","Deportivas","Blanco",{formality:"casual"})]});
  Object.assign(appState.data.preferences,{occasion:"daily",temperature:24,autoWeather:false});
  const n1=nucleusKey(ensureDailyLook(true).ids.map(by)),n2=nucleusKey(ensureDailyLook(true).ids.map(by));out.nextCore=n1!==n2;
  appState.data=normalizeData({garments:[G("v2","Vestidos","Vestido midi","Negro",{style:"smart",formality:"smartcasual",sleeve:"corta"}),G("t2","Zapatos","Tacones","Negro",{style:"smart",formality:"smartcasual"}),G("p2","Accesorios","Pendientes","Dorado"),G("p3","Accesorios","Collar","Plateado")]});
  out.none=lookVersions([by("v2"),by("t2"),by("p2")],engineContext({occasion:"daily",temp:26,date:"2026-07-15"})).length;
  return out;`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.ok(r.labels.includes("Más informal")&&r.informalHasSneakers,"Versión más informal: el mismo vestido con deportivas ("+r.labels+")");
  assert.ok(r.labels.includes("Si refresca"),"A 18 °C, versión «si refresca» con capa ("+r.labels+")");
  assert.ok(r.allValid,"Las versiones mantienen el núcleo, cumplen las reglas, puntúan cerca y cambian calzado o capa");
  assert.ok(r.picked&&r.fallback,"Listas de looks: la versión elegida es la que se usa; si ya no existe, el principal");
  assert.ok(r.nextCore,"«Otro look» pasa a otro vestido, no a otros zapatos del mismo");
  assert.equal(r.none,0,"Sin otro calzado ni capa posible: sin versiones (cambiar un complemento no cuenta)");
  console.log("PASS: Look versions: same nucleus, different intent (casual, dressier, if it gets cool), no filler");
}

// «Planificar los días libres» y previsión de la semana: un núcleo distinto cada día, solo días de hoy en adelante
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,color,extra={})=>({id,name:type+" "+color,category,type,color,style:"casual",season:"all",pattern:"plain",updatedAt:"x",...extra});
  appState.profile={id:"noelia"};
  appState.data=normalizeData({garments:[G("t1","Arriba","Camiseta","Blanco",{sleeve:"corta"}),G("t2","Arriba","Blusa","Negro",{sleeve:"larga"}),G("t3","Arriba","Jersey","Gris",{sleeve:"larga"}),
   G("b1","Abajo","Vaqueros","Azul"),G("b2","Abajo","Pantalón","Negro"),G("b3","Abajo","Falda","Beige"),G("v1","Vestidos","Vestido midi","Verde",{sleeve:"corta"}),
   G("z1","Zapatos","Deportivas","Blanco"),G("z2","Zapatos","Botines","Negro"),G("c1","Capas","Cazadora","Negro",{warmth:"medio"})]});
  const today=dayISO(),days=[-1,0,1,2,3,4,5].map(n=>addDays(today,n));
  appState.data.preferences.weatherWeek={[days[2]]:9};
  myPlans().push({id:"plan:"+days[3],date:days[3],garmentIds:["t1","b1","z1"],name:"Mío",updatedAt:"x"});
  const plans=weekFillPlan(days),nuc=plans.map(p=>nucleusKey(p.ids.map(id=>myGarments().find(g=>g.id===id))));
  const tempD=tempFor(days[2]),coldD=plans.find(p=>p.date===days[2])?.ids.includes("c1"),distinctD=new Set(nuc).size,nD=plans.length,pastD=plans.some(p=>p.date<today);
  const reuse=plans.slice(0,3).some(p=>p.ids.some(id=>["t1","b1"].includes(id)));
  appState.data=normalizeData({garments:[G("t","Arriba","Camiseta","Blanco"),G("b","Abajo","Vaqueros","Azul"),G("z","Zapatos","Deportivas","Blanco")]});appState.data.preferences.weatherWeek={};
  const one=weekFillPlan(days).length;
  return {n:nD,past:pastD,distinct:distinctD,temp:tempD,coldDay:coldD,reuse,one};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.ok(r.n>=4&&!r.past,"Planifica de hoy en adelante ("+r.n+" días)");
  assert.equal(r.reuse,false,"Lo ya planificado en la semana se evita mientras haya alternativas");
  assert.equal(r.one,1,"Con un solo núcleo posible, un día y los demás libres (sin repetir)");
  assert.equal(r.distinct,r.n,"Un núcleo distinto cada día");
  assert.equal(r.temp,9,"Mi semana usa la previsión del día");
  assert.ok(r.coldDay,"El día frío de la previsión lleva capa");
  console.log("PASS: Fill free week days: distinct cores, from today on, using the forecast");
}

// Aprender la versión preferida: si casi siempre te pones la «más informal», se propone ya elegida
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,color,extra={})=>({id,name:type+" "+color,category,type,color,style:"casual",season:"all",pattern:"plain",updatedAt:"x",...extra});
  appState.profile={id:"noelia"};
  appState.data=normalizeData({garments:[G("v","Vestidos","Vestido midi","Negro",{style:"smart",formality:"smartcasual",sleeve:"corta"}),G("t","Zapatos","Tacones","Negro",{style:"smart",formality:"smartcasual"}),G("d","Zapatos","Deportivas","Blanco",{formality:"casual"})]});
  Object.assign(appState.data.preferences,{occasion:"daily",temperature:24,autoWeather:false});
  const before=ensureDailyLook(true),b={ids:[...before.ids],main:[...before.main]};
  appState.data.preferences.versionTaste={"Más informal":3,"Principal":1};appState.data.preferences.dailyLook=null;
  const after=ensureDailyLook(true);
  return {fav:favoriteIntent(),before:b,after:{ids:after.ids,main:after.main,byTaste:after.byTaste},label:chosenVersionLabel(after),few:(appState.data.preferences.versionTaste={"Más informal":2},favoriteIntent())};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.equal(r.fav,"Más informal");
  assert.ok(r.after.ids.includes("d")&&r.after.byTaste==="Más informal"&&r.label==="Más informal","Con tu gusto, el look de hoy ya viene en su versión más informal ("+JSON.stringify(r.after)+")");
  assert.equal(r.few,null,"Con menos de 3 elecciones no se decide nada");
  console.log("PASS: Favourite version intent learnt per profile");
}

// Fichas por completar: formalidad, ocasiones, datos de abrigo y contradicción estilo/formalidad
{
  const r=new Function("document","sessionStorage","crypto",src+`
  return [sheetGaps({category:"Arriba",color:"Blanco",style:"casual"}),sheetGaps({category:"Arriba",color:"Blanco",style:"smart",formality:"casual",occasions:["daily"],sleeve:"larga",thickness:"medio",warmth:"medio"}),
   sheetGaps({category:"Zapatos",color:"Negro",style:"casual",formality:"casual",occasions:["daily"]})];`)(document,sessionStorage,{randomUUID:()=>"t"});
  assert.ok(r[0].includes("formalidad")&&r[0].includes("ocasiones")&&r[0].some(x=>/manga/i.test(x)),"Sin datos: falta formalidad, ocasiones y manga ("+r[0]+")");
  assert.deepEqual(r[1],["estilo y formalidad no cuadran"]);
  assert.deepEqual(r[2],[],"Calzado con formalidad y ocasiones: completo");
  console.log("PASS: Incomplete garment sheets are detected");
}

// «Cambiar prenda» con el cerebro de estilista: tiempo, «Casi» y parejas que combinan
{
  const r=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,color,extra={})=>({id,name:type+" "+color,category,type,color,style:"casual",season:"all",pattern:"plain",updatedAt:"x",...extra});
  appState.profile={id:"noelia"};
  appState.data=normalizeData({garments:[G("t1","Arriba","Jersey","Gris",{sleeve:"larga",thickness:"grueso"}),G("t2","Arriba","Top","Blanco",{sleeve:"sin mangas",thickness:"ligero"}),G("t3","Arriba","Camisa","Azul",{sleeve:"larga"}),G("t4","Arriba","Blusa","Rosa",{sleeve:"larga"}),
   G("b","Abajo","Pantalón","Negro"),G("z","Zapatos","Botines","Negro"),G("c","Capas","Abrigo","Camel",{warmth:"alto"})]});
  Object.assign(appState.data.preferences,{temperature:8,autoWeather:false});
  appState.data.feedback["g:t4"]="no";
  const l={id:"L",garmentIds:["t1","b","z","c"],occasion:"daily"};
  return swapOptions(l,"t1").map(o=>o.g.id);`)(document,sessionStorage,{randomUUID:()=>"t"});
  assert.ok(!r.includes("t2"),"A 8 °C, «Cambiar prenda» no ofrece un top sin mangas ("+r+")");
  assert.ok(!r.includes("t4"),"No ofrece una prenda marcada «no me gusta»");
  assert.ok(r.includes("t3"),"Sí la camisa de manga larga");
  console.log("PASS: Swap options respect weather, «Casi» and relations");
}

// goes() usa el gusto del perfil: si te gustan los estampados, dos estampados cuentan como combinación
{
  const r=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,color,extra={})=>({id,name:type+" "+color,category,type,color,style:"casual",season:"all",pattern:"plain",updatedAt:"x",...extra});
  appState.profile={id:"noelia"};
  appState.data=normalizeData({garments:[G("t","Arriba","Blusa","Rojo",{pattern:"floral"}),G("b","Abajo","Falda","Azul",{pattern:"stripes"}),G("t2","Arriba","Camisa","Verde",{pattern:"checks"}),G("b2","Abajo","Pantalón","Negro",{pattern:"dots"})]});
  ensureRelations();const by=id=>myGarments().find(g=>g.id===id),before=goes(by("t"),by("b"));
  appState.data.looks=[{id:"L1",garmentIds:["t2","b2"],updatedAt:"x"},{id:"L2",garmentIds:["t","b2"],updatedAt:"x"},{id:"L3",garmentIds:["t2","b"],updatedAt:"x"}];appState.data.feedback={L1:"up",L2:"up",L3:"up"};
  ensureRelations();const c=goesCtx();return {before,hasCtx:c.likes instanceof Set&&c.occasion===null,same:goes(by("t"),by("b"))===(pairs(by("t"),by("b"))&&(relationOf(by("t"),by("b"),c)?.s??1)>=REL_OK),fresh:c!==(appState.data.feedback.L1="down",ensureRelations(),goesCtx())};`)(document,sessionStorage,{randomUUID:()=>"t"});
  assert.equal(r.before,false,"Sin gusto aprendido, dos estampados no cuentan");
  assert.ok(r.hasCtx&&r.same&&r.fresh,"goes() usa el contexto del perfil y se rehace cuando cambian los votos");
  console.log("PASS: goes() uses the profile context");
}

// Primero la ropa (Noelia, 10/10/2026): la ropa combina con ropa; zapatos, bolsos y complementos se miden contra looks enteros
{
  const r=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,color,extra={})=>({id,name:type+" "+color,category,type,color,style:"casual",formality:"casual",season:"all",pattern:"plain",occasions:["daily"],updatedAt:"x",...extra});
  appState.profile={id:"noelia"};
  appState.data=normalizeData({garments:[G("t","Arriba","Camiseta","Blanco"),G("b","Abajo","Vaquero","Azul"),G("b2","Abajo","Pantalón","Negro"),G("d","Vestidos","Vestido","Negro"),G("s","Zapatos","Zapatillas","Blanco"),G("e","Accesorios","Pendientes","Dorado")]});
  ensureRelations();
  const jacket=evaluateCandidate({name:"Chaqueta vaquera",category:"Capas",type:"Chaqueta",color:"Azul",style:"casual",formality:"casual",season:"all",pattern:"plain"});
  const bag=evaluateCandidate({name:"Bolso negro",category:"Bolsos",type:"Bolso",color:"Negro",style:"casual",formality:"casual",season:"all",pattern:"plain"});
  return {jacket:jacket.compatible.map(g=>g.category),bagCore:bag.core.map(b=>b.map(g=>g.id).sort().join("+")),bagReason:bag.reasons[0]};`)(document,sessionStorage,{randomUUID:()=>"t"});
  assert.ok(r.jacket.length&&r.jacket.every(c=>["Arriba","Abajo","Vestidos","Capas"].includes(c)),"Una chaqueta solo cuenta ropa ("+r.jacket+")");
  assert.ok(r.bagCore.length&&r.bagCore.every(k=>k==="d"||k.split("+").length===2),"Un bolso se mide contra bases de look ("+r.bagCore+")");
  assert.match(r.bagReason,/look/,"El veredicto del bolso habla de looks");
  console.log("PASS: Clothes-first: clothing pairs with clothing, accessories with whole look bases");
}

// Un complemento solo completa una base con la que comparte ocasión: zapatillas de diario no van con un vestido de fiesta
{
  const r=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,color,extra={})=>({id,name:type+" "+color,category,type,color,style:"casual",formality:"casual",season:"all",pattern:"plain",occasions:["daily"],updatedAt:"x",...extra});
  appState.profile={id:"noelia"};
  appState.data=normalizeData({garments:[G("gown","Vestidos","Vestido largo de lentejuelas","Dorado",{style:"party",formality:"party",occasions:["party","formal","event"]}),G("d","Vestidos","Vestido camisero","Beige"),G("s","Zapatos","Zapatillas","Negro"),G("m","Zapatos","Mocasines","Negro",{style:"smart",formality:"smartcasual"})]});
  ensureRelations();const by=id=>myGarments().find(g=>g.id===id);
  return {s:basesFor(by("s")).map(b=>b.map(g=>g.id).join("+")),m:basesFor(by("m")).map(b=>b.map(g=>g.id).join("+"))};`)(document,sessionStorage,{randomUUID:()=>"t"});
  assert.ok(!r.s.includes("gown"),"Unas zapatillas de diario no completan un vestido de lentejuelas ("+r.s+")");
  assert.ok(r.s.includes("d"),"Sí un vestido de diario");
  assert.ok(!r.m.includes("gown"),"Las ocasiones de la ficha mandan: mocasines solo de diario tampoco ("+r.m+")");
  console.log("PASS: Accessories only complete bases they share an occasion with");
}

// «Si refresca»: si el principal avisa de frío y solo hay una capa algo más abrigada, se ofrece igualmente
{
  const r=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,color,extra={})=>({id,name:type+" "+color,category,type,color,style:"party",formality:"party",season:"all",pattern:"plain",occasions:["party"],updatedAt:"x",...extra});
  appState.profile={id:"noelia"};
  appState.data=normalizeData({garments:[G("d","Vestidos","Vestido corto","Rosa",{sleeve:"sin mangas",length:"short",thickness:"fino"}),G("h","Zapatos","Tacones","Nude"),
   G("c","Capas","Abrigo","Gris",{style:"smart",formality:"smartcasual",occasions:["daily","party"],thickness:"grueso",warmth:"alto",sleeve:"larga"})]});
  Object.assign(appState.data.preferences,{temperature:17,autoWeather:false});ensureRelations();
  const ctx=engineContext({occasion:"party",temp:17}),main=[myGarments()[0],myGarments()[1]],w=scoreOutfit(main,ctx).warnings;
  return {cold:w.some(x=>/frío/i.test(x)),v:lookVersions(main,ctx).map(x=>x.label+":"+x.ids.join("+"))};`)(document,sessionStorage,{randomUUID:()=>"t"});
  assert.ok(r.cold,"El vestido sin mangas a 17 °C avisa de frío");
  assert.ok(r.v.some(x=>x.startsWith("Si refresca:")&&x.includes("c")),"«Si refresca» ofrece el abrigo ("+r.v+")");
  console.log("PASS: «Si refresca» offers a warmer layer when the principal warns of cold");
}

// Orden en pantalla (Noelia, 10/10/2026): entre looks de calidad parecida, primero los más completos
{
  const sample=JSON.parse(fs.readFileSync(new URL("./benchmarks/sample-garments.json",import.meta.url),"utf8"));
  const r=new Function("document","sessionStorage","crypto","sample",src+`
  appState.profile={id:"noelia"};appState.data=normalizeData({garments:sample});
  const out=[];for(const occasion of [null,"daily","work","party"])for(const temp of [10,22]){const ls=rankOutfits({occasion,temp,max:6});if(!ls.length)continue;const top=Math.max(...ls.map(l=>l.score));
   const near=ls.filter(l=>l.score>=top-12);out.push({n:ls.length,near:near.length,ok:near.every((l,i)=>!i||completeness(near[i-1].garments)>=completeness(l.garments)),prefix:ls.slice(0,near.length).every(l=>l.score>=top-12)})}
  return out;`)(document,sessionStorage,{randomUUID:()=>"t"},sample);
  assert.ok(r.length&&r.some(x=>x.near>1),"Hay listas con varios looks que comparar");
  assert.ok(r.every(x=>x.ok&&x.prefix),"Los looks cercanos al mejor salen primero y ordenados de más a menos completos "+JSON.stringify(r));
  console.log("PASS: Looks list puts the most complete ones first among comparable quality");
}

// Recomendaciones visuales: cada prenda del catálogo tiene su ficha dibujada (SVG en data:, permitido por la CSP) y un enlace a productos reales
{
  const r=new Function("document","sessionStorage","crypto",src+`
  return {sk:CATALOG.map(c=>[c.name,sketchKind(c),decodeURIComponent(pieceSketch(c).replace("data:image/svg+xml,",""))]),link:shopLink(CATALOG[0])};`)(document,sessionStorage,{randomUUID:()=>"t"});
  for(const [n,k,svg] of r.sk){assert.ok(/^<svg[^>]+viewBox="[\d .]+"/.test(svg)&&/<path d="M/.test(svg)&&!/undefined/.test(svg),"Ficha dibujada válida para "+n);assert.ok(!/fill="#c9c3ba"/.test(svg),"Color conocido para "+n)}
  assert.equal(r.sk.find(x=>x[0]==="Falda midi negra")[1],"skirt");assert.equal(r.sk.find(x=>x[0]==="Botines negros")[1],"boot");assert.equal(r.sk.find(x=>x[0]==="Top negro de tirantes")[1],"tank");
  assert.match(r.link,/https:\/\/www\.google\.com\/search\?tbm=shop&q=Camiseta%20blanca%20b%C3%A1sica%20mujer/);assert.match(r.link,/rel="noopener noreferrer"/);
  console.log("PASS: Shopping suggestions get a drawn sketch per catalog piece and a real-products link");
}

// Looks editados: lo que la persona pone suma y lo que quita resta; el motor acaba proponiendo su versión
{
  const r=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,color,extra={})=>({id,name:type+" "+color,category,type,color,style:"casual",season:"all",pattern:"plain",updatedAt:"x",...extra});
  appState.profile={id:"noelia"};
  appState.data=normalizeData({garments:[G("v","Vestidos","Vestido midi","Negro",{formality:"smartcasual",style:"smart",sleeve:"corta"}),G("a","Zapatos","Bailarinas","Negro",{formality:"smartcasual",style:"smart"}),G("b","Zapatos","Sandalias","Marrón",{formality:"smartcasual",style:"smart"})]});
  const first=rankOutfits({max:1,occasion:"daily",temp:24,date:"2026-07-15"})[0].ids,shoe=first.find(x=>x!=="v"),other=shoe==="a"?"b":"a";
  appState.data.looks=[{id:"E",name:"Mi look",garmentIds:["v",other],edited:true,removed:[shoe],updatedAt:"x"}];
  ensureRelations();const after=rankOutfits({max:1,occasion:"daily",temp:24,date:"2026-07-15"})[0].ids;
  return {shoe,other,after};`)(document,sessionStorage,{randomUUID:()=>"t"});
  assert.ok(r.after.includes(r.other)&&!r.after.includes(r.shoe),"Tras editar (cambiar "+r.shoe+" por "+r.other+"), el motor propone la versión de la persona ("+r.after+")");
  console.log("PASS: Edited looks teach the engine");
}

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
  const fitsParty=["h2","h3"].map(id=>occasionFits(myGarments().find(g=>g.id===id),"party"));
  return {work,daily28,daily17,daily6,fitsParty};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  for(const id of ["b1","z1","z3","h1","h2","h3"])assert.ok(!r.work.includes(id),"Trabajo sin "+id);
  assert.ok(r.work.includes("z2"),"Trabajo con mocasines");
  assert.ok(!r.daily17.some(id=>["h1","h2","h3"].includes(id)),"A 17 °C, sin gorros ni sombreros");
  assert.ok(!r.daily28.includes("h1"),"Gorro de lana nunca con calor");
  assert.ok(r.daily6.every(id=>!["h2","h3"].includes(id)),"Con frío, sin gorra ni sombrero");
  assert.deepEqual(r.fitsParty,[false,false],"Fiesta (y sugerencias con IA): sin gorra ni sombrero");
  console.log("PASS: #99 work looks without casual pieces; headwear only when it makes sense");
}

// #108: variedad de bases (no todo vestidos), trabajo sin deportivas si hay otro calzado, mochila solo en diario o deporte
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,color,style="casual",season="all")=>({id,name:type+" "+color,category,type,color,style,season,updatedAt:"x"});
  appState.profile={id:"noelia"};appState.data=normalizeData({garments:[
   G("t1","Arriba","Blusa","Blanco","smart"),G("t2","Arriba","Camiseta","Negro"),G("t3","Arriba","Top","Beige"),
   G("b1","Abajo","Pantalón","Negro","smart"),G("b2","Abajo","Vaqueros","Vaquero"),G("b3","Abajo","Falda","Gris","smart"),
   G("d1","Vestidos","Vestido midi","Azul"),G("d2","Vestidos","Vestido midi","Verde"),G("d3","Vestidos","Vestido midi","Rosa"),
   G("z1","Zapatos","Deportivas","Blanco","sport"),G("z2","Zapatos","Bailarinas","Negro","smart"),
   G("m1","Bolsos","Mochila","Gris"),G("m2","Bolsos","Bolso de hombro","Negro","smart")]});
  const looks=o=>rankOutfits({max:3,date:"2026-04-15",temp:20,...o});
  const daily=looks({occasion:"daily"}),work=looks({occasion:"work"});
  myGarments().push(G("z3","Zapatos","Deportivas","Gris"));myGarments().find(g=>g.id==="z3").favorite=true; // deportivas sin estilo «sport» y favoritas
  const work2=looks({occasion:"work"}),pack=looksAround(myGarments().find(g=>g.id==="m1"));
  return {dressesDaily:daily.filter(l=>l.garments.some(g=>g.category==="Vestidos")).length,
   workSneakers:work.filter(l=>l.ids.includes("z1")).length+work2.filter(l=>l.ids.includes("z1")||l.ids.includes("z3")).length,
   packSmart:pack.some(l=>l.some(g=>g.id!=="m1"&&["smart","party"].includes(g.style))),packCount:pack.length,workBackpack:work.some(l=>l.ids.includes("m1")),
   backpackWork:occasionFits(myGarments().find(g=>g.id==="m1"),"work"),backpackDaily:occasionFits(myGarments().find(g=>g.id==="m1"),"daily")};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.ok(r.dressesDaily<=2,"Con partes de arriba y de abajo, no todas las propuestas son vestidos ("+r.dressesDaily+")");
  assert.equal(r.workSneakers,0,"Trabajo: bailarinas antes que deportivas");
  assert.equal(r.workBackpack,false);assert.ok(r.packCount>0&&!r.packSmart,"Combinar una mochila: sin prendas smart ni party");assert.equal(r.backpackWork,false);assert.equal(r.backpackDaily,true);
  console.log("PASS: #108 base variety, work shoes, backpacks only for daily/sport");
}

// Perfil de prenda: formalidad, manga, grosor, tejido, largo y ocasiones de la ficha mandan sobre el nombre
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,extra={})=>({id,name:type,category,type,color:"Negro",style:"casual",season:"all",updatedAt:"x",...extra});
  const fit=(g,o)=>occasionFits(g,o);
  const dressyPack=G("p1","Bolsos","Mochila",{formality:"smartcasual",subtype:"mochila de piel"}),hikePack=G("p2","Bolsos","Mochila",{subtype:"mochila de montaña"}),plainPack=G("p3","Bolsos","Mochila");
  const heelSandal=G("s1","Zapatos","Sandalias",{formality:"formal",subtype:"sandalias de tacón"}),flipflop=G("s2","Zapatos","Chanclas");
  const userPack=G("p4","Bolsos","Mochila",{occasions:["work"]});
  const casualPack=G("p5","Bolsos","Mochila",{formality:"casual"});
  appState.profile={id:"noelia"};appState.data=normalizeData({garments:[G("d1","Vestidos","Vestido corto",{style:"party",formality:"party"}),G("s9","Zapatos","Sandalias de tacón",{formality:"formal"})]});
  const partyShoes=rankOutfits({max:1,occasion:"party",date:"2026-07-15",temp:26})[0]?.ids.includes("s9");
  const wool=G("t1","Arriba","Jersey",{sleeve:"larga",thickness:"grueso",fabric:"wool"}),linen=G("t2","Arriba","Camisa",{sleeve:"larga",thickness:"ligero",fabric:"linen"}),tank=G("t3","Arriba","Top",{sleeve:"sin mangas",thickness:"ligero"});
  const mini=G("b1","Abajo","Falda",{length:"cropped"}),midi=G("b2","Abajo","Falda",{length:"midi"});
  const jeans=[G("j1","Abajo","Vaqueros",{name:"Vaqueros acid wash skinny"}),G("j2","Abajo","Vaqueros",{name:"Vaqueros rotos"}),G("j3","Abajo","Vaqueros",{name:"Vaqueros rectos oscuros"}),G("j4","Abajo","Vaqueros",{name:"Vaqueros rotos",formality:"smartcasual"}),G("j6","Abajo","Vaqueros",{name:"Vaquero roto"}),G("j7","Abajo","Vaqueros",{name:"Vaqueros lavados al ácido"}),G("j8","Abajo","Vaqueros",{name:"Vaqueros de lavado ácido"}),G("j5","Vestidos","Vestido",{name:"Vestido largo rotita",formality:"party"})];
  return {
   jeansWork:jeans.slice(0,4).map(j=>fit(j,"work")).join(),jeansDaily:fit(jeans[1],"daily"),rotita:fit(jeans.find(j=>j.id==="j5"),"party"),spanish:jeans.filter(j=>["j6","j7","j8"].includes(j.id)).map(j=>fit(j,"work")).join(),shortBottom:[G("m1","Abajo","Falda",{name:"Falda mini de algodón"}),G("m2","Abajo","Falda",{name:"Falda mini",length:"midi"}),G("m3","Abajo","Minifalda")].map(x=>fit(x,"work")).join(),pumps:[G("h1","Zapatos","Tacones",{name:"Salones de piel",formality:"party"}),G("h2","Zapatos","Tacones",{name:"Tacones con purpurina",formality:"party"}),G("h3","Zapatos","Sandalias",{name:"Sandalias de tacón",formality:"party"}),G("h4","Bolsos","Bolso de fiesta",{formality:"party"})].map(x=>fit(x,"work")).join(),tops:[G("w1","Arriba","Sudadera"),G("w2","Arriba","Top",{name:"Top bustier"}),G("w3","Arriba","Sudadera",{formality:"smartcasual"}),G("w4","Arriba","Blusa")].map(t=>fit(t,"work")).join(),hoodieDaily:fit(G("w5","Arriba","Sudadera"),"daily"),
   casualPackWork:fit(casualPack,"work"),partyShoes,
   packs:[fit(dressyPack,"work"),fit(hikePack,"work"),fit(plainPack,"work"),fit(userPack,"work"),fit(hikePack,"daily")].join(),
   shoes:[fit(heelSandal,"work"),fit(heelSandal,"party"),fit(flipflop,"work")].join(),
   heat:[thermalOk(wool,27),thermalOk(linen,27),thermalOk(tank,27),thermalOk(wool,10)].join(),
   cold:[thermalOk(mini,10),thermalOk(midi,10),thermalOk(mini,22)].join()};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.equal(r.packs,"true,false,false,true,true","Mochila: de vestir sí en trabajo; de montaña o sin datos no; si la ficha dice trabajo, sí");
  assert.equal(r.casualPackWork,false,"Mochila informal: no al trabajo");
  assert.equal(r.jeansWork,"false,false,true,true","Vaqueros rotos o acid wash: no al trabajo, salvo que la ficha diga arreglados; rectos oscuros, sí");
  assert.equal(r.spanish,"false,false,false","Español: «vaquero roto» y «lavado al ácido» tampoco");
  assert.equal(r.tops,"false,false,true,true","Trabajo: ni sudadera ni bustier, salvo que la ficha diga arreglada");assert.equal(r.hoodieDaily,true);
  assert.equal(r.pumps,"true,false,false,false","Trabajo: salones lisos de «fiesta» sí; con purpurina, sandalias o cartera de fiesta, no");
  assert.equal(r.shortBottom,"false,true,false","Sin largo en la ficha, «mini» cuenta como corta; si la ficha dice midi, manda la ficha");
  assert.equal(r.jeansDaily,true);assert.equal(r.rotita,true,"«rotita» (marca) no se confunde con «rotos»");assert.equal(r.partyShoes,true,"Fiesta: sandalias de tacón con formalidad formal aunque su estilo sea informal");
  assert.equal(r.shoes,"true,true,false","Sandalias de tacón (formalidad formal) sí en trabajo y fiesta; chanclas no");
  assert.equal(r.heat,"false,true,true,true","Jersey de lana grueso no con 27 °C; camisa de lino de manga larga sí");
  assert.equal(r.cold,"false,true,true","Minifalda no con 10 °C; falda midi sí");
  console.log("PASS: Garment profile: formality, sleeve, thickness, fabric, length and occasions drive the rules");
}

// Calzado con calor y estampados en complementos (evaluación Polyvore, v87): botines a 28 °C y bolso de camuflaje con falda de cuadros
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,extra={})=>({id,name:type,category,type,color:"Negro",style:"casual",season:"all",updatedAt:"x",...extra});
  appState.profile={id:"noelia"};
  appState.data=normalizeData({garments:[G("v1","Vestidos","Vestido midi",{style:"smart",formality:"smartcasual",sleeve:"sin mangas"}),G("v2","Vestidos","Vestido midi",{name:"Vestido de punto",style:"smart",formality:"smartcasual",sleeve:"larga",season:"cold"}),
   G("z1","Zapatos","Botines",{formality:"casual"}),G("z2","Zapatos","Deportivas",{style:"sport",formality:"sport"}),G("z3","Zapatos","Tacones",{name:"Salones de piel",style:"party",formality:"party"}),
   G("z4","Zapatos","Tacones",{name:"Tacones con purpurina",style:"party",formality:"party"})]});
  const shoesAt=(occ,temp)=>rankOutfits({max:1,occasion:occ,date:temp>20?"2026-07-15":"2026-01-15",temp})[0]?.ids.filter(i=>i[0]==="z").join();
  const hotWork=shoesAt("work",28),coldWork=shoesAt("work",10),hotDaily=shoesAt("daily",28);
  appState.data=normalizeData({garments:[G("t1","Arriba","Blusa",{style:"smart"}),G("f1","Abajo","Falda",{pattern:"checks",style:"smart"}),
   G("b1","Bolsos","Bolso de mano",{pattern:"graphic",color:"Verde",favorite:true}),G("b2","Bolsos","Bolso de hombro",{color:"Negro"}),G("z5","Zapatos","Bailarinas")]});
  const bag=rankOutfits({max:1,occasion:"daily",date:"2026-04-15",temp:18})[0]?.ids.filter(i=>i[0]==="b").join();
  myGarments().push(G("f2","Abajo","Pantalón",{style:"smart"}));
  const reqBag=rankOutfits({max:3,occasion:"daily",date:"2026-04-15",temp:18,required:"b1"}).every(l=>!l.ids.includes("f1"));
  appState.data=normalizeData({garments:[G("v1","Vestidos","Vestido midi",{style:"smart",formality:"smartcasual"}),G("z1","Zapatos","Botines",{formality:"casual"}),
   G("z3","Zapatos","Tacones",{name:"Salones de piel",style:"party",formality:"party",occasions:["party"]})]});
  const occHeels=rankOutfits({max:1,occasion:"work",date:"2026-07-15",temp:28})[0]?.ids.includes("z3");
  return {hotWork,coldWork,hotDaily,bag,reqBag,occHeels,boot:[closedBoot(G("x","Zapatos","Botines")),closedBoot(G("x","Zapatos","Zapatos",{name:"Zapato con botón"})),closedBoot(G("x","Zapatos","Sandalias",{name:"Botín peep toe"}))].join()};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.equal(r.hotWork,"z3","Trabajo a 28 °C: salones lisos antes que botines, deportivas o tacones con purpurina");
  assert.equal(r.coldWork,"z1","Trabajo a 10 °C: botines");
  assert.notEqual(r.hotDaily,"z1","Diario a 28 °C: sin botines si hay otro calzado");
  assert.equal(r.bag,"b2","Falda de cuadros: bolso liso, no el estampado");
  assert.equal(r.reqBag,true,"Combinar un bolso estampado: sin la falda de cuadros");
  assert.equal(r.occHeels,false,"Salones marcados solo para fiesta en la ficha: no entran como reserva en el trabajo");
  assert.equal(r.boot,"true,false,false","Botas y botines detectados por tipo o nombre, sin confundir «botón» ni peep toe");
  console.log("PASS: Boots only when it is not hot; patterned bag not with a patterned garment; plain heels as work fallback");
}

// Contexto de bolsos y abrigos (evaluación Polyvore v88/v92): mochila de montaña con vestido, bolso de diario en fiesta, plumífero en el trabajo
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,extra={})=>({id,name:type,category,type,color:"Negro",style:"casual",season:"all",updatedAt:"x",...extra});
  appState.profile={id:"noelia"};
  appState.data=normalizeData({garments:[G("v1","Vestidos","Vestido midi",{color:"Amarillo"}),G("z1","Zapatos","Bailarinas"),
   G("m1","Bolsos","Mochila",{name:"Mochila North Face",formality:"sport",favorite:true}),G("t1","Arriba","Camiseta",{color:"Blanco"}),G("p1","Abajo","Vaqueros",{color:"Azul"})]});
  const daily=rankOutfits({max:3,occasion:"daily",date:"2026-07-15",temp:26});
  const packWithDress=daily.some(l=>l.ids.includes("v1")&&l.ids.includes("m1"));
  const reqPack=rankOutfits({max:3,occasion:"daily",date:"2026-07-15",temp:26,required:"m1"}).some(l=>l.ids.includes("v1"));
  appState.data=normalizeData({garments:[G("v2","Vestidos","Vestido de fiesta",{formality:"party",style:"party"}),G("z2","Zapatos","Tacones",{formality:"party",style:"party"}),
   G("b1","Bolsos","Bolso de hombro",{formality:"smartcasual",style:"smart",favorite:true}),G("b2","Bolsos","Bolso de fiesta",{formality:"party",style:"party"})]});
  const partyBag=rankOutfits({max:1,occasion:"party",date:"2026-04-15",temp:18})[0]?.ids.filter(i=>i[0]==="b").join();
  appState.data.garments=appState.data.garments.filter(g=>g.id!=="b2");appState.data.garments.push(G("b3","Bolsos","Bolso",{name:"Cartera",occasions:["party"]}));
  const occBag=rankOutfits({max:1,occasion:"party",date:"2026-04-15",temp:18})[0]?.ids.filter(i=>i[0]==="b").join();
  appState.data=normalizeData({garments:[G("t2","Arriba","Camisa",{style:"smart",formality:"smartcasual"}),G("p2","Abajo","Pantalón",{style:"smart",formality:"smartcasual"}),G("z3","Zapatos","Mocasines"),
   G("c1","Capas","Abrigo",{name:"Plumífero acolchado",warmth:"alto",favorite:true}),G("c2","Capas","Abrigo",{name:"Abrigo de paño",warmth:"alto",formality:"smartcasual"}),G("c3","Capas","Abrigo",{name:"Parka",warmth:"alto"})]});
  const coat=o=>rankOutfits({max:1,date:"2026-01-15",temp:6,...o})[0]?.ids.filter(i=>i[0]==="c").join();
  const workCoat=coat({occasion:"work"});
  appState.data.garments=appState.data.garments.filter(g=>g.id!=="c2");
  const onlyPuffer=coat({occasion:"work"});
  return {packWithDress,reqPack,partyBag,occBag,workCoat,onlyPuffer};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.equal(r.packWithDress,false,"Mochila de montaña: no con vestido");
  assert.equal(r.reqPack,false,"Combinar la mochila de montaña: con pantalón, no con el vestido");
  assert.equal(r.partyBag,"b2","Fiesta: bolso de fiesta antes que el de diario, aunque este sea favorito");
  assert.equal(r.occBag,"b3","Fiesta: bolso marcado para fiesta en la ficha, aunque no tenga formalidad");
  assert.equal(r.workCoat,"c2","Trabajo con frío: abrigo de paño antes que plumífero o parka");
  assert.ok(["c1","c3"].includes(r.onlyPuffer),"Si solo hay plumífero o parka, abriga igual");
  console.log("PASS: Outdoor backpack not with dresses; party bag at parties; dressy coat before puffer at work");
}

// Abrigo del look (clo, ISO 9920): suma de prendas frente a la temperatura; penaliza quedarse corto o pasarse
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,extra={})=>({id,name:type,category,type,color:"Negro",style:"casual",season:"all",updatedAt:"x",...extra});
  const tee=G("t1","Arriba","Camiseta",{sleeve:"corta"}),blouse=G("t2","Arriba","Blusa",{sleeve:"larga",thickness:"ligero"}),wool=G("t3","Arriba","Jersey",{sleeve:"larga",thickness:"grueso",fabric:"wool"});
  const shorts=G("b1","Abajo","Shorts"),pants=G("b2","Abajo","Pantalón"),blazer=G("c1","Capas","Blazer",{thickness:"ligero"}),coat=G("c2","Capas","Abrigo",{name:"Abrigo de lana",fabric:"wool"}),vest=G("c3","Capas","Chaleco");
  const boots=G("z1","Zapatos","Botas"),sandals=G("z2","Zapatos","Sandalias"),pj=G("h1","Casa","Pijama");
  appState.profile={id:"noelia"};appState.data=normalizeData({garments:[]});
  const sc=(gs,temp,occasion="daily")=>scoreOutfit(gs,engineContext({occasion,temp,date:temp<12?"2026-01-15":"2026-07-15",extras:{shoes:true,bag:false}}));
  const cold=sc([blouse,pants,blazer,boots],8),warm=sc([blouse,pants,coat,boots],8),light=sc([tee,shorts,vest,sandals],17),ok17=sc([tee,pants,blazer,boots],17);
  const hot=sc([wool,pants,coat,boots],28),summer=sc([tee,shorts,sandals],28),home=sc([pj],6,"home");
  return {clo:[cloOf(tee),cloOf(wool),cloOf(shorts),cloOf(coat),cloOf(boots)].map(x=>x.toFixed(2)).join(),target:[5,17,28].map(t=>cloTarget(t).toFixed(2)).join(),
   fabric:[cloOf(G("s1","Arriba","Camisa",{sleeve:"larga",thickness:"medio",fabric:"wool"}))>cloOf(G("s2","Arriba","Camisa",{sleeve:"larga",thickness:"medio"})),cloOf(G("s3","Arriba","Camisa",{sleeve:"larga",thickness:"medio",fabric:"linen"}))<cloOf(G("s2","Arriba","Camisa",{sleeve:"larga",thickness:"medio"}))].join(),
   cold:cold.score,warm:warm.score,coldWarn:cold.warnings.join("|"),light:light.score,ok17:ok17.score,hotWarn:hot.warnings.join("|"),summerWarn:summer.warnings.join("|"),homeWarn:home.warnings.join("|")};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.equal(r.clo,"0.14,0.37,0.07,0.51,0.10","clo por prenda aproximado a ISO 9920");assert.equal(r.target,"1.35,0.81,0.32");assert.equal(r.fabric,"true,true","Lana abriga más y lino menos, también con grosor indicado");
  assert.ok(r.warm>r.cold,"8 °C: con abrigo, mejor que con blazer fino ("+r.warm+" vs "+r.cold+")");assert.match(r.coldWarn,/frío/);
  assert.ok(r.ok17>r.light,"17 °C: pantalón y chaqueta, mejor que shorts y chaleco");
  assert.match(r.hotWarn,/demasiado abrigo/);assert.equal(r.summerWarn,"","28 °C: camiseta y shorts, sin aviso");assert.doesNotMatch(r.homeWarn,/pases frío/,"En casa no se mide el abrigo");
  console.log("PASS: Outfit insulation (clo) vs temperature: penalises too little or too much, not at home");
}

// Nota del look con restricciones (#128): un look a mano, de la IA o de «Cambiar prenda» que incumple una regla resta y avisa
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,extra={})=>({id,name:type,category,type,color:"Negro",style:"casual",season:"all",updatedAt:"x",...extra});
  appState.profile={id:"noelia"};appState.data=normalizeData({garments:[]});
  const tee=G("t1","Arriba","Camiseta",{sleeve:"corta"}),shorts=G("b1","Abajo","Shorts"),boots=G("z1","Zapatos","Botas"),sandals=G("z2","Zapatos","Sandalias");
  const ctx=engineContext({occasion:"daily",temp:28,date:"2026-07-15",extras:{shoes:true,bag:false}});
  const bad=scoreOutfit([tee,shorts,boots],ctx),good=scoreOutfit([tee,shorts,sandals],ctx);
  const work=engineContext({occasion:"work",temp:20,date:"2026-04-15",extras:{shoes:true,bag:false}});
  const hood=scoreOutfit([G("t2","Arriba","Sudadera"),G("b2","Abajo","Pantalón",{formality:"smartcasual"}),G("z3","Zapatos","Mocasines")],work);
  appState.data=normalizeData({garments:[G("s1","Arriba","Sudadera",{favorite:true}),G("s2","Arriba","Blusa",{formality:"smartcasual"}),G("s3","Arriba","Camisa",{formality:"smartcasual"}),G("s4","Abajo","Pantalón",{formality:"smartcasual"}),G("s5","Zapatos","Mocasines")]});
  const swap=swapOptions({garmentIds:["s3","s4","s5"],occasion:"work"},"s3").map(o=>o.g.id).join();
  return {swap,bad:bad.score,good:good.score,badWarn:bad.warnings.join("|"),goodWarn:good.warnings.join("|"),hoodWarn:hood.warnings.join("|"),issues:lookIssues([tee,shorts,sandals],ctx).length};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.ok(r.good>r.bad,"28 °C: sandalias puntúan más que botas ("+r.good+" vs "+r.bad+")");assert.match(r.badWarn,/Botas: botas con 28/);
  assert.equal(r.issues,0);assert.doesNotMatch(r.goodWarn,/botas/i);assert.match(r.hoodWarn,/Sudadera: no es para «trabajo»/);assert.equal(r.swap.split(",")[0],"s2","Cambiar prenda en un look de trabajo: blusa antes que sudadera favorita");
  console.log("PASS: Look score sees the generation constraints (occasion, heat, boots…) and warns");
}

// Detalles de estilista (#128): doble vaquero, prendas llamativas en el trabajo, top sin mangas con frío (penalizaciones suaves)
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,extra={})=>({id,name:type,category,type,color:"Negro",style:"casual",season:"all",updatedAt:"x",...extra});
  appState.profile={id:"noelia"};appState.data=normalizeData({garments:[]});
  const sc=(gs,occasion,temp)=>scoreOutfit(gs,engineContext({occasion,temp,date:temp<12?"2026-01-15":"2026-04-15",extras:{shoes:true,bag:false}})).score;
  const shoes=G("z1","Zapatos","Botines"),jeans=G("b1","Abajo","Vaqueros",{color:"Vaquero"}),black=G("b2","Abajo","Pantalón");
  const chambray=G("t1","Arriba","Camisa",{name:"Camisa vaquera",color:"Vaquero"}),white=G("t2","Arriba","Camisa",{color:"Blanco"}),jacket=G("c1","Capas","Cazadora",{name:"Cazadora vaquera",color:"Vaquero"});
  const coat=G("c2","Capas","Abrigo",{color:"Gris"}),fur=G("c3","Capas","Abrigo",{name:"Abrigo de pelo leopardo",pattern:"animal",color:"Marrón"}),sweater=G("t3","Arriba","Jersey",{sleeve:"larga"}),tank=G("t4","Arriba","Top",{sleeve:"sin mangas"});
  return {denim:sc([chambray,black,shoes],"daily",17)>sc([chambray,jeans,shoes],"daily",17),jacketOk:sc([white,jeans,shoes,jacket],"daily",17)>=sc([white,jeans,shoes],"daily",17)-3,
   loudWork:Math.abs(sc([sweater,black,shoes,coat],"work",8)-sc([sweater,black,shoes,fur],"work",8))<=3&&sc([sweater,black,shoes,coat],"work",8)>sc([sweater,black,shoes,G("c5","Capas","Chaqueta",{name:"Chaqueta de lentejuelas"})],"work",8),loudDaily:sc([sweater,black,shoes,coat],"daily",8)-sc([sweater,black,shoes,fur],"daily",8),
   cottonShirt:sc([G("t5","Arriba","Camisa",{name:"Camisa vaquera",fabric:"cotton",color:"Azul"}),jeans,shoes],"daily",17)>=sc([white,jeans,shoes],"daily",17)-3,
   plainLeo:Math.abs(sc([sweater,black,shoes,G("c4","Capas","Abrigo",{name:"Abrigo leopardo",pattern:"plain"})],"work",8)-sc([sweater,black,shoes,coat],"work",8))<=3,
   cropLen:sc([sweater,black,shoes,coat],"daily",8)>sc([G("t6","Arriba","Top",{sleeve:"larga",length:"cropped"}),black,shoes,coat],"daily",8),
   mix:(()=>{const st=G("t7","Arriba","Jersey",{pattern:"stripes",sleeve:"larga"}),ck=G("b3","Abajo","Pantalón",{pattern:"checks",color:"Beige"}),sc2=G("c6","Capas","Abrigo",{pattern:"stripes",color:"Gris"});
    const c=engineContext({occasion:"daily",temp:8,date:"2026-01-15",extras:{shoes:true,bag:false}}),gap=()=>scoreOutfit([sweater,black,shoes,sc2],c).score-scoreOutfit([st,ck,shoes,sc2],c).score;
    const plain=gap();c.likes=new Set(["pattern"]);return [plain,gap()]})(),
   denimTaste:(()=>{const c=engineContext({occasion:"daily",temp:17,date:"2026-04-15",extras:{shoes:true,bag:false}}),a=scoreOutfit([chambray,jeans,shoes],c).score;c.likes=new Set(["denim"]);return scoreOutfit([chambray,jeans,shoes],c).score>a})(),
   cold:sc([sweater,black,shoes,coat],"daily",8)>sc([tank,black,shoes,coat],"daily",8),warm:sc([tank,black,shoes],"daily",20)>=sc([sweater,black,shoes],"daily",20)-3};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.equal(r.denim,true,"Camisa vaquera: mejor con pantalón negro que con vaqueros");assert.equal(r.jacketOk,true,"Cazadora vaquera con vaqueros y camisa blanca: sin penalización");
  assert.equal(r.loudWork,true,"Trabajo: el abrigo de leopardo vale (votos de Noelia); las lentejuelas restan");assert.ok(Math.abs(r.loudDaily)<=4,"Diario: el leopardo no se penaliza por ser llamativo");
  assert.equal(r.cold,true,"8 °C: jersey mejor que top sin mangas bajo el abrigo");assert.equal(r.denimTaste,true,"Si te gusta el doble vaquero, no resta");assert.ok(r.mix[0]>10&&r.mix[1]<r.mix[0]-10,"Mezcla de estampados: penaliza por defecto, mucho menos si te gustan los estampados ("+r.mix+")");assert.equal(r.cottonShirt,true,"Ficha de algodón: no cuenta como vaquera aunque el nombre lo diga");assert.equal(r.plainLeo,true,"Ficha lisa: no es llamativa aunque el nombre diga leopardo");assert.equal(r.cropLen,true,"Largo «cropped» en la ficha: penaliza con frío aunque el nombre sea «Top»");assert.equal(r.warm,true,"20 °C: el top sin mangas no se penaliza");
  console.log("PASS: Stylist details: double denim, loud pieces at work, sleeveless top in the cold (soft)");
}

// Código de vestir del trabajo por perfil (auditoría de reglas, #128): arreglado por defecto, formal o informal
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,extra={})=>({id,name:type,category,type,color:"Negro",style:"casual",season:"all",updatedAt:"x",...extra});
  appState.profile={id:"noelia"};appState.data=normalizeData({garments:[]});
  const items=[G("h","Arriba","Sudadera"),G("s","Zapatos","Deportivas",{style:"sport"}),G("m","Bolsos","Mochila",{formality:"casual"}),G("x","Bolsos","Mochila",{name:"Mochila de montaña",formality:"sport"}),G("c","Zapatos","Chanclas"),G("j","Abajo","Vaqueros",{formality:"casual"}),G("b","Arriba","Blusa",{formality:"smartcasual"})];
  const at=w=>{appState.data.preferences.workDress=w;return items.map(g=>occasionFits(g,"work")?1:0).join("")};
  const out={def:at(undefined),arreglado:at("arreglado"),informal:at("informal"),formal:at("formal")};
  appState.data=normalizeData({garments:[G("t1","Arriba","Camisa",{formality:"smartcasual"}),G("p1","Abajo","Pantalón",{formality:"smartcasual"}),G("z1","Zapatos","Deportivas",{name:"Deportivas blancas",favorite:true}),G("z2","Zapatos","Mocasines")]});
  const shoe=w=>{appState.data.preferences.workDress=w;return rankOutfits({max:1,occasion:"work",date:"2026-04-15",temp:20})[0]?.ids.filter(i=>i[0]==="z").join()};
  out.shoeDef=shoe("arreglado");out.shoeInf=shoe("informal");appState.data.preferences.workDress="informal";out.plainPack=occasionFits(G("q","Bolsos","Mochila"),"work");
  const vivid=[G("v1","Arriba","Top",{color:"Rosa"}),G("v2","Abajo","Falda",{color:"Rosa"}),G("v3","Zapatos","Bailarinas",{color:"Rosa"})],c=engineContext({occasion:"daily",temp:20,date:"2026-04-15",extras:{shoes:true,bag:false}});
  const base=scoreOutfit(vivid,c).score;c.likes=new Set(["mono"]);const mono=scoreOutfit(vivid,c).score;c.likes=new Set(["vividmono"]);out.vivid=[base,mono,scoreOutfit(vivid,c).score];return out;`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  // orden: sudadera, deportivas, mochila urbana, mochila de montaña, chanclas, vaqueros, blusa
  assert.equal(r.def,r.arreglado,"Sin ajuste = arreglado");assert.equal(r.arreglado,"0100011","Arreglado: ni sudadera, ni mochilas, ni chanclas; deportivas solo como último recurso");
  assert.equal(r.informal,"1110011","Informal: sudadera, deportivas y mochila urbana sí; mochila de montaña y chanclas, no");
  assert.equal(r.formal,"0000001","Formal: solo prendas arregladas");
  assert.equal(r.shoeDef,"z2","Arreglado: mocasines antes que deportivas");assert.equal(r.plainPack,true,"Informal: mochila sin formalidad en la ficha, sí");assert.ok(r.vivid[1]-r.vivid[0]<=4&&r.vivid[2]-r.vivid[1]>=8,"Gustar de «monocromático» no relaja el color vivo repetido; «tono sobre tono vivo», sí ("+r.vivid+")");assert.equal(r.shoeInf,"z1","Informal: las deportivas favoritas valen");
  console.log("PASS: Work dress code per profile (arreglado, formal, informal)");
}

// Motivo del 👎 (#136 §22): «hoy» no enseña; «colores» solo los colores; «muy arreglado/informal» inclina la formalidad
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,extra={})=>({id,name:type,category,type,color:"Negro",style:"casual",season:"all",updatedAt:"x",...extra});
  const gs=[G("r1","Arriba","Camiseta",{color:"Rojo"}),G("r2","Abajo","Pantalón",{color:"Rojo"}),G("b1","Arriba","Camiseta",{color:"Azul"}),G("b2","Abajo","Pantalón",{color:"Azul"}),G("n1","Arriba","Blusa",{color:"Blanco",style:"smart",formality:"smartcasual"}),G("n2","Abajo","Pantalón",{color:"Negro",style:"smart",formality:"smartcasual"})];
  const L=(id,ids,extra={})=>({id,garmentIds:ids,updatedAt:"x",...extra});
  const looks=[L("l1",["r1","r2"],{dislikeReason:"color"}),L("l2",["r1","r2"],{dislikeReason:"color"}),L("l3",["r1","b2"],{dislikeReason:"hoy"}),L("l4",["b1","b2"]),L("l5",["b1","r2"]),L("l6",["n1","n2"]),L("l7",["b1","n2"])];
  appState.profile={id:"noelia"};appState.data=normalizeData({garments:gs,looks,feedback:{l1:"down",l2:"down",l3:"down",l4:"up",l5:"up",l6:"up",l7:"up"}});
  const t=tasteProfile(),dis=t.dislikes.map(x=>x.k),hoyIgnored=myLooks().filter(l=>l.dislikeReason==="hoy").length===1;
  const noBias=formalityBias();
  appState.data.looks.push(L("g1",["n1","n2"],{dislikeReason:"formal"}),L("g2",["n1","n2"],{dislikeReason:"formal"}),L("g3",["n1","n2"],{dislikeReason:"formal"}));Object.assign(appState.data.feedback,{g1:"up",g2:"up",g3:"up"});
  const staleBias=formalityBias();appState.data.looks=appState.data.looks.filter(l=>!l.id.startsWith("g"));
  appState.data.looks.push(...["a","b","c"].map(k=>L("f"+k,["n1","n2"],{dislikeReason:"formal"})));Object.assign(appState.data.feedback,{fa:"down",fb:"down",fc:"down"});
  const c=engineContext({occasion:"daily",temp:20,date:"2026-04-15",extras:{shoes:false,bag:false}});
  return {staleBias,dis:dis.join(),styleDisliked:dis.some(k=>k.startsWith("style:")),noBias,bias:c.formalBias,casualVsSmart:scoreOutfit([gs[2],gs[3]],c).score-scoreOutfit([gs[4],gs[5]],c).score,
   casualVsSmart0:(()=>{c.formalBias=0;return scoreOutfit([gs[2],gs[3]],c).score-scoreOutfit([gs[4],gs[5]],c).score})()};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.match(r.dis,/fam:rojo|mono/,"👎 «Colores» enseña colores ("+r.dis+")");assert.equal(r.styleDisliked,false,"👎 «Colores» no enseña estilo");
  assert.equal(r.noBias,0);assert.equal(r.staleBias,0,"Un motivo de 👎 que ya es 👍 no cuenta");assert.ok(r.bias>0,"Tres 👎 «Muy arreglado»: sesgo hacia lo informal");assert.ok(r.casualVsSmart>r.casualVsSmart0,"Con ese sesgo, el look informal gana terreno");
  console.log("PASS: Dislike reasons: 'hoy' ignored, 'colores' only colours, 'muy arreglado/informal' shifts formality");
}

// Inspiración (recréalo con tu armario): para cada prenda de la captura, las más parecidas del armario por sus características
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,color,extra={})=>({id,name:type+" "+color,category,type,color,style:"casual",season:"all",updatedAt:"x",...extra});
  appState.profile={id:"noelia"};appState.data=normalizeData({garments:[G("c1","Capas","Abrigo","Camel"),G("c2","Capas","Abrigo","Negro"),G("c3","Capas","Chaqueta","Marrón"),G("t1","Arriba","Jersey","Blanco"),G("b1","Abajo","Falda","Negro")]});
  const ids=it=>inspoMatches(it).map(g=>g.id).join();
  appState.data.garments.push(G("t2","Arriba","Blusa","Blanco",{pattern:"floral"}),G("t3","Arriba","Blusa","Blanco"));
  const unknownPattern=inspoScore({category:"Arriba",garmentType:"Blusa",color:"Blanco"},myGarments().find(g=>g.id==="t2"))===inspoScore({category:"Arriba",garmentType:"Blusa",color:"Blanco"},myGarments().find(g=>g.id==="t3"));
  const floral=ids({category:"Arriba",garmentType:"Blusa",color:"Blanco",pattern:"floral"}).split(",")[0];
  return {unknownPattern,floral,coat:ids({category:"Capas",garmentType:"Abrigo",color:"Camel"}),boots:ids({category:"Zapatos",garmentType:"Botines",color:"Burdeos"}),jeans:ids({category:"Abajo",garmentType:"Vaqueros",color:"Azul"})};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.equal(r.coat.split(",")[0],"c1","Abrigo camel: primero mi abrigo camel");assert.equal(r.unknownPattern,true,"Sin estampado en el análisis, no se premia lo liso");assert.equal(r.floral,"t2","Blusa de flores: primero mi blusa de flores");assert.equal(r.boots,"","Sin zapatos en el armario: nada");
  assert.equal(r.jeans,"","Vaqueros azules frente a falda negra: no es parecida (mejor «no tengo nada parecido»)");
  console.log("PASS: Inspiration matches the closest garments by attributes and admits when nothing is similar");
}

// Frío y prudencia (Noelia, 09/10): nada sin mangas ni corto bajo 12 °C; «Top» sin manga indicada se evita; paleta de tres colores
{
  const probe=new Function("document","sessionStorage","crypto",src+`
  const G=(id,category,type,color,extra={})=>({id,name:type+" "+color,category,type,color,style:"casual",season:"all",updatedAt:"x",...extra});
  appState.profile={id:"noelia"};
  appState.data=normalizeData({garments:[G("t1","Arriba","Top","Negro",{sleeve:"sin mangas"}),G("t2","Arriba","Top","Blanco"),G("t3","Arriba","Jersey","Gris",{sleeve:"larga"}),G("b1","Abajo","Pantalón","Negro"),G("z1","Zapatos","Botines","Negro"),G("c1","Capas","Abrigo","Camel")]});
  const tops=occ=>rankOutfits({max:3,occasion:occ,date:"2026-01-15",temp:8}).flatMap(l=>l.ids.filter(i=>i[0]==="t"));
  const daily=[...new Set(tops("daily"))].join(),warm=[...new Set(rankOutfits({max:3,occasion:"daily",date:"2026-07-15",temp:26}).flatMap(l=>l.ids.filter(i=>i[0]==="t")))].sort().join();
  const issue=lookIssues([G("t1","Arriba","Top","Negro",{sleeve:"sin mangas"}),G("b1","Abajo","Pantalón","Negro")],engineContext({occasion:"daily",temp:8,date:"2026-01-15"})).join("|");
  const party=coldExposed(G("d1","Vestidos","Vestido","Negro",{sleeve:"sin mangas"}),8,"party");
  const partyTop=coldExposed(G("t9","Arriba","Top","Negro",{sleeve:"sin mangas"}),8,"party"),keyRed=colorKey(G("x1","Arriba","Blusa","Rojo",{pattern:"floral"}))===colorKey(G("x2","Bolsos","Bolso","Rojo"));
  appState.data=normalizeData({garments:[G("a1","Arriba","Blusa","Negro"),G("a2","Abajo","Pantalón","Negro"),G("a3","Capas","Abrigo","Rosa"),G("a4","Zapatos","Mocasines","Negro"),G("bag1","Bolsos","Bolso","Rojo",{favorite:true}),G("bag2","Bolsos","Bolso","Rosa"),G("e1","Accesorios","Pendientes","Beige",{favorite:true})]});
  const look=rankOutfits({max:1,occasion:"daily",date:"2026-01-15",temp:8})[0].ids;
  return {partyTop,keyRed,daily,warm,issue,party,bag:look.filter(i=>i.startsWith("bag")).join(),pal:paletteOf(look.map(id=>myGarments().find(g=>g.id===id))).size};`);
  const r=probe(document,sessionStorage,{randomUUID:()=>"t"});
  assert.equal(r.daily,"t3","8 °C: solo el jersey de manga larga; ni el top sin mangas ni el «Top» sin dato");assert.match(r.warm,/t1/,"26 °C: el top sin mangas sí");
  assert.match(r.issue,/sin mangas o corto para 8/);assert.equal(r.party,false,"En fiesta, vestido sin mangas con abrigo, sí");assert.equal(r.partyTop,true,"En fiesta, un top sin mangas suelto a 8 °C, no");assert.equal(r.keyRed,true,"Un estampado cuenta por su color real");
  assert.equal(r.bag,"bag2","Abrigo rosa: bolso rosa que repite color, no rojo aunque sea favorito");assert.ok(r.pal<=3,"Como mucho tres colores ("+r.pal+")");
  console.log("PASS: Cold: no sleeveless/cropped tops below 12 °C, unknown-sleeve 'Top' avoided; three-colour palette for bags and accessories");
}

// Foto de look: el análisis devuelve también formalidad, manga y largo (perfil de prenda), solo con valores conocidos
{
  process.env.ATELIER_SESSION_SECRET="test-secret";process.env.OPENAI_API_KEY="k";
  const auth=await import("../atelier-api/_lib/auth.js"),analyze=(await import("../atelier-api/api/analyze.js?perfil")).default;
  const realFetch=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,json:async()=>({output_text:JSON.stringify({items:[{type:"bag",name:"Mochila",formality:"smartcasual",sleeve:"x",length:"raro",box:[1,1,10,10]},{type:"top",name:"Top",sleeve:"sin mangas",formality:"inventada",pattern:"floral",box:[1,1,10,10]}]})})});
  const res={code:0,body:null,setHeader(){},status(c){this.code=c;return this},json(b){this.body=b;return this},end(){return this}};
  await analyze({method:"POST",headers:{authorization:"Bearer "+auth.issueSession("noelia"),origin:"https://noeliatoledano.github.io"},body:{image:"data:image/jpeg;base64,AAAA",mode:"outfit"}},res);
  globalThis.fetch=realFetch;
  assert.equal(res.body.items[0].formality,"smartcasual");assert.equal(res.body.items[0].sleeve,undefined);assert.equal(res.body.items[0].length,undefined);
  assert.equal(res.body.items[1].sleeve,"sin mangas");assert.equal(res.body.items[1].pattern,"floral");assert.equal(res.body.items[0].pattern,undefined);assert.equal(res.body.items[1].formality,undefined);
  console.log("PASS: Outfit photo items carry formality, sleeve and length (validated)");
}

/* #176: version cache must not leak options between dates/weather/profiles.
   Execute the real versionsOf function in isolation to catch key collisions. */
{
 const start=src.indexOf("function versionsOf("),end=src.indexOf("function pickedLook(",start);
 assert.ok(start>=0&&end>start,"versionsOf exists in the styling engine");
 const actual=src.slice(start,end);
 const probe=new Function("fn",`
  const versionCache=new Map(),relCache={sig:"equal-length-a"};
  let calls=0;const versionPick=new Map();
  const lookSig=ids=>ids.join("|");
  const engineContext=()=>({date:"2026-07-15",occasion:"daily",temp:24});
  const lookVersions=(_gs,ctx)=>{calls++;return [{label:"Si refresca",ids:[String(ctx.temp),String(ctx.occasion)],garments:[]}]};
  eval(fn+"\\n;globalThis.__versionsOf=versionsOf");
  const main=[{id:"dress",category:"Vestidos"}],a=globalThis.__versionsOf("plan:day",main,{date:"2026-07-15",occasion:"daily",temp:24});
  const b=globalThis.__versionsOf("plan:day",main,{date:"2026-07-15",occasion:"daily",temp:12});
  relCache.sig="equal-length-b";
  const c=globalThis.__versionsOf("plan:day",main,{date:"2026-07-15",occasion:"party",temp:12});
  delete globalThis.__versionsOf;
  return {calls,a:a[0]?.ids,b:b[0]?.ids,c:c[0]?.ids};
 `);
 const got=probe(actual);
 assert.deepEqual(got.b,["12","daily"],"Version cache must invalidate when forecast temperature changes");
 assert.deepEqual(got.c,["12","party"],"Version cache must invalidate when context and equal-length garment signature change");
 assert.equal(got.calls,3,"One cached computation per genuinely different styling context");
 console.log("PASS: Versions cache isolates weather, occasion, and equal-length signatures");
}

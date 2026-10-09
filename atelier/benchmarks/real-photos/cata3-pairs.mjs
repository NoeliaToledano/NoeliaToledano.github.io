// Lote de prueba congelado n.º 3 (#128): motor actual frente al motor que vio la familia (v114) y frente a un look válido al azar.
//   git show 8cffb42:atelier/atelier.js > /tmp/atelier-v114.js   (motor de la cata anterior, v114)
//   node atelier/benchmarks/real-photos/cata3-pairs.mjs /tmp/atelier-v114.js > atelier/benchmarks/real-photos/pairs-cata3-polyvore.json
// Generado por código (semilla fija); sirve para certificar, no para ajustar reglas mirando sus votos.
import fs from "node:fs";
const HERE=new URL(".",import.meta.url).pathname,OLD=process.argv[2];
const L=JSON.parse(fs.readFileSync(HERE+"labels-polyvore.json")),W=JSON.parse(fs.readFileSync(HERE+"wardrobes-polyvore.json"));
const node={classList:{add(){},remove(){},toggle(){}},replaceChildren(){},setAttribute(){},value:"",textContent:""};
const load=src=>new Function("document","sessionStorage","crypto",src+";return {appState,normalizeData,engineContext,rankOutfits,lookIssues,lookComplete,layerRule,seasonFits};")(
 {addEventListener(){},querySelector:()=>node,querySelectorAll:()=>[]},{getItem(){return null},removeItem(){}},{randomUUID:()=>"x"});
const NEW=load(fs.readFileSync(new URL("../../atelier.js",import.meta.url),"utf8")),OLDAPP=load(fs.readFileSync(OLD,"utf8"));
const SC=[["2026-01-15",8,"daily"],["2026-01-15",8,"work"],["2026-04-15",17,"daily"],["2026-04-15",17,"work"],["2026-04-15",17,"party"],["2026-07-15",28,"daily"],["2026-07-15",28,"work"],["2026-07-15",28,"party"],["2026-07-15",28,"beach"]];
let seed=20261010;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648,pick=a=>a[Math.floor(rnd()*a.length)];
const full=L.map(g=>({...g,image:"",updatedAt:"x",createdAt:"2026-10-01"})),sig=ids=>ids.slice().sort().join();
const set=(app,gs)=>{app.appState.profile={id:"bench",name:"Bench"};app.appState.data=app.normalizeData({garments:gs.map(g=>({...g}))})};
const out=[];let n=0;const push=(wn,occ,temp,x,y,kind)=>{n++;const swap=rnd()<.5;out.push({id:"c"+String(n).padStart(2,"0"),wardrobe:wn,occasion:occ,temp,kind,a:swap?y:x,b:swap?x:y,current:swap?"b":"a"})};
for(const [wn,ids] of Object.entries(W)){
 const s=new Set(ids),gs=full.filter(g=>s.has(g.id));
 for(const [date,temp,occ] of SC){
  set(NEW,gs);const cur=NEW.rankOutfits({max:3,date,temp,occasion:occ})[0];set(OLDAPP,gs);const old=OLDAPP.rankOutfits({max:3,date,temp,occasion:occ})[0];
  if(cur&&old&&sig(cur.ids)!==sig(old.ids))push(wn,occ,temp,cur.ids,old.ids,"actual-vs-antiguo");
  if(!cur)continue;set(NEW,gs);const ctx=NEW.engineContext({occasion:occ,temp,date,extras:{shoes:true,bag:true}}),by=c=>gs.filter(g=>g.category===c&&NEW.seasonFits(g,ctx.season));
  let rival=null;
  for(let t=0;t<3000&&!rival;t++){
   const base=rnd()<.3&&by("Vestidos").length?[pick(by("Vestidos"))]:by("Arriba").length&&by("Abajo").length?[pick(by("Arriba")),pick(by("Abajo"))]:null;if(!base)break;
   const look=[...base],shoes=by("Zapatos");if(occ!=="beach"||rnd()<.8){if(!shoes.length)continue;look.push(pick(shoes))}
   if(NEW.layerRule(temp).need){const c=by("Capas");if(!c.length)continue;look.push(pick(c))}
   if(rnd()<.6&&by("Bolsos").length)look.push(pick(by("Bolsos")));if(rnd()<.5&&by("Accesorios").length)look.push(pick(by("Accesorios")));
   if(sig(look.map(g=>g.id))===sig(cur.ids)||!NEW.lookComplete(look)||NEW.lookIssues(look,ctx).length)continue;
   if(look.some(g=>cur.ids.includes(g.id)&&["Arriba","Abajo","Vestidos"].includes(g.category))&&rnd()<.7)continue;
   rival=look.map(g=>g.id);
  }
  if(rival)push(wn,occ,temp,cur.ids,rival,"actual-vs-azar");
 }
}
console.log(JSON.stringify(out,null,1));
console.error(out.length+" pares: "+out.filter(p=>p.kind==="actual-vs-antiguo").length+" frente al motor antiguo, "+out.filter(p=>p.kind==="actual-vs-azar").length+" frente al azar");

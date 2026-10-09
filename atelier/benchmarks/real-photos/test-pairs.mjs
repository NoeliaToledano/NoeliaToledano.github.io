// Lote de prueba congelado (#128): look del motor frente a un look VÁLIDO al azar, para votación a ciegas de la familia.
//   node atelier/benchmarks/real-photos/test-pairs.mjs [labels-polyvore.json] [wardrobes-polyvore.json] > pairs-test-polyvore.json
// No lo escribe ningún asistente a mano: el rival es aleatorio (semilla fija) y cumple todas las restricciones (lookIssues vacío,
// look completo, calzado; capa si hace frío). Sirve SOLO para certificar: no se ajustan reglas mirando sus votos.
import fs from "node:fs";
const HERE=new URL(".",import.meta.url).pathname,args=process.argv.slice(2);
const L=JSON.parse(fs.readFileSync(HERE+(args[0]||"labels-polyvore.json"))),W=JSON.parse(fs.readFileSync(HERE+(args[1]||"wardrobes-polyvore.json")));
const src=fs.readFileSync(new URL("../../atelier.js",import.meta.url),"utf8");
const node={classList:{add(){},remove(){},toggle(){}},replaceChildren(){},setAttribute(){},value:"",textContent:""};
const app=new Function("document","sessionStorage","crypto",src+";return {appState,normalizeData,engineContext,rankOutfits,lookIssues,lookComplete,layerRule,seasonFits};")(
 {addEventListener(){},querySelector:()=>node,querySelectorAll:()=>[]},{getItem(){return null},removeItem(){}},{randomUUID:()=>"x"});
const SC=[["2026-01-15",8,"daily"],["2026-01-15",8,"work"],["2026-04-15",17,"daily"],["2026-04-15",17,"work"],["2026-04-15",17,"party"],["2026-07-15",28,"daily"],["2026-07-15",28,"work"],["2026-07-15",28,"party"],["2026-07-15",28,"beach"]];
let seed=20261009;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648,pick=a=>a[Math.floor(rnd()*a.length)];
const full=L.map(g=>({...g,image:"",updatedAt:"x",createdAt:"2026-10-01"}));
const out=[];let n=0;
for(const [wn,ids] of Object.entries(W)){
 const set=new Set(ids),gs=full.filter(g=>set.has(g.id));
 app.appState.profile={id:"bench",name:"Bench"};app.appState.data=app.normalizeData({garments:gs});
 for(const [date,temp,occ] of SC){
  const ctx=app.engineContext({occasion:occ,temp,date,extras:{shoes:true,bag:true}}),engine=app.rankOutfits({max:3,date,temp,occasion:occ});
  const by=c=>gs.filter(g=>g.category===c&&app.seasonFits(g,ctx.season));
  for(const rank of [0,2]){ // look 1 y look 3 del motor: también medimos si el tercero sigue siendo mejor que el azar
   const e=engine[rank];if(!e)continue;const eSig=e.ids.slice().sort().join();
   let rival=null;
   for(let t=0;t<3000&&!rival;t++){
    const base=rnd()<.3&&by("Vestidos").length?[pick(by("Vestidos"))]:by("Arriba").length&&by("Abajo").length?[pick(by("Arriba")),pick(by("Abajo"))]:null;if(!base)break;
    const look=[...base];const shoes=by("Zapatos");if(occ!=="beach"||rnd()<.8){if(!shoes.length)continue;look.push(pick(shoes))}
    if(app.layerRule(temp).need){const c=by("Capas");if(!c.length)continue;look.push(pick(c))}
    if(rnd()<.6&&by("Bolsos").length)look.push(pick(by("Bolsos")));if(rnd()<.5&&by("Accesorios").length)look.push(pick(by("Accesorios")));
    const sig=look.map(g=>g.id).sort().join();
    if(sig===eSig||!app.lookComplete(look)||app.lookIssues(look,ctx).length)continue;
    if(look.filter(g=>e.ids.includes(g.id)&&["Arriba","Abajo","Vestidos"].includes(g.category)).length>=1&&rnd()<.7)continue; // que se parezcan poco
    rival=look.map(g=>g.id);
   }
   if(!rival)continue;
   n++;const swap=rnd()<.5;
   out.push({id:"t"+String(n).padStart(2,"0"),wardrobe:wn,occasion:occ,temp,a:swap?rival:e.ids,b:swap?e.ids:rival,engine:swap?"b":"a",engineRank:rank+1,engineVersion:"main v114"});
  }
 }
}
console.log(JSON.stringify(out,null,1));
console.error(out.length+" pares (motor frente a look válido al azar)");

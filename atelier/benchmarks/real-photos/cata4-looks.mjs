// Lote congelado n.º 4 (#128): looks sueltos para votar «me lo pondría / no» deslizando, como en Tinder.
//   node atelier/benchmarks/real-photos/cata4-looks.mjs > atelier/benchmarks/real-photos/looks-cata4-polyvore.json
// Mezcla a ciegas los 3 looks del motor con 2 looks válidos al azar por situación (semilla fija). Mide qué parte de lo que
// propone el motor se pondría la familia frente al azar. Sin looks repetidos: dos looks con las mismas prendas principales
// (arriba, abajo, vestido, capa y calzado) cuentan como el mismo aunque cambie el bolso o un complemento, y una misma base
// (vestido, o arriba + abajo) sale como mucho dos veces.
import fs from "node:fs";
const HERE=new URL(".",import.meta.url).pathname;
const L=JSON.parse(fs.readFileSync(HERE+"labels-polyvore.json")),W=JSON.parse(fs.readFileSync(HERE+"wardrobes-polyvore.json"));
const node={classList:{add(){},remove(){},toggle(){}},replaceChildren(){},setAttribute(){},value:"",textContent:""};
const app=new Function("document","sessionStorage","crypto",fs.readFileSync(new URL("../../atelier.js",import.meta.url),"utf8")+";return {appState,normalizeData,engineContext,rankOutfits,lookIssues,lookComplete,layerRule,seasonFits};")(
 {addEventListener(){},querySelector:()=>node,querySelectorAll:()=>[]},{getItem(){return null},removeItem(){}},{randomUUID:()=>"x"});
const SC=[["2026-01-15",8,"daily"],["2026-01-15",8,"work"],["2026-04-15",17,"daily"],["2026-04-15",17,"work"],["2026-04-15",17,"party"],["2026-07-15",28,"daily"],["2026-07-15",28,"work"],["2026-07-15",28,"party"],["2026-07-15",28,"beach"]];
let seed=20261010;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648,pick=a=>a[Math.floor(rnd()*a.length)];
const gs=L.filter(g=>new Set(W.P).has(g.id)).map(g=>({...g,image:"",updatedAt:"x",createdAt:"2026-10-01"})),G=new Map(gs.map(g=>[g.id,g]));
const MAIN=["Arriba","Abajo","Vestidos","Capas","Zapatos"],core=ids=>ids.filter(id=>MAIN.includes(G.get(id).category)).sort().join();
const baseOf=ids=>ids.filter(id=>["Arriba","Abajo","Vestidos"].includes(G.get(id).category)).sort().join(),bases=new Map(),MAX_BASE=2; // la misma base (vestido, o arriba + abajo) como mucho 2 veces en todo el lote
app.appState.profile={id:"bench",name:"Bench"};app.appState.data=app.normalizeData({garments:gs});
const seen=new Set(),cards=[];
for(const [date,temp,occ] of SC){
 const ctx=app.engineContext({occasion:occ,temp,date,extras:{shoes:true,bag:true}}),by=c=>gs.filter(g=>g.category===c&&app.seasonFits(g,ctx.season));
 const add=(ids,source,rank)=>{const k=core(ids),b=baseOf(ids);if(seen.has(k)||(bases.get(b)||0)>=MAX_BASE)return false;seen.add(k);bases.set(b,(bases.get(b)||0)+1);cards.push({occasion:occ,temp,ids,source,...(rank?{rank}:{})});return true};
 app.rankOutfits({max:3,date,temp,occasion:occ}).forEach((l,i)=>add(l.ids,"motor",i+1));
 let n=0;
 for(let t=0;t<4000&&n<2;t++){
  const base=rnd()<.3&&by("Vestidos").length?[pick(by("Vestidos"))]:by("Arriba").length&&by("Abajo").length?[pick(by("Arriba")),pick(by("Abajo"))]:null;if(!base)break;
  const look=[...base],shoes=by("Zapatos");if(occ!=="beach"||rnd()<.8){if(!shoes.length)continue;look.push(pick(shoes))}
  if(app.layerRule(temp).need){const c=by("Capas");if(!c.length)continue;look.push(pick(c))}
  if(rnd()<.5&&by("Bolsos").length)look.push(pick(by("Bolsos")));if(rnd()<.4&&by("Accesorios").length)look.push(pick(by("Accesorios")));
  if(!app.lookComplete(look)||app.lookIssues(look,ctx).length)continue;
  if(add(look.map(g=>g.id),"azar"))n++;
 }
}
// Orden aleatorio (semilla fija) para que no se adivine el origen
for(let i=cards.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]]}
cards.forEach((c,i)=>c.id="k"+String(i+1).padStart(2,"0"));
console.log(JSON.stringify(cards.map(({id,...c})=>({id,...c})),null,1));
console.error(cards.length+" looks: "+cards.filter(c=>c.source==="motor").length+" del motor, "+cards.filter(c=>c.source==="azar").length+" al azar");

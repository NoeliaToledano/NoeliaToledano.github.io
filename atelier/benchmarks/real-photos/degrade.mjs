// Degradación (#128): ¿qué pasa cuando las fichas están incompletas? Sin fotos, sin red y sin IA.
//   node atelier/benchmarks/real-photos/degrade.mjs [labels-polyvore.json] [wardrobes-polyvore.json]
// Genera los looks con fichas a las que se quita al azar (semilla fija) un 0 %, 25 % o 50 % de los campos,
// y los juzga con las fichas COMPLETAS (lookIssues + patrones de eval.mjs). Mide también cuánto cambia el top-3.
import fs from "node:fs";
const HERE=new URL(".",import.meta.url).pathname,args=process.argv.slice(2);
const L=JSON.parse(fs.readFileSync(HERE+(args[0]||"labels-polyvore.json"))),W=JSON.parse(fs.readFileSync(HERE+(args[1]||"wardrobes-polyvore.json")));
const src=fs.readFileSync(new URL("../../atelier.js",import.meta.url),"utf8");
const node={classList:{add(){},remove(){},toggle(){}},replaceChildren(){},setAttribute(){},value:"",textContent:""};
const app=new Function("document","sessionStorage","crypto",src+";return {appState,normalizeData,engineContext,rankOutfits,lookIssues};")(
 {addEventListener(){},querySelector:()=>node,querySelectorAll:()=>[]},{getItem(){return null},removeItem(){}},{randomUUID:()=>"x"});
const FIELDS=["sleeve","length","thickness","fabric","formality","pattern","occasions","fit","warmth"]; // opcionales: estilo, temporada, tipo y color siempre están en la ficha
const SC=[["2026-01-15",8,"daily"],["2026-01-15",8,"work"],["2026-04-15",17,"daily"],["2026-04-15",17,"work"],["2026-04-15",17,"party"],["2026-07-15",28,"daily"],["2026-07-15",28,"work"],["2026-07-15",28,"party"],["2026-07-15",28,"beach"]];
let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
const full=new Map(L.map(g=>[g.id,{...g,image:"",updatedAt:"x",createdAt:"2026-10-01"}]));
function degrade(rate){seed=7;return [...full.values()].map(g=>{const d={...g};for(const f of FIELDS)if(f in d&&rnd()<rate)delete d[f];return d})}
function run(gs){const out=[];for(const [wn,ids] of Object.entries(W)){const set=new Set(ids);
 app.appState.profile={id:"bench",name:"Bench"};app.appState.data=app.normalizeData({garments:gs.filter(g=>set.has(g.id))});
 for(const [date,temp,occ] of SC){const looks=app.rankOutfits({max:3,date,temp,occasion:occ});looks.forEach((l,i)=>out.push({wn,occ,temp,i,ids:l.ids}))}}return out}
// Juez con fichas completas
const judge=r=>{const gs=r.ids.map(id=>full.get(id));app.appState.data=app.normalizeData({garments:[...full.values()]});
 const ctx=app.engineContext({occasion:r.occ,temp:r.temp,date:r.temp<12?"2026-01-15":r.temp<22?"2026-04-15":"2026-07-15",extras:{shoes:true,bag:true}});return app.lookIssues(gs,ctx)};
const base=run([...full.values()]),key=r=>r.wn+"|"+r.occ+"|"+r.temp,top=rows=>{const m=new Map();for(const r of rows){if(!m.has(key(r)))m.set(key(r),new Set());r.ids.forEach(id=>m.get(key(r)).add(id))}return m};
const T0=top(base);
for(const rate of [0,.25,.5]){
 const rows=rate?run(degrade(rate)):base,bad=rows.map(r=>({r,v:judge(r)})).filter(x=>x.v.length),T=top(rows);
 let j=0,n=0;for(const [k,s] of T0){const t=T.get(k)||new Set();const u=new Set([...s,...t]);j+=u.size?[...s].filter(x=>t.has(x)).length/u.size:1;n++}
 console.log(`Fichas con ${Math.round(rate*100)} % de campos quitados: ${rows.length} looks · ${bad.length} incumplen reglas reales · parecido con el top-3 completo ${(j/n).toFixed(2)}`);
 const by={};for(const x of bad)for(const v of x.v){const k=v.replace(/^[^:]+: /,"").replace(/\d+ °C/,"X °C");by[k]=(by[k]||0)+1}
 for(const [k,c] of Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,8))console.log("   ",c+"×",k);
}

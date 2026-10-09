// Evaluación visual con fotos reales (clothing-dataset-small, carpeta test). Uso:
//   git clone https://github.com/alexeygrigorev/clothing-dataset-small  (fuera del repositorio)
//   python3 -m http.server 8000   (en la raíz del repositorio)
//   node atelier/benchmarks/real-photos/eval.mjs <ruta>/clothing-dataset-small/test <carpeta de salida>
// Las fotos no se suben al repositorio: aquí solo están las etiquetas (labels.json) y los armarios (wardrobes.json).
import { chromium } from "playwright";
import fs from "node:fs";import path from "node:path";
const HERE=new URL(".",import.meta.url).pathname,DS=process.argv[2],OUT=process.argv[3]||"look-eval";fs.mkdirSync(OUT,{recursive:true});
// Banco alternativo: node eval.mjs <carpeta de fotos> <salida> labels-polyvore.json wardrobes-polyvore.json
const LABELS=process.argv[4]||"labels.json",WARDROBES=process.argv[5]||"wardrobes.json";
const L=JSON.parse(fs.readFileSync(HERE+LABELS));for(const g of L)g.image="data:image/jpeg;base64,"+fs.readFileSync(path.join(DS,g.file)).toString("base64");
const W=JSON.parse(fs.readFileSync(HERE+WARDROBES));
const SC=[["2026-01-15",8,"daily"],["2026-01-15",8,"work"],["2026-04-15",17,"daily"],["2026-04-15",17,"work"],["2026-04-15",17,"party"],["2026-07-15",28,"daily"],["2026-07-15",28,"work"],["2026-07-15",28,"party"],["2026-07-15",28,"beach"]];
const b=await chromium.launch({channel:"chrome"});const p=await b.newPage({viewport:{width:1200,height:900}});
await p.route("https://atelier-ai-backend-pi.vercel.app/**",r=>r.fulfill({status:503,headers:{"access-control-allow-origin":"*","content-type":"application/json"},body:"{}"}));
await p.goto("http://127.0.0.1:8000/atelier/");
// Fondo blanco como en la app (en el móvil, sin IA); se guarda bgWhite según el resultado
for(const g of L){const r=await p.evaluate(async src=>{const e=await enhancePhoto(src);return {white:!!e?.white,image:await shrinkDataUrl(e?.image||src,420)}},g.image);g.image=r.image;g.bgWhite=r.white}
const report=[];
for(const [wn,ids] of Object.entries(W)){
 const gs=ids.map(id=>L.find(g=>g.id===id));
 const res=await p.evaluate(({gs,SC,wn})=>{
  document.querySelector("#auth")?.classList.add("hidden");document.querySelector("#app")?.classList.remove("hidden");
  appState.profile={id:"noelia",name:"Noelia"};appState.data=normalizeData({garments:gs.map(g=>({...g,updatedAt:"x",createdAt:"2026-10-01"}))});
  const out=[];let html='<style>.ev{font:13px system-ui;padding:12px}.sc{margin:18px 0}.row{display:grid;grid-template-columns:repeat(3,330px);gap:14px}.lk{border:1px solid #ddd;border-radius:12px;overflow:hidden;background:#fff}.lk .meta{padding:6px 8px;font-size:11px;line-height:1.35}.bad{color:#b00;font-weight:600}</style><div class="ev"><h1>Armario '+wn+' ('+gs.length+' prendas)</h1>';
  for(const [date,temp,occ] of SC){
   const looks=rankOutfits({max:3,date,temp,occasion:occ});
   html+='<div class="sc"><h2>'+wn+' · '+occ+' · '+temp+' °C ('+date+')</h2><div class="row">';
   looks.forEach((l,i)=>{
    const g=l.garments,cats=g.map(x=>x.category),issues=[];
    if(!lookComplete(g))issues.push("sin base");
    const cnt={};for(const c of cats)cnt[c]=(cnt[c]||0)+1;for(const [c,n] of Object.entries(cnt))if(n>1&&c!=="Accesorios")issues.push(n+"× "+c);
    if(occ!=="beach"&&!cats.includes("Zapatos"))issues.push("sin calzado");
    if(temp<15&&!cats.includes("Capas"))issues.push("frío sin capa");
    if(temp>=24&&cats.includes("Capas"))issues.push("capa con calor");
    if(g.some(x=>x.season==="cold")&&temp>=24)issues.push("prenda de invierno con calor");
    if(g.some(x=>x.season==="warm")&&temp<12)issues.push("prenda de verano con frío");
    if(g.some(x=>x.type==="Zapatillas de casa"))issues.push("zapatillas de casa");
    if(occ==="work"&&g.some(x=>["Shorts","Sandalias","Zuecos"].includes(x.type)))issues.push("informal para trabajo");
    if(occ==="party"&&g.some(x=>["Deportivas","Zuecos"].includes(x.type)))issues.push("deportivas en fiesta");
    out.push({wn,occ,temp,i,ids:g.map(x=>x.id),names:g.map(x=>x.name),score:l.score,issues,reasons:l.reasons,warnings:l.warnings});
    html+='<div class="lk">'+outfitBoard(g)+'<div class="meta"><b>#'+(i+1)+' · '+l.score+'</b> — '+g.map(x=>x.name).join(" · ")+(issues.length?'<div class="bad">⚠ '+issues.join(", ")+'</div>':'')+'<div>'+(l.reasons||[]).slice(0,2).join(" · ")+'</div></div></div>';
   });
   if(!looks.length)html+='<div class="bad">Sin propuestas</div>';
   html+='</div></div>';
  }
  document.body.innerHTML=html+'</div>';
  return out;
 },{gs,SC,wn});
 report.push(...res);
 await p.waitForTimeout(800);
 const h=await p.evaluate(()=>document.body.scrollHeight);
 for(let y=0,k=0;y<h;y+=2400,k++){await p.setViewportSize({width:1100,height:2400});await p.evaluate(y=>window.scrollTo(0,y),y);await p.waitForTimeout(400);await p.screenshot({path:OUT+"/"+wn+"-"+k+".png"})}
}
fs.writeFileSync(OUT+"/report.json",JSON.stringify(report,null,1));
const n=report.length,bad=report.filter(r=>r.issues.length);
console.log("looks",n,"con avisos",bad.length);
// Patrones poco naturales vistos en la revisión visual (09/10): se cuentan para comparar antes/después
const G=new Map(L.map(g=>[g.id,g])),NEUTRAL=new Set(["Negro","Blanco","Gris","Beige","Marrón","Vaquero"]),gsOf=r=>r.ids.map(id=>G.get(id));
const daily=new Map(report.filter(r=>r.occ==="daily").map(r=>[r.wn+"|"+r.temp+"|"+r.i,r.ids.slice().sort().join()]));
const pat={
 "3+ piezas del mismo color vivo":r=>{const c={};for(const g of gsOf(r))if(!NEUTRAL.has(g.color))c[g.color]=(c[g.color]||0)+1;return Math.max(0,...Object.values(c))>=3},
 "con gorra/gorro/boina/sombrero":r=>gsOf(r).some(g=>/gorr|boina|sombrero/i.test(g.type||"")),
 "jersey a 24 °C o más":r=>r.temp>=24&&gsOf(r).some(g=>g.type==="Jersey"),
 "gorra/gorro en trabajo o fiesta":r=>["work","party"].includes(r.occ)&&gsOf(r).some(g=>["Gorra","Gorro"].includes(g.type)),
 "gorro de lana a 15 °C o más":r=>r.temp>=15&&gsOf(r).some(g=>g.type==="Gorro"),
 "trabajo idéntico a diario":r=>r.occ==="work"&&daily.get(r.wn+"|"+r.temp+"|"+r.i)===r.ids.slice().sort().join(),
 "playa con jersey o capa":r=>r.occ==="beach"&&gsOf(r).some(g=>g.type==="Jersey"||g.category==="Capas")
};
Object.assign(pat,{
 "fiesta sin tacones ni calzado elegante":r=>r.occ==="party"&&!gsOf(r).some(g=>g.category==="Zapatos"&&["party","smart"].includes(g.style)),
 "deportivas en fiesta":r=>r.occ==="party"&&gsOf(r).some(g=>g.type==="Deportivas"),
 "tacones en playa":r=>r.occ==="beach"&&gsOf(r).some(g=>g.type==="Tacones"),
 "bolso de fiesta fuera de fiesta":r=>r.occ!=="party"&&gsOf(r).some(g=>g.type==="Bolso de fiesta"),
 "mochila en trabajo o fiesta":r=>["work","party"].includes(r.occ)&&gsOf(r).some(g=>g.type==="Mochila"),
 "con bolso":r=>gsOf(r).some(g=>g.category==="Bolsos"),
 "abrigo de pelo/estampado con estampado":r=>gsOf(r).filter(g=>g.pattern&&g.pattern!=="plain").length>=2
});
for(const [k,f] of Object.entries(pat))console.log(k+":",report.filter(f).length);const by={};for(const r of bad)for(const i of r.issues)by[i]=(by[i]||0)+1;console.log(by);
await b.close();

#!/usr/bin/env node
/** Generate independently reviewable, deterministic A/B comparison assignments.
 * Usage: node blind-look-review.mjs old-report.json new-report.json review-pack.json
 * Reports from real-photos/eval.mjs (array of rows with wn/occ/temp/i/ids) or
 * evaluate-outfits.mjs ({looks:[{size,temperature,occasion,garments}]}).
 * Outputs NO assertions of visual quality and NO hidden score in review entries.
 * Reviewers see pairs through their existing local image boards, not photos here.
 */
import fs from "node:fs";
const [before,after,out,catalogPath,keyPath]=process.argv.slice(2);
if(!before||!after||!out||!catalogPath||!keyPath)throw Error("Usage: node blind-look-review.mjs baseline.json candidate.json review.json photo-catalog.json PRIVATE-answers.json");
if([before,after,out,catalogPath].some(p=>p===keyPath)||keyPath===(out.toLowerCase().endsWith(".json")?out.slice(0,-5):out)+".html")throw Error("Private answer key must be stored separately from the review pack and board");
const read=p=>{const v=JSON.parse(fs.readFileSync(p,"utf8"));return Array.isArray(v)?v:v.looks;};
const arr=read(before),brr=read(after);
if(!Array.isArray(arr)||!Array.isArray(brr))throw Error("Expected reports with looks");
const key=r=>[r.wn||r.size||"wardrobe",r.occ||r.occasion,r.temp??r.temperature,r.i??Number(String(r.id||"").split("-").at(-1))].join("|");
const ids=r=>Array.isArray(r.ids)?r.ids:Array.isArray(r.garments)?r.garments.map(x=>x.id):[];
const a=new Map(arr.map(r=>[key(r),r])),b=new Map(brr.map(r=>[key(r),r]));
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const pairs=[],answerKey=[];
for(const k of [...a.keys()].sort()){
 if(!b.has(k))continue;
 const left=a.get(k),right=b.get(k),ai=ids(left),bi=ids(right);
 if(!ai.length||!bi.length||ai.join("|")===bi.join("|"))continue;
 const reverse=hash(k)%2===1;
 const id="review-"+String(pairs.length+1).padStart(4,"0");
 answerKey.push({id,candidate:reverse?"A":"B",baseline:reverse?"B":"A"});
 pairs.push({id,scenario:k,
  A:{garmentIds:reverse?bi:ai},B:{garmentIds:reverse?ai:bi},
  judgement:null,reason:"",context: k.split("|").slice(1,-1).join(" · ")});
}
// One neutral, score-free visual board per evaluation. Catalog stays local: do not commit personal photos.
const catalog=JSON.parse(fs.readFileSync(catalogPath,"utf8"));
if(!Array.isArray(catalog))throw Error("Photo catalog must be an array of garment records");
const photos=new Map(catalog.map(g=>[g.id,g]));
const esc=x=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const imageRef=g=>{
 const src=g?.image||g?.file||"";
 return typeof src==="string"&&(src.startsWith("data:image/")||!src.includes("://")&&!src.startsWith("/")&&!src.includes(".."))?src:"";
};
const missing=new Set;
for(const p of pairs)for(const id of [...p.A.garmentIds,...p.B.garmentIds])
 if(!imageRef(photos.get(id)))missing.add(id);
if(missing.size)throw Error("Missing local photo references for "+[...missing].join(", ")+". No blind visual study created.");
const board=side=>side.garmentIds.map(id=>{
 const g=photos.get(id),src=imageRef(g);
 return '<figure><img src="'+esc(src)+'" alt="'+esc(g?.name||"Prenda")+'"><figcaption>'+esc(g?.name||"Prenda")+'</figcaption></figure>';
}).join("");
const html='<html lang="es"><head><meta charset="utf-8"><title>Evaluación ciega Atelier</title>'+
'<style>body{font:16px system-ui;max-width:1050px;margin:auto;padding:24px;color:#222}section{margin:30px 0;border-top:1px solid #ddd;padding-top:20px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}.items{display:flex;gap:8px;flex-wrap:wrap}figure{width:125px;margin:0}img{width:100%;height:150px;object-fit:contain;background:#f4f4f4}figcaption{font-size:11px}h2{font-size:18px}</style></head><body><h1>Atelier · revisión estética ciega</h1><p>Compara A y B, sin scores ni identificar el motor. Registra A, B, both, neither o insufficient en el JSON.</p>'+
pairs.map(p=>'<section><h2>'+esc(p.id)+' · '+esc(p.context)+'</h2><div class="pair"><div><h3>A</h3><div class="items">'+board(p.A)+'</div></div><div><h3>B</h3><div class="items">'+board(p.B)+'</div></div></div></section>').join("")+'</body></html>';
fs.writeFileSync((out.toLowerCase().endsWith(".json")?out.slice(0,-5):out)+".html",html);
fs.writeFileSync(out,JSON.stringify({instructions:"Revisión ciega: ver composición completa e imágenes de prendas de A y B. Elegir A, B, both, neither o insufficient; separar estética, función y gusto; ningún score automático visible.",options:["A","B","both","neither","insufficient"],pairs},null,2));
fs.writeFileSync(keyPath,JSON.stringify({kind:"PRIVATE_ATELIER_AB_KEY",pairs:answerKey},null,2),{flag:"wx",mode:0o600});
console.log("Prepared "+pairs.length+" blind comparisons and a separate PRIVATE answer key. No human judgment was performed.");

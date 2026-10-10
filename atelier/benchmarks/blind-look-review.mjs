#!/usr/bin/env node
/** Generate independently reviewable, deterministic A/B comparison assignments.
 * Usage: node blind-look-review.mjs old-report.json new-report.json review-pack.json
 * Reports from real-photos/eval.mjs (array of rows with wn/occ/temp/i/ids) or
 * evaluate-outfits.mjs ({looks:[{size,temperature,occasion,garments}]}).
 * Outputs NO assertions of visual quality and NO hidden score in review entries.
 * Reviewers see pairs through their existing local image boards, not photos here.
 */
import fs from "node:fs";
const [before,after,out]=process.argv.slice(2);
if(!before||!after||!out)throw Error("Usage: node blind-look-review.mjs baseline.json candidate.json output.json");
const read=p=>{const v=JSON.parse(fs.readFileSync(p,"utf8"));return Array.isArray(v)?v:v.looks;};
const arr=read(before),brr=read(after);
if(!Array.isArray(arr)||!Array.isArray(brr))throw Error("Expected reports with looks");
const key=r=>[r.wn||r.size||"wardrobe",r.occ||r.occasion,r.temp??r.temperature,r.i??Number(String(r.id||"").split("-").at(-1))].join("|");
const ids=r=>Array.isArray(r.ids)?r.ids:Array.isArray(r.garments)?r.garments.map(x=>x.id):[];
const a=new Map(arr.map(r=>[key(r),r])),b=new Map(brr.map(r=>[key(r),r]));
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const pairs=[];
for(const k of [...a.keys()].sort()){
 if(!b.has(k))continue;
 const left=a.get(k),right=b.get(k),ai=ids(left),bi=ids(right);
 if(!ai.length||!bi.length||ai.join("|")===bi.join("|"))continue;
 const reverse=hash(k)%2===1;
 pairs.push({id:"review-"+String(pairs.length+1).padStart(4,"0"),scenario:k,
  A:{garmentIds:reverse?bi:ai},B:{garmentIds:reverse?ai:bi},
  judgement:null,reason:"",context: k.split("|").slice(1,-1).join(" · ")});
}
fs.writeFileSync(out,JSON.stringify({instructions:"Revisión ciega: ver composición completa e imágenes de prendas de A y B. Elegir A, B, both, neither o insufficient; separar estética, función y gusto; ningún score automático visible.",options:["A","B","both","neither","insufficient"],pairs},null,2));
console.log("Prepared "+pairs.length+" blind comparisons. No visual review was performed.");

// Offline adapter: garment embeddings -> per-outfit compatibility scores for model-compare.mjs.
// Does NOT run or impersonate a pretrained Type-Aware model. Supply embeddings exported by a REAL model.
// Usage: node embeddings-to-pairs.mjs pairs-polyvore.json embeddings.json > predictions.json
// Embeddings JSON: {"id1":{"type":"Arriba","vector":[0.1,0.2,...]},...}
// All vectors must come from the same model and compatible embedding space.
// Cross-type cosine is only a diagnostic baseline; type-specific projection models require
// projection/inference before export and their intended compatibility scoring definition.
import fs from "node:fs";
const [pairsFile,embFile]=process.argv.slice(2);
if(!pairsFile||!embFile){console.error("Usage: node embeddings-to-pairs.mjs <pairs.json> <embeddings.json>");process.exit(2)}
const pairs=JSON.parse(fs.readFileSync(pairsFile,"utf8"));
const emb=JSON.parse(fs.readFileSync(embFile,"utf8"));
if(!Array.isArray(pairs)||!emb||typeof emb!=="object"||Array.isArray(emb))throw Error("Invalid input format");
const cache=new Map();
function item(id){
 if(cache.has(id))return cache.get(id);
 const x=emb[id],v=x?.vector;
 if(typeof x?.type!=="string"||!x.type||!Array.isArray(v)||v.length<2||v.some(z=>!Number.isFinite(z)))throw Error("Missing/invalid vector or type: "+id);
 const magnitude=Math.hypot(...v);
 if(!(magnitude>0))throw Error("Zero embedding: "+id);
 const y={type:x.type,v:v.map(z=>z/magnitude)};
 cache.set(id,y);return y;
}
function score(ids){
 if(!Array.isArray(ids)||ids.length<2)throw Error("Outfit requires at least two items");
 const g=ids.map(item);
 if(new Set(g.map(x=>x.v.length)).size!==1)throw Error("Embedding dimensions differ");
 let sum=0,n=0;
 for(let i=0;i<g.length;i++)for(let j=i+1;j<g.length;j++){
  if(g[i].type===g[j].type)continue;
  let dot=0;for(let k=0;k<g[i].v.length;k++)dot+=g[i].v[k]*g[j].v[k];
  sum+=dot;n++;
 }
 if(!n)throw Error("No cross-type pairs in outfit");
 return sum/n;
}
const out=pairs.map(p=>{
 if(typeof p.id!=="string"||!p.id)throw Error("Pair missing id");
 return {id:p.id,sa:score(p.a),sb:score(p.b)};
});
console.log(JSON.stringify(out,null,2));

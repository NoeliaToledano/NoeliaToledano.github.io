// Reusable local-only index of stable pair evidence; does NOT decide outfit quality.
// Caller injects the Atelier pairEvidence(a,b) function when its contract is ready.
// Context (weather, occasion, preferences and feedback) must NEVER be cached here.
const FIELDS=["category","type","subtype","color","secondaryColor","pattern","fabric","fit","length","sleeve","neckline","thickness","warmth","formality","occasions","season","style","details"];
function fingerprint(item){
 const data=FIELDS.map(field=>item[field]===undefined?null:item[field]);
 return JSON.stringify(data);
}
function key(a,b){return JSON.stringify([a,b].sort());}
export function createRelationCache({profileId,engineVersion,pairEvidence}){
 if(typeof profileId!=="string"||!profileId||typeof engineVersion!=="string"||!engineVersion||typeof pairEvidence!=="function")
  throw Error("profileId, engineVersion and pairEvidence are required");
 const items=new Map(),signatures=new Map(),edges=new Map(),adjacent=new Map();
 let calculated=0, reused=0;
 function erase(id){
  for(const edgeKey of adjacent.get(id)||[]){
   const edge=edges.get(edgeKey);
   if(!edge)continue;
   edges.delete(edgeKey);
   const other=edge.ids.find(x=>x!==id);
   adjacent.get(other)?.delete(edgeKey);
  }
  adjacent.delete(id);
 }
 function reconcile(garments){
  if(!Array.isArray(garments))throw Error("Expected garment array");
  const next=new Map();
  for(const item of garments){
   if(!item||typeof item.id!=="string"||!item.id)throw Error("Invalid garment");
   if(item.deleted||item.archived)continue;
   if(next.has(item.id))throw Error("Duplicate garment ID");
   next.set(item.id,item);
  }
  for(const id of items.keys())if(!next.has(id)){erase(id);items.delete(id);signatures.delete(id)}
  let dirty=0;
  for(const [id,item] of next){
   const sig=fingerprint(item);
   if(signatures.get(id)!==sig){
    erase(id);signatures.set(id,sig);dirty++;
   }
   items.set(id,item);
  }
  return {dirty,garments:items.size,edges:edges.size};
 }
 function evidence(a,b){
  if(a===b)return null;
  if(!items.has(a)||!items.has(b))return null;
  const k=key(a,b);
  if(edges.has(k)){reused++;return edges.get(k).value}
  const ids=[a,b].sort();
  const value=pairEvidence(items.get(ids[0]),items.get(ids[1]));
  // Cache null too: no relation is still a computed result.
  edges.set(k,{ids,value});
  for(const id of ids){if(!adjacent.has(id))adjacent.set(id,new Set());adjacent.get(id).add(k)}
  calculated++;
  return value;
 }
 function neighbors(id,{limit=20,filter=null}={}){
  if(!Number.isInteger(limit)||limit<1)throw Error("Invalid limit");
  if(filter!==null&&typeof filter!=="function")throw Error("Invalid filter");
  if(!items.has(id))return [];
  const out=[];
  for(const other of items.keys()){
   if(id===other)continue;
   const value=evidence(id,other);
   if(value===null||value===undefined||filter&&!filter(value,items.get(other)))continue;
   out.push({garmentId:other,evidence:value});
  }
  return out.slice(0,limit); // Caller supplies context-aware sorting; do not fake ranking.
 }
 return Object.freeze({profileId,engineVersion,reconcile,evidence,neighbors,
  stats:()=>({garments:items.size,edges:edges.size,calculated,reused}),
  clear:()=>{items.clear();signatures.clear();edges.clear();adjacent.clear()}
 });
}

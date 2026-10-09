// Deterministic relation-cache operation counts for realistic wardrobe sizes.
// This is NOT a mobile latency benchmark or stylistic quality measurement.
// node atelier/benchmarks/relation-cache-bench.mjs
import {createRelationCache} from "./relation-cache.mjs";
const output=[];
for(const n of [10,100,500]){
 let calls=0;const items=Array.from({length:n},(_,i)=>({id:"p"+String(i).padStart(4,"0"),category:i%3?"Arriba":"Abajo",color:i%2?"Negro":"Blanco"}));
 const cache=createRelationCache({profileId:"bench",engineVersion:"v1",pairEvidence:(a,b)=>{calls++;return {sameColor:a.color===b.color}}});
 cache.reconcile(items);
 cache.neighbors(items[0].id,{limit:n});
 const initial=calls;
 cache.reconcile(items.map((x,i)=>i===0?{...x,color:"Azul"}:x));
 cache.neighbors(items[0].id,{limit:n});
 const changed=calls-initial;
 if(initial!==n-1||changed!==n-1)throw Error("Unexpected incremental operation count");
 cache.neighbors(items[1].id,{limit:n});
 const afterSecond=calls;
 // A full scan of an untouched garment reuses most cached relations and fills only missing ones.
 output.push({garments:n,firstQuery:initial,editedGarmentRecalculated:changed,afterOtherQuery:afterSecond,fullGraphPairs:n*(n-1)/2});
}
console.log(JSON.stringify({metric:"pair-evidence calls, not timing",results:output},null,2));

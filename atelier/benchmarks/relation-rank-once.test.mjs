import assert from "node:assert/strict";
import {createRelationCache} from "./relation-cache.mjs";

for(const count of [10,100,500]){
 let computed=0,ranked=0;
 const garments=Array.from({length:count},(_,i)=>({id:"g"+String(i).padStart(3,"0"),category:i%2?"Arriba":"Abajo",color:"Azul"}));
 const cache=createRelationCache({profileId:"qa",engineVersion:"v1",pairEvidence:(a,b)=>{computed++;return {ids:[a.id,b.id]}}});
 cache.reconcile(garments);
 const rank=(e,g)=>{ranked++;return Number(g.id.slice(1));};
 const first=cache.neighbors("g000",{limit:3,rank});
 assert.deepEqual(first.map(x=>x.garmentId),garments.slice(-3).reverse().map(x=>x.id));
 assert.equal(ranked,count-1,"Contextual rank must run once per eligible garment");
 assert.equal(computed,count-1,"Pair evidence is calculated once per candidate");
 ranked=0;
 const second=cache.neighbors("g000",{limit:2,rank:(_e,g)=>{ranked++;return -Number(g.id.slice(1))}});
 assert.deepEqual(second.map(x=>x.garmentId),["g001","g002"],"New context reranks instead of reusing stale score");
 assert.equal(ranked,count-1);
 assert.equal(computed,count-1,"Reranking never recomputes stable pair evidence");
 assert.throws(()=>cache.neighbors("g000",{rank:()=>NaN}),/Invalid contextual rank score/);
 assert.throws(()=>cache.neighbors("g000",{rank:()=>Infinity}),/Invalid contextual rank score/);
 assert.throws(()=>cache.neighbors("g000",{rank:()=>"1"}),/Invalid contextual rank score/);
}
console.log("Contextual rank once/finite tests: OK");

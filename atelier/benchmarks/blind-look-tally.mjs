#!/usr/bin/env node
/** Unblind only after independent votes are recorded. Inputs remain local. */
import fs from "node:fs";
const [reviewPath,keyPath]=process.argv.slice(2);
if(!reviewPath||!keyPath)throw Error("Usage: node blind-look-tally.mjs completed-review.json PRIVATE-answers.json");
const review=JSON.parse(fs.readFileSync(reviewPath,"utf8"));
const secret=JSON.parse(fs.readFileSync(keyPath,"utf8"));
if(secret.kind!=="PRIVATE_ATELIER_AB_KEY"||!Array.isArray(secret.pairs)||!Array.isArray(review.pairs))throw Error("Invalid review or answer key");
const lookup=new Map(secret.pairs.map(r=>[r.id,r]));
if(lookup.size!==secret.pairs.length||review.pairs.length!==lookup.size)throw Error("Incomplete or duplicate answer key");
const totals={candidate:0,baseline:0,both:0,neither:0,insufficient:0,unreviewed:0};
const valid=new Set(["A","B","both","neither","insufficient",null]);
const seen=new Set();
for(const p of review.pairs){
 if(seen.has(p.id)||!lookup.has(p.id))throw Error("Mismatched or duplicate review ID: "+p.id);
 seen.add(p.id);
 const allocation=lookup.get(p.id);
 if(!["A","B"].includes(allocation.candidate)||allocation.baseline===allocation.candidate)throw Error("Invalid private allocation");
 if(!valid.has(p.judgement))throw Error("Invalid vote for "+p.id);
 if(p.judgement===null)totals.unreviewed++;
 else if(p.judgement==="A"||p.judgement==="B")totals[allocation.candidate===p.judgement?"candidate":"baseline"]++;
 else totals[p.judgement]++;
}
const decisions=totals.candidate+totals.baseline;
console.log(JSON.stringify({total:review.pairs.length,results:totals,decisive:decisions,candidateWinRate:decisions?totals.candidate/decisions:null,note:"Descriptive preference only. No proof of visual superiority without enough independent, representative judgments."},null,2));

// Offline comparison of Atelier's scoring with an external fashion-compatibility model.
// Inputs:
//   node atelier/benchmarks/real-photos/model-compare.mjs atelier-pairs.json model-predictions.json
// Atelier baseline: node atelier/benchmarks/real-photos/pairs.mjs --json > atelier-pairs.json
// External predictions format: [{"id":"p01","sa":0.72,"sb":0.65}, ...] (higher score is better).
// Scores across models are NOT compared directly; only which of A/B each model prefers.
// Human labels "noelia" are for reporting only and MUST NOT be used for calibration on this bank.
import fs from "node:fs";

const [baselinePath,modelPath]=process.argv.slice(2);
if(!baselinePath||!modelPath){
 console.error("Usage: node model-compare.mjs <pairs.mjs --json output> <external-predictions.json>");
 process.exit(2);
}
function parse(path){
 const x=JSON.parse(fs.readFileSync(path,"utf8"));
 if(!Array.isArray(x))throw Error(path+": expected an array");
 const m=new Map();
 for(const r of x){
  if(!r||typeof r.id!=="string"||!r.id)throw Error(path+": missing pair id");
  if(m.has(r.id))throw Error(path+": duplicate pair id "+r.id);
  if(!Number.isFinite(r.sa)||!Number.isFinite(r.sb))throw Error(path+": non-finite scores for "+r.id);
  m.set(r.id,r);
 }
 return m;
}
const baseline=parse(baselinePath),external=parse(modelPath);
const missing=[...baseline.keys()].filter(id=>!external.has(id));
const extra=[...external.keys()].filter(id=>!baseline.has(id));
if(missing.length||extra.length){
 console.error(JSON.stringify({error:"INCOMPARABLE_COVERAGE",missing,extra},null,2));
 process.exit(2);
}
const pick=r=>r.sa===r.sb?"=":r.sa>r.sb?"a":"b";
const human=x=>["a","b","="].includes(x)?x:null;
const summary=rows=>{
 const labeled=rows.filter(r=>r.human!==null);
 const decisive=labeled.filter(r=>r.human!=="=");
 const ties=labeled.filter(r=>r.human==="=");
 const accurate=(k,xs)=>xs.filter(r=>r[k]===r.human).length;
 return {pairs:rows.length,humanVotes:labeled.length,humanDecisive:decisive.length,humanTies:ties.length,
  exactHumanAgreement:{atelier:accurate("atelier",labeled),external:accurate("external",labeled)},
  decisiveHumanAgreement:{atelier:accurate("atelier",decisive),external:accurate("external",decisive)},
  onHumanTies:{atelierTies:ties.filter(r=>r.atelier==="=").length,externalTies:ties.filter(r=>r.external==="=").length},
  modelDisagreements:rows.filter(r=>r.atelier!==r.external).length
 };
};
const rows=[...baseline.keys()].sort().map(id=>{
 const a=baseline.get(id),b=external.get(id);
 return {id,occasion:a.occasion??null,kind:a.kind??null,hard:!!a.hard,human:human(a.noelia),
  stylist:human(a.better),atelier:pick(a),external:pick(b),
  atelierScore:[a.sa,a.sb],externalScore:[b.sa,b.sb]};
});
const by=(key)=>Object.fromEntries([...new Set(rows.map(r=>String(r[key]??"unknown")))].sort().map(k=>[k,summary(rows.filter(r=>String(r[key]??"unknown")===k))]));
console.log(JSON.stringify({warning:"Observational evaluation only: existing 33 votes informed prior rule changes and are NOT a held-out test.",baseline:baselinePath,model:modelPath,summary:summary(rows),byOccasion:by("occasion"),byKind:by("kind"),byDifficulty:by("hard"),modelDisagreements:rows.filter(r=>r.atelier!==r.external),humanDisagreements:rows.filter(r=>r.human!==null&&(r.atelier!==r.human||r.external!==r.human))},null,2));

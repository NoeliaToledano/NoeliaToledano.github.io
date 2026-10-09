// Compare two real-photos eval.mjs report.json files without images, network or AI.
// Usage: node atelier/benchmarks/real-photos/compare.mjs baseline/report.json candidate/report.json
import fs from "node:fs";
const [aPath,bPath]=process.argv.slice(2);
if(!aPath||!bPath){console.error("Usage: node compare.mjs <baseline/report.json> <candidate/report.json>");process.exit(2)}
const load=p=>{const x=JSON.parse(fs.readFileSync(p,"utf8"));if(!Array.isArray(x))throw Error("Expected array: "+p);return x};
const a=load(aPath),b=load(bPath);
const key=r=>[r.wn,r.occ,r.temp,r.i].join("|");
const map=rows=>{const m=new Map();for(const r of rows){const k=key(r);if(m.has(k))throw Error("Duplicate scenario/rank: "+k);m.set(k,r)}return m};
const A=map(a),B=map(b),keys=[...new Set([...A.keys(),...B.keys()])].sort();
const overlap=(x,y)=>{const s=new Set(x.ids||[]),t=new Set(y.ids||[]);const u=new Set([...s,...t]);return u.size?[...s].filter(z=>t.has(z)).length/u.size:1};
// Some eval.mjs patterns are descriptive counters, not defects (e.g. a handbag being present).
const DESCRIPTIVE_PATTERNS=new Set(["con bolso","con gorra/gorro/boina/sombrero"]);
const flags=r=>[...new Set([...(r.issues||[]),...(r.patterns||[]).filter(p=>!DESCRIPTIVE_PATTERNS.has(p))])];
const signature=r=>(r.ids||[]).slice().sort().join("|");
const metrics=rows=>{const total=rows.length;const problems=rows.filter(r=>flags(r).length),nIssues=rows.reduce((n,r)=>n+flags(r).length,0);
 const perOcc={};for(const r of rows){const k=r.occ||"unknown",v=perOcc[k]??={looks:0,problematic:0,issues:0};v.looks++;v.issues+=flags(r).length;if(flags(r).length)v.problematic++}
 const unique=new Set(rows.flatMap(r=>r.ids||[]));return {looks:total,looksWithIssues:problems.length,issueCount:nIssues,issueRate:total?+(problems.length/total*100).toFixed(2):0,uniqueGarments:unique.size,perOcc}};
const regressions=[],improvements=[],changed=[],missing=[],added=[];
for(const k of keys){const x=A.get(k),y=B.get(k);if(!x){added.push(k);continue}if(!y){missing.push(k);continue}
 const d={scenario:k,oldIssues:flags(x),newIssues:flags(y),oldNames:x.names||[],newNames:y.names||[],jaccard:+overlap(x,y).toFixed(3)};
 const introduced=flags(y).filter(z=>!flags(x).includes(z)),resolved=flags(x).filter(z=>!flags(y).includes(z));
 d.introduced=introduced;d.resolved=resolved;
 if(introduced.length)regressions.push(d);
 if(resolved.length)improvements.push(d);
 if(signature(x)!==signature(y))changed.push(d);
}
const result={baseline:aPath,candidate:bPath,baselineMetrics:metrics(a),candidateMetrics:metrics(b),coverage:{baseline:a.length,candidate:b.length,missingScenarios:missing,addedScenarios:added},comparison:{changedLooks:changed.length,improvements:improvements.length,regressions:regressions.length,meanJaccard:changed.length?+(changed.reduce((n,r)=>n+r.jaccard,0)/changed.length).toFixed(3):null},regressions,improvements};
// A higher score is NOT treated as aesthetic improvement; explicit issues and visual pattern flags are counted.
console.log(JSON.stringify(result,null,2));
if(missing.length||added.length){console.error("INCOMPARABLE: scenario/rank coverage differs");process.exitCode=2}

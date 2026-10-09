// Regression tests for model-compare.mjs. Run: node atelier/benchmarks/real-photos/model-compare.test.mjs
import assert from "node:assert/strict";
import {execFileSync,spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
const root=mkdtempSync(join(tmpdir(),"atelier-model-compare-"));
const cli=new URL("./model-compare.mjs",import.meta.url).pathname;
const file=(name,rows)=>{const p=join(root,name);writeFileSync(p,JSON.stringify(rows));return p};
try{
 const a=file("baseline.json",[
  {id:"p01",sa:8,sb:6,noelia:"a",better:"a",occasion:"work",kind:"formalidad"},
  {id:"p02",sa:3,sb:3,noelia:"=",better:"b",occasion:"daily",kind:"color"},
  {id:"p03",sa:1,sb:2,noelia:"b",better:"b",occasion:"work",kind:"estampados"}
 ]);
 const b=file("candidate.json",[
  {id:"p01",sa:0.1,sb:0.8},
  {id:"p02",sa:0.4,sb:0.4},
  {id:"p03",sa:0.2,sb:0.6}
 ]);
 const r=JSON.parse(execFileSync(process.execPath,[cli,a,b],{encoding:"utf8"}));
 assert.equal(r.summary.pairs,3);
 assert.equal(r.summary.humanVotes,3);
 assert.equal(r.summary.humanTies,1);
 assert.deepEqual(r.summary.exactHumanAgreement,{atelier:3,external:2});
 assert.equal(r.summary.modelDisagreements,1);
 assert.equal(r.byOccasion.work.pairs,2);
 const incomplete=file("incomplete.json",[{id:"p01",sa:1,sb:2}]);
 assert.equal(spawnSync(process.execPath,[cli,a,incomplete]).status,2,"Reject incompatible coverage");
 const duplicate=file("duplicate.json",[{id:"p01",sa:1,sb:2},{id:"p01",sa:2,sb:1}]);
 assert.notEqual(spawnSync(process.execPath,[cli,a,duplicate]).status,0,"Reject duplicate IDs");
 const invalid=file("invalid.json",[{id:"p01",sa:"0.1",sb:1}]);
 assert.notEqual(spawnSync(process.execPath,[cli,a,invalid]).status,0,"Reject nonnumeric scores");
 console.log("model-compare tests: OK");
}finally{rmSync(root,{recursive:true,force:true})}

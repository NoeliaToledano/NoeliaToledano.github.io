// Self-contained adapter smoke test: node atelier/benchmarks/real-photos/embeddings-to-pairs.test.mjs
import assert from "node:assert/strict";
import {execFileSync,spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
const dir=mkdtempSync(join(tmpdir(),"atelier-embeddings-"));
const cli=new URL("./embeddings-to-pairs.mjs",import.meta.url).pathname;
const put=(file,obj)=>{const p=join(dir,file);writeFileSync(p,JSON.stringify(obj));return p};
try{
 const pairs=put("pairs.json",[{id:"p1",a:["top","shoe"],b:["top","bottom"]}]);
 const embeddings=put("vectors.json",{
  top:{type:"Arriba",vector:[1,0]},shoe:{type:"Zapatos",vector:[1,0]},bottom:{type:"Abajo",vector:[0,1]}
 });
 const out=JSON.parse(execFileSync(process.execPath,[cli,pairs,embeddings],{encoding:"utf8"}));
 assert.equal(out.length,1);
 assert.deepEqual(out[0],{id:"p1",sa:1,sb:0});
 const invalid=put("invalid.json",{top:{type:"Arriba",vector:[0,0]},shoe:{type:"Zapatos",vector:[1,0]},bottom:{type:"Abajo",vector:[0,1]}});
 assert.notEqual(spawnSync(process.execPath,[cli,pairs,invalid]).status,0);
 console.log("embeddings-to-pairs tests: OK");
}finally{rmSync(dir,{recursive:true,force:true})}

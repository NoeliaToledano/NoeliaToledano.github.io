import assert from "node:assert/strict";
import {test} from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
const src=fs.readFileSync(new URL("../atelier.js",import.meta.url),"utf8");
const assess=new Function("document","sessionStorage","crypto",src+`
 appState.profile={id:"focus-audit"};appState.data=emptyData();
 const g=(id,category,extra={})=>({id,name:id,type:id,category,color:"Negro",style:"casual",formality:"casual",season:"all",...extra});
 const top=g("top","Arriba",{pattern:"floral",patternContrast:"high",patternPlacement:"allover"});
 const bottom=g("bottom","Abajo",{pattern:"checks",patternContrast:"high",patternPlacement:"allover"});
 const accessory=g("a","Accesorios",{pattern:"animal",patternContrast:"high",patternPlacement:"allover"});
 const ctx=engineContext({occasion:"daily",temp:20,date:"2026-04-15",extras:{shoes:false,bag:false}});
 return {two:scoreOutfit([top,bottom],ctx),three:scoreOutfit([top,bottom,accessory],ctx),
  unknown:scoreOutfit([top,bottom,{...accessory,patternContrast:null,patternPlacement:null}],ctx),
  evidence:visualFocusEvidence([top,bottom,accessory])};
`);
test("visual focus conflict requires a known third strong focal piece",()=>{
 const r=assess({addEventListener(){},querySelector(){return null},querySelectorAll(){return []}},{getItem(){return null},removeItem(){}},{randomUUID:()=>"x"});
 assert.equal(r.evidence.optionalCompetition,true);
 assert.ok(r.three.warnings.some(x=>/complemento compite/.test(x)));
 assert.ok(!r.two.warnings.some(x=>/complemento compite/.test(x)));
 assert.ok(!r.unknown.warnings.some(x=>/complemento compite/.test(x)));
});
test("blind pack includes no score or ground-truth preference",()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),"atelier-ab-"));
 try{
  const x=path.join(folder,"base.json"),y=path.join(folder,"new.json"),z=path.join(folder,"pack.json");
  fs.writeFileSync(x,JSON.stringify([{wn:"P",occ:"daily",temp:20,i:0,ids:["a","b"],score:99}]));
  fs.writeFileSync(y,JSON.stringify([{wn:"P",occ:"daily",temp:20,i:0,ids:["a","c"],score:4}]));
  execFileSync(process.execPath,[new URL("./blind-look-review.mjs",import.meta.url).pathname,x,y,z]);
  const pack=JSON.parse(fs.readFileSync(z,"utf8"));
  assert.equal(pack.pairs.length,1);
  assert.equal(pack.pairs[0].judgement,null);
  assert.ok(!JSON.stringify(pack).includes('"score"'));
  assert.deepEqual([...pack.pairs[0].A.garmentIds,...pack.pairs[0].B.garmentIds].sort(),["a","a","b","c"]);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

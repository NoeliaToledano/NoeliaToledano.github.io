import assert from "node:assert/strict";
import {test} from "node:test";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../atelier.js",import.meta.url),"utf8");
const inspect=new Function("document","sessionStorage","crypto",source+"\nreturn focalCompetition;");
const focal=inspect({addEventListener(){},querySelector(){return null},querySelectorAll(){return []}},{getItem(){return null},removeItem(){}},{randomUUID:()=>"t"});
const garment=(id,category,extra={})=>({id,category,pattern:"floral",...extra});
const loud=category=>garment(category,category,{patternContrast:"high",patternPlacement:"allover"});
test("unknown print characteristics cannot imply competing focal points",()=>{
 const gs=[garment("top","Arriba"),garment("bottom","Abajo"),garment("coat","Capas")];
 assert.equal(focal(gs,{likes:new Set()}).scoreAdjustment,0);
});
test("three dominant allover motifs give only a bounded soft cost",()=>{
 const gs=[loud("Arriba"),loud("Abajo"),loud("Capas")];
 assert.equal(focal(gs,{likes:new Set()}).scoreAdjustment,-3);
 assert.equal(focal(gs,{likes:new Set(["pattern"])}).scoreAdjustment,0);
});
test("small printed accessories never count as three dominant main garments",()=>{
 const gs=[loud("Arriba"),loud("Abajo"),loud("Accesorios")];
 assert.equal(focal(gs,{likes:new Set()}).scoreAdjustment,0);
});
test("localized prints do not equal competing allover prints",()=>{
 const gs=[loud("Arriba"),loud("Abajo"),garment("coat","Capas",{patternContrast:"high",patternPlacement:"localized"})];
 assert.equal(focal(gs,{likes:new Set()}).scoreAdjustment,0);
});

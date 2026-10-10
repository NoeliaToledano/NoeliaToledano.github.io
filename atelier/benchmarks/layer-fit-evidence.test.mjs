import assert from "node:assert/strict";
import {test} from "node:test";
import fs from "node:fs";
const src=fs.readFileSync(new URL("../atelier.js",import.meta.url),"utf8");
const run=new Function("document","sessionStorage","crypto",src+`
appState.profile={id:"layer-evidence"};appState.data=emptyData();
const t={id:"t",category:"Arriba",type:"Jersey",name:"Jersey",color:"Negro",style:"casual",formality:"casual",season:"all",fit:"oversize",thickness:"grueso",sleeve:"larga"};
const b={id:"b",category:"Abajo",type:"Pantalón",name:"Pantalón",color:"Negro",style:"casual",formality:"casual",season:"all"};
const c={id:"c",category:"Capas",type:"Abrigo",name:"Abrigo",color:"Negro",style:"casual",formality:"casual",season:"all",fit:"ajustado",warmth:"alto"};
const ctx=engineContext({occasion:"daily",temp:8,date:"2026-01-15",extras:{shoes:false,bag:false}});
return {tight:scoreOutfit([t,b,c],ctx),roomy:scoreOutfit([t,b,{...c,fit:"holgado"}],ctx),unknown:scoreOutfit([{...t,thickness:null},b,c],ctx)};
`);
test("only evidenced layer crowding triggers warning",()=>{
const r=run({addEventListener(){},querySelector(){return null},querySelectorAll(){return []}},{getItem(){return null},removeItem(){}},{randomUUID:()=>"x"});
assert.ok(r.tight.warnings.some(x=>/capa ajustada/.test(x)));
assert.ok(!r.roomy.warnings.some(x=>/capa ajustada/.test(x)));
assert.ok(!r.unknown.warnings.some(x=>/capa ajustada/.test(x)));
assert.ok(r.tight.score<r.roomy.score);
});

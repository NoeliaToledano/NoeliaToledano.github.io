import assert from "node:assert/strict";
import {generateFormulaCandidates,matchSlot} from "./styling-formulas.mjs";
const items=[
 {id:"c",category:"Capas",style:"smart"},
 {id:"t",category:"Arriba",style:"casual",pattern:"floral"},
 {id:"b",category:"Abajo",style:"casual",pattern:"plain"},
 {id:"s",category:"Zapatos",style:"smart",pattern:"plain"},
 {id:"x",category:"Zapatos",style:"sport",deleted:true},
];
assert.equal(matchSlot(items[1],{category:"Arriba",pattern:"patterned"}),true);
assert.equal(matchSlot(items[2],{category:"Abajo",pattern:"patterned"}),false);
const rows=generateFormulaCandidates(items,{occasion:"daily"});
assert.ok(rows.some(x=>x.formulaId==="relaxed-tailoring"));
assert.ok(rows.some(x=>x.formulaId==="one-pattern-focus"));
assert.ok(rows.every(x=>!x.garmentIds.includes("x")));
assert.ok(rows.every(x=>new Set(x.garmentIds).size===x.garmentIds.length));
assert.deepEqual(generateFormulaCandidates(items,{occasion:"daily",limit:1}).length,1);
assert.deepEqual(generateFormulaCandidates(items,{occasion:"sport"}),[]);
assert.deepEqual(generateFormulaCandidates(items.filter(x=>x.id!=="s"),{occasion:"daily"}),[]);
assert.throws(()=>generateFormulaCandidates(items,{limit:0}));
console.log("styling formula generator: OK");

import assert from "node:assert/strict";
import { test } from "node:test";
import { auditReport } from "./audit-look-report.mjs";

test("accepts both current report formats",()=>{
  assert.equal(auditReport([{ids:["a","b"],occ:"daily",issues:["frío"]}]).count,1);
  assert.equal(auditReport({looks:[{garments:[{id:"d",category:"Vestidos"}],occasion:"party"}]}).flagged,0);
});
test("detects missing and competing cores without inventing gender or taste rules",()=>{
  const report=auditReport({looks:[
    {garments:[{id:"x",category:"Arriba"},{id:"y",category:"Zapatos"}]},
    {garments:[{id:"x",category:"Vestidos"},{id:"y",category:"Abajo"}]},
    {garments:[{id:"x",category:"Arriba"},{id:"y",category:"Abajo"},{id:"z",category:"Zapatos"}]}
  ]});
  assert.deepEqual(report.rows[0].flags,["missing_core"]);
  assert.deepEqual(report.rows[1].flags,["competing_core"]);
  assert.deepEqual(report.rows[2].flags,[]);
});
test("flags optional overload as review, not an aesthetic failure",()=>{
 const row=auditReport({looks:[{garments:[
  {id:"a",category:"Vestidos"},{id:"b",category:"Bolsos"},
  {id:"c",category:"Accesorios"},{id:"d",category:"Accesorios"}
 ]}]}).rows[0];
 assert.ok(row.flags.includes("many_optional_items_review"));
});
test("duplicates and source warnings remain visible",()=>{
 const row=auditReport([{ids:["a","a"],issues:["context"],warnings:["check"]}]).rows[0];
 assert.ok(row.flags.includes("duplicate_garment_id"));
 assert.ok(row.flags.includes("source:context"));
 assert.ok(row.flags.includes("has_engine_warning"));
});
test("rejects malformed reports",()=>assert.throws(()=>auditReport({}),/Expected/));

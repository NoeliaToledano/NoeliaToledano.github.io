#!/usr/bin/env node
/**
 * Audits existing look reports; this is diagnostic, NOT an aesthetic oracle.
 * node atelier/benchmarks/audit-look-report.mjs path/to/report.json [output.json]
 * Accepts arrays from real-photos/eval.mjs or {looks:[...]} from evaluate-outfits.mjs.
 * Does not load photos, profiles or call external services.
 */
import fs from "node:fs";

export function auditReport(input) {
  const looks = Array.isArray(input) ? input : input?.looks;
  if (!Array.isArray(looks)) throw new Error("Expected an array or {looks: array}");
  const rows = [];
  for (const [index, look] of looks.entries()) {
    const garments = Array.isArray(look.garments) ? look.garments : [];
    const ids = Array.isArray(look.ids) ? look.ids : garments.map(g=>g.id).filter(Boolean);
    const cats = garments.map(g=>g.category).filter(Boolean);
    const flags = [];
    const core = cats.filter(x=>x==="Arriba"||x==="Abajo"||x==="Vestidos");
    if (cats.length) {
      if (!(cats.includes("Vestidos") || (cats.includes("Arriba")&&cats.includes("Abajo")))) flags.push("missing_core");
      if (cats.includes("Vestidos") && (cats.includes("Arriba")||cats.includes("Abajo"))) flags.push("competing_core");
      const extras = cats.filter(x=>x==="Bolsos"||x==="Accesorios");
      if (extras.length>2) flags.push("many_optional_items_review");
    }
    if (ids.length!==new Set(ids).size) flags.push("duplicate_garment_id");
    if (Array.isArray(look.flags)) flags.push(...look.flags.map(x=>"source:"+x));
    if (Array.isArray(look.issues)) flags.push(...look.issues.map(x=>"source:"+x));
    if (Array.isArray(look.warnings) && look.warnings.length) flags.push("has_engine_warning");
    const occasion=look.occasion??look.occ??"unspecified";
    const temp=look.temperature??look.temp??null;
    rows.push({index,id:look.id??null,wardrobe:look.wn??look.size??null,occasion,temperature:temp,garmentCount:ids.length||garments.length,coreCount:core.length,optionalCount:cats.filter(x=>x==="Bolsos"||x==="Accesorios").length,flags:[...new Set(flags)]});
  }
  const byOccasion={};
  for (const row of rows) {
    const item=byOccasion[row.occasion]??={count:0,flagged:0,flags:{}};
    item.count++;
    if(row.flags.length)item.flagged++;
    for(const f of row.flags)item.flags[f]=(item.flags[f]??0)+1;
  }
  const flagged=rows.filter(r=>r.flags.length);
  return {schemaVersion:1,disclaimer:"Structural diagnostics only: requires blind human evaluation for aesthetics and context; no gender assumptions.",count:rows.length,flagged:flagged.length,byOccasion,rows};
}

if (process.argv[1] && import.meta.url===new URL("file://"+process.argv[1]).href) {
  const [source,dest]=process.argv.slice(2);
  if(!source){console.error("Usage: node atelier/benchmarks/audit-look-report.mjs input.json [output.json]");process.exitCode=2;}
  else {
    const result=auditReport(JSON.parse(fs.readFileSync(source,"utf8")));
    const out=JSON.stringify(result,null,2);
    if(dest)fs.writeFileSync(dest,out+"\n");
    else console.log(out);
    console.error(`Audited ${result.count} looks; ${result.flagged} require structural review. Human styling review remains necessary.`);
  }
}

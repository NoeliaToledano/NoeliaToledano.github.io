// Offline formula coverage: node atelier/benchmarks/styling-formulas-coverage.mjs
// Reports candidate counts only. These are NOT human quality or outfit-fit scores.
import fs from "node:fs";
import {generateFormulaCandidates,FORMULAS} from "./styling-formulas.mjs";
const source=new URL("./real-photos/labels-polyvore.json",import.meta.url);
const items=JSON.parse(fs.readFileSync(source,"utf8"));
const summary={source:"labels-polyvore.json",garments:items.length,method:"metadata coverage, not image evaluation",results:[]};
for(const occasion of ["daily","work","party"]){
 for(const formula of FORMULAS.filter(f=>f.occasion.includes(occasion))){
  const candidates=generateFormulaCandidates(items,{occasion,formulas:[formula],limit:100});
  summary.results.push({occasion,formula:formula.id,candidatesUpTo100:candidates.length,hasCandidates:candidates.length>0});
 }
}
console.log(JSON.stringify(summary,null,2));

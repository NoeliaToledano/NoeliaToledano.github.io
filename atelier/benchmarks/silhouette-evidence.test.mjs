import assert from "node:assert/strict";
import {test} from "node:test";
import fs from "node:fs";

const src=fs.readFileSync(new URL("../atelier.js",import.meta.url),"utf8");
const run=new Function("document","sessionStorage","crypto",src+`
 appState.profile={id:"silhouette-audit"};
 appState.data=emptyData();
 const g=(id,category,fit)=>({id,name:id,category,type:category==="Arriba"?"Camiseta":"Pantalón",color:"Negro",pattern:"plain",season:"all",style:"casual",formality:"casual",fit,sleeve:"larga",thickness:"medio"});
 const ctx=engineContext({occasion:"daily",temp:20,date:"2026-04-15",extras:{shoes:false,bag:false}});
 const score=(a,b)=>scoreOutfit([g("t","Arriba",a),g("b","Abajo",b)],ctx).score;
 return {loose:score("oversize","holgado"),fitted:score("entallado","ajustado"),regular:score("regular","recto"),mixed:score("oversize","entallado"),unknown:score(null,null)};
`);
test("same-volume outfits are not categorically rejected",()=>{
 const scores=run({addEventListener(){},querySelector(){return null},querySelectorAll(){return []}},{getItem(){return null},removeItem(){}},{randomUUID:()=> "test"});
 assert.ok(Number.isFinite(scores.loose)&&Number.isFinite(scores.fitted));
 assert.ok(scores.loose>=scores.regular-2,`Loose silhouettes must remain plausible: ${JSON.stringify(scores)}`);
 assert.ok(scores.fitted>=scores.regular-2,`Fitted silhouettes must remain plausible: ${JSON.stringify(scores)}`);
 assert.ok(scores.mixed>=scores.loose-2);
 assert.ok(Number.isFinite(scores.unknown));
});

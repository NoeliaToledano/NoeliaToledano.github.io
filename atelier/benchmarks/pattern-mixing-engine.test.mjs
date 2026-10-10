import assert from "node:assert/strict";
import {test} from "node:test";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../atelier.js",import.meta.url),"utf8");
const evaluate=new Function("document","sessionStorage","crypto",source+`
appState.profile={id:"stylist-test"};appState.data=emptyData();
return {patternPairEvidence,pairColor,colorInfo,colorsMatch,pairs,isPatterned,contextualizePair,lookIssues,ensureRelations,pairEvidence};
`);
const E=evaluate({addEventListener(){},querySelector(){return null},querySelectorAll(){return []}},{getItem(){return null},removeItem(){}},{randomUUID:()=>"stylist-test"});
const upper=(id,pattern,color,extra={})=>({id,category:"Arriba",name:"Prenda",pattern,color,season:"all",style:"casual",formality:"casual",...extra});
const lower=(id,pattern,color,extra={})=>({...upper(id,pattern,color,extra),category:"Abajo"});

test("mixed prints are not globally forbidden",()=>{
 const a=upper("a","stripes","Azul"),b=lower("b","floral","Rojo");
 assert.equal(E.colorsMatch(E.colorInfo(a.color,a.pattern),E.colorInfo(b.color,b.pattern)),true);
 assert.equal(E.pairs(a,b),true);
});
test("shared palette, localized detail and different scales provide bounded evidence, not certainty",()=>{
 const a=upper("a","stripes","Azul",{materialAttributes:{patternScale:"small",patternContrast:"low",patternPlacement:"allover"}});
 const b=lower("b","floral","Azul",{materialAttributes:{patternScale:"large",patternContrast:"medium",patternPlacement:"localized"}});
 const v=E.patternPairEvidence(a,b);
 assert.ok(v.s>=.7 && v.s<=.8);
 assert.equal(v.uncertain,false);
});
test("strong competing prints are not auto-approved",()=>{
 const a=upper("a","floral","Rojo",{materialAttributes:{patternScale:"large",patternContrast:"high",patternPlacement:"allover"}});
 const b=lower("b","checks","Azul",{materialAttributes:{patternScale:"large",patternContrast:"high",patternPlacement:"allover"}});
 assert.ok(E.pairColor(a,b).s<.5);
});
test("missing pattern characteristics stay explicitly uncertain",()=>{
 const a=upper("a","floral","Rojo"),b=lower("b","stripes","Azul");
 assert.equal(E.patternPairEvidence(a,b).uncertain,true);
 assert.ok(E.pairColor(a,b).s<.7);
});
test("unknown pattern does not become its own pattern type",()=>{
 assert.notEqual(E.colorInfo("Azul","unknown").fam,"estampado");
 assert.equal(E.isPatterned({pattern:"unknown",name:"Prenda lisa",color:"Azul"}),false);
});
test("tailored print with denim is not automatically forced below weak threshold",()=>{
 E.ensureRelations();
 const ev={ids:["a","b"],color:.9,colorKind:"",style:.9,formalGap:0,seasonClash:false,thermalClash:false,textureClash:true,occasions:["daily"],declared:[]};
 const score=E.contextualizePair(ev,{occasion:"daily",likes:new Set()}).s;
 assert.ok(score>.45);
});
test("printed accessory is not a categorical outfit violation",()=>{
 const gs=[upper("a","floral","Rojo"),lower("b","plain","Negro"),{id:"c",category:"Accesorios",name:"Pañuelo",pattern:"stripes",color:"Rojo",style:"casual",formality:"casual"}];
 const issues=E.lookIssues(gs,{temp:20,occasion:"daily",likes:new Set()});
 assert.ok(!issues.some(x=>x.includes("Complemento estampado con otra")));
});

test("unknown motif scale does not certify a strong relationship",()=>{
 const a=upper("ua","stripes","Azul"),b=lower("ub","floral","Azul");
 E.ensureRelations();
 const ev=E.pairEvidence(a,b);
 assert.equal(ev.patternUncertain,true);
 assert.ok(E.contextualizePair(ev,{occasion:"daily",likes:new Set()}).s<.6);
});

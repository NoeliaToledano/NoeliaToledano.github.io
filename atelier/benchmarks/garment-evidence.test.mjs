import assert from "node:assert/strict";
import {test} from "node:test";
import fs from "node:fs";
import {garmentEvidence,evidenceNeedsReview} from "./garment-evidence.mjs";

test("unknown pattern never becomes plain",()=>{
 const e=garmentEvidence({id:"a",fabric:"denim"});
 assert.equal(e.pattern.known,false);
 assert.equal(e.pattern.plain,false);
 assert.ok(e.metadataWarnings.includes("pattern_unknown_not_plain"));
});
test("explicit plain denim remains plain without assuming wash",()=>{
 const e=garmentEvidence({id:"a",fabric:"denim",pattern:"plain"});
 assert.equal(e.pattern.plain,true);
 assert.equal(e.wash.known,false);
});
test("floral embroidery and denim wash remain separate dimensions",()=>{
 const e=garmentEvidence({id:"a",fabric:"denim",pattern:"floral",materialAttributes:{wash:"acid",decoration:["embroidery"]}});
 assert.deepEqual(e.pattern.motifs,["floral"]);
 assert.equal(e.wash.value,"acid");
 assert.deepEqual(e.decoration.value,["embroidery"]);
});
test("multiple motifs are retained independently",()=>{
 const e=garmentEvidence({pattern:"stripes",materialAttributes:{patterns:["floral","stripes"]}});
 assert.deepEqual(e.pattern.motifs,["floral","stripes"]);
 assert.equal(e.pattern.plain,false);
});
test("fiber differs from satin weave or knit structure",()=>{
 const e=garmentEvidence({fabric:"satin",composition:"100% silk",materialAttributes:{fiber:"silk",construction:"woven"}});
 assert.equal(e.fiber.value,"silk");
 assert.equal(e.textile.value,"satin");
 assert.equal(e.construction.value,"woven");
 assert.ok(e.metadataWarnings.includes("satin_is_not_a_fiber"));
});
test("no confidence fabricated when advanced fields absent",()=>{
 const e=garmentEvidence({pattern:"checks"});
 assert.equal(e.drape.known,false);
 assert.equal(e.fiber.source,"unknown");
});
test("legacy unknown garment needs review, confirmed fields do not",()=>{
 assert.equal(evidenceNeedsReview(garmentEvidence({})),true);
 assert.equal(evidenceNeedsReview(garmentEvidence({fabric:"cotton",pattern:"plain"})),false);
});
test("no personal or body attributes are required",()=>{
 const e=garmentEvidence({id:"unisex",pattern:"animal",fabric:"knit"});
 assert.equal(e.garmentId,"unisex");
 assert.equal(Object.hasOwn(e,"gender"),false);
});

test("unknown fabric sentinel is not known textile",()=>{
 const e=garmentEvidence({fabric:"unknown",pattern:"plain"});
 assert.equal(e.textile.known,false);
 assert.equal(evidenceNeedsReview(e),true);
});
test("advanced pattern retains its source",()=>{
 const e=garmentEvidence({materialAttributes:{patterns:["floral"],patternsSource:"user"}});
 assert.equal(e.pattern.source,"user");
});

test("unknown pattern sentinel is missing evidence",()=>{
 const e=garmentEvidence({fabric:"cotton",pattern:"unknown"});
 assert.equal(e.pattern.known,false);
 assert.equal(e.pattern.motifs.length,0);
 assert.equal(evidenceNeedsReview(e),true);
});

test("denim wash from normal garment metadata is kept distinct from print",()=>{
 const e=garmentEvidence({id:"jeans",fabric:"denim",pattern:"plain",denimWash:"acid"});
 assert.equal(e.pattern.plain,true);
 assert.equal(e.wash.value,"acid");
 assert.equal(e.wash.known,true);
});
test("denim wash remains unknown when absent",()=>{
 const e=garmentEvidence({fabric:"denim",pattern:"floral"});
 assert.equal(e.wash.known,false);
 assert.deepEqual(e.pattern.motifs,["floral"]);
});

test("blank advanced wash does not steal legacy wash provenance",()=>{
 const e=garmentEvidence({denimWash:"acid",materialAttributes:{wash:"  ",washSource:"user"}});
 assert.equal(e.wash.value,"acid");
 assert.equal(e.wash.source,"legacy");
});

test("the normal Atelier photo-analysis validator accepts known denim washes only",()=>{
 const src=fs.readFileSync(new URL("../atelier.js",import.meta.url),"utf8");
 const clean=new Function("document","sessionStorage","crypto",src+"\nreturn cleanAnalysis;")(
   {addEventListener(){},querySelector(){return null},querySelectorAll(){return []}},
   {getItem(){return null},removeItem(){}},
   {randomUUID:()=> "audit"}
 );
 assert.equal(clean({fabric:"denim",denimWash:"acid",pattern:"plain"}).denimWash,"acid");
 assert.equal(clean({fabric:"denim",denimWash:"invented"}).denimWash,undefined);
});

test("visual drape and sheen are independent from fiber",()=>{
 const e=garmentEvidence({fabric:"satin",drape:"fluid",surfaceSheen:"shiny"});
 assert.equal(e.drape.value,"fluid");
 assert.equal(e.surfaceSheen.value,"shiny");
 assert.equal(e.fiber.known,false);
});
test("advanced drape provenance is not inherited by a fallback",()=>{
 const e=garmentEvidence({drape:"structured",materialAttributes:{drape:" ",drapeSource:"user"}});
 assert.equal(e.drape.value,"structured");
 assert.equal(e.drape.source,"legacy");
});
test("AI validator only accepts known visual drape and sheen values",()=>{
 const src=fs.readFileSync(new URL("../atelier.js",import.meta.url),"utf8");
 const clean=new Function("document","sessionStorage","crypto",src+"\nreturn cleanAnalysis;")(
  {addEventListener(){},querySelector(){return null},querySelectorAll(){return []}},
  {getItem(){return null},removeItem(){}},{randomUUID:()=> "audit"});
 assert.equal(clean({drape:"fluid",surfaceSheen:"shiny"}).drape,"fluid");
 assert.equal(clean({drape:"heavy",surfaceSheen:"glitter"}).surfaceSheen,undefined);
});

import assert from "node:assert/strict";
import {test} from "node:test";
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

test("explicit unknown pattern stays unknown",()=>{
 const e=garmentEvidence({fabric:"cotton",pattern:"unknown"});
 assert.equal(e.pattern.known,false);
 assert.deepEqual(e.pattern.motifs,[]);
 assert.equal(evidenceNeedsReview(e),true);
});

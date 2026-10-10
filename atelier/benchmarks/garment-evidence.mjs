/**
 * Experimental evidence contract, NOT a recommendation score or production migration.
 * Preserves legacy values and distinguishes unknown from confirmed plain.
 * No images, personal data, network calls or AI inference.
 */
const KNOWN = new Set(["user","label","ai","legacy","unknown"]);
const finiteString = x => typeof x === "string" && x.trim() ? x.trim() : null;
const unique = xs => [...new Set(xs.filter(Boolean))];
const value = (v, source) => ({value:v??null,source:v==null?"unknown":KNOWN.has(source)?source:"legacy",known:v!=null});
export function garmentEvidence(garment={}) {
  const g=garment&&typeof garment==="object"?garment:{};
  const fabric=finiteString(g.fabric);
  const pattern=finiteString(g.pattern);
  const composition=finiteString(g.composition);
  const advanced=g.materialAttributes&&typeof g.materialAttributes==="object"?g.materialAttributes:{};
  const extraPatterns=Array.isArray(advanced.patterns)?advanced.patterns.map(finiteString):[];
  const motifs=unique([...extraPatterns,pattern&&pattern!=="plain"?pattern:null]);
  const patternKnown=pattern==="plain"||motifs.length>0;
  const explicitlyPlain=pattern==="plain"&&motifs.length===0;
  return {
    garmentId:finiteString(g.id),
    fiber:value(finiteString(advanced.fiber)??null,advanced.fiberSource),
    textile:value(finiteString(advanced.textile)??fabric,advanced.textileSource),
    construction:value(finiteString(advanced.construction),advanced.constructionSource),
    composition:value(composition,"user"),
    pattern:{motifs,known:patternKnown,plain:explicitlyPlain,source:patternKnown?"legacy":"unknown"},
    wash:value(finiteString(advanced.wash),advanced.washSource),
    decoration:value(Array.isArray(advanced.decoration)?unique(advanced.decoration.map(finiteString)):null,advanced.decorationSource),
    drape:value(finiteString(advanced.drape),advanced.drapeSource),
    metadataWarnings:[
      ...(fabric==="satin"?["satin_is_not_a_fiber"]:[]),
      ...(fabric==="knit"?["knit_is_not_a_fiber"]:[]),
      ...(!patternKnown?["pattern_unknown_not_plain"]:[])
    ]
  };
}
export function evidenceNeedsReview(evidence) {
  return evidence.pattern.known===false || evidence.textile.known===false;
}

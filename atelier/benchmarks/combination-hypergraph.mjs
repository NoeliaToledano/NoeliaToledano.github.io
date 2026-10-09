// Experimental outfit-hypergraph: a look has its own identity beyond pair edges.
// Pair compatibilities and global compatibility are separate signals.
// No AI calls. Scores are provisional and MUST be reranked by the Atelier engine.
import {scorePair,updateCompatibilityGraph} from "./compatibility-graph.mjs";
const ORDER=["Capas","Arriba","Vestidos","Abajo","Zapatos","Bolsos","Accesorios"];
const pairs=ids=>ids.flatMap((a,i)=>ids.slice(i+1).map(b=>[a,b]));
const role=(g)=>g.category;
const style=(g)=>String(g.style||"").toLowerCase();
const norm=(g,k)=>String(g[k]||"").trim().toLowerCase();
export function evaluateCombination(garments,{occasion="daily",graph=null}={}){
 if(!Array.isArray(garments)||garments.length<2||garments.length>8)throw Error("Expected 2–8 garments");
 if(garments.some(g=>!g||!g.id||g.deleted||g.archived)||new Set(garments.map(g=>g.id)).size!==garments.length)throw Error("Invalid or duplicate garments");
 const categories=garments.map(role);
 if(categories.filter(x=>x==="Arriba").length>1||categories.filter(x=>x==="Abajo").length>1||categories.filter(x=>x==="Vestidos").length>1||
    (categories.includes("Vestidos")&&(categories.includes("Arriba")||categories.includes("Abajo"))))
  return {valid:false,reason:"incompatible structural roles",garmentIds:garments.map(g=>g.id)};
 const byId=new Map(garments.map(g=>[g.id,g]));
 const edges=[],missing=[];
 for(const [a,b] of pairs(garments.map(g=>g.id))){
  let edge=graph?.edges?.[[a,b].sort().join("::")]||scorePair(byId.get(a),byId.get(b));
  if(edge)edges.push(edge);else missing.push([a,b]);
 }
 if(!edges.length)return {valid:false,reason:"no compatible pair relations",garmentIds:[...byId.keys()]};
 // Pair average alone misses a global clash (3 prints, 4 colors, inconsistent dress code).
 const scores=edges.map(e=>e.score),pairAverage=scores.reduce((a,b)=>a+b,0)/scores.length;
 const patterned=garments.filter(g=>{const p=norm(g,"pattern");return p&&p!=="plain"&&p!=="unknown"});
 const distinctColors=new Set(garments.map(g=>norm(g,"color")).filter(Boolean));
 const styles=garments.map(style).filter(Boolean),casual=styles.filter(s=>s==="casual"||s==="sport").length,formal=styles.filter(s=>s==="smart"||s==="party").length;
 const problems=[];
 let globalPenalty=0;
 if(patterned.length>=3){globalPenalty+=.18;problems.push("tres o más estampados: revisar armonía global")}
 if(distinctColors.size>=4){globalPenalty+=.1;problems.push("paleta de cuatro o más colores")}
 if(styles.includes("sport")&&styles.includes("party")){globalPenalty+=.12;problems.push("estéticas deportivas y de fiesta mezcladas")}
 const score=Math.max(0,Math.min(1,Math.round((pairAverage-globalPenalty)*1000)/1000));
 const aesthetic=formal>casual?"arreglado":casual>formal?"casual":"mixto";
 const contexts=aesthetic==="arreglado"?["work","party"]:aesthetic==="casual"?["daily","casual"]:["daily","work"];
 return {valid:true,garmentIds:garments.map(g=>g.id),pairAverage:Number(pairAverage.toFixed(3)),score,
  aesthetic,contexts,requestedOccasion:occasion,occasionCompatible:contexts.includes(occasion),
  problems,inspectedPairs:edges.length,unscoredPairs:missing,metadataVersion:"hypergraph-v1",
  provisional:true};
}
export function expandCombination(garments,candidate,opts={}){
 const baseline=evaluateCombination(garments,opts);
 const expanded=evaluateCombination([...garments,candidate],opts);
 if(!expanded.valid)return {accepted:false,baseline,expanded,reason:expanded.reason};
 // Adding an item must make sense as a full outfit, not merely pair well with one item.
 // We accept a small decline because more pieces create more constraints.
 return {accepted:expanded.score>=baseline.score-.05&&expanded.problems.length<=baseline.problems.length,
   baseline,expanded};
}
export function buildCombinationGraph(garments,{maxGroups=100}={}){
 if(!Number.isInteger(maxGroups)||maxGroups<1)throw Error("Invalid maximum groups");
 const graph=updateCompatibilityGraph(garments);
 const list=garments.filter(g=>g&&!g.deleted&&!g.archived).sort((a,b)=>a.id.localeCompare(b.id));
 const combinations=[],seen=new Set();
 for(const g of list){
  const targets=list.filter(other=>other.id!==g.id&&scorePair(g,other)).sort((a,b)=>a.id.localeCompare(b.id));
  for(const second of targets){
   if(combinations.length>=maxGroups)break;
   const ids=[g.id,second.id].sort(),key=ids.join("|");
   if(seen.has(key))continue;
   seen.add(key);
   const group=evaluateCombination([g,second],{graph});
   if(group.valid)combinations.push(group);
  }
  if(combinations.length>=maxGroups)break;
 }
 return {graph,combinations,method:"hypergraph-v1",note:"Pair & group estimates only; final context/climate validation required"};
}

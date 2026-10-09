// Offline prototype of a per-profile wardrobe compatibility graph.
// Scores are explainable heuristic estimates, NOT neural scores or proof of style.
// A pair relationship is NOT a mandate to include both garments in a look.
const UPPER=["Arriba","Vestidos"], LOWER=["Abajo"], SHOES=["Zapatos"], LAYERS=["Capas"];
const BASE=new Set(["Negro","Blanco","Gris","Beige","Crema","Marrón","Azul marino","Denim"]);
const MIX=new Set(["Rojo:Verde","Azul:Naranja","Amarillo:Morado"]);
const norm=x=>String(x||"").trim().toLowerCase();
const keyPair=(a,b)=>[a,b].sort().join("::");
function signature(g){
 return JSON.stringify(["id","category","type","color","pattern","style","formality","fabric","season","silhouette","warmth","deleted","archived"].map(k=>g[k]??null));
}
export function compatibleRoles(a,b){
 const x=a.category,y=b.category;
 if(x===y)return false; // different garment types do not imply simultaneous use.
 const is=(p,q)=>(p.includes(x)&&q.includes(y))||(p.includes(y)&&q.includes(x));
 return is(UPPER,LOWER)||is(UPPER,SHOES)||is(LOWER,SHOES)||
   is(LAYERS,UPPER)||is(LAYERS,LOWER)||is(LAYERS,SHOES)||
   (x==="Vestidos"&&(y==="Bolsos"||y==="Accesorios"))||
   (y==="Vestidos"&&(x==="Bolsos"||x==="Accesorios"))||
   (x==="Bolsos"&&y!=="Bolsos")||(y==="Bolsos"&&x!=="Bolsos")||
   (x==="Accesorios"&&y!=="Accesorios")||(y==="Accesorios"&&x!=="Accesorios");
}
export function scorePair(a,b){
 if(!a||!b||!a.id||!b.id||a.id===b.id||a.deleted||b.deleted||a.archived||b.archived||!compatibleRoles(a,b))
  return null;
 let score=0.6;
 const reasons=[],unknown=[];
 const ca=norm(a.color),cb=norm(b.color);
 if(ca&&cb){
  const neutral=x=>["negro","blanco","gris","beige","crema","marrón","marron","azul marino","denim"].includes(x);
  if(ca===cb){score+=.07;reasons.push("paleta monocromática")}
  else if(neutral(ca)||neutral(cb)){score+=.11;reasons.push("base cromática neutra")}
  else if(MIX.has([ca,cb].sort().join(":"))){score+=.03;reasons.push("contraste cromático")}
  // Other colour combinations are not automatically bad.
 }else unknown.push("color");
 const pa=norm(a.pattern),pb=norm(b.pattern);
 if(pa&&pb&&pa!=="unknown"&&pb!=="unknown"){
  if(pa!=="plain"&&pb!=="plain"){score-=.15;reasons.push("dos estampados: revisar visualmente")}
  else if(pa!=="plain"||pb!=="plain"){score+=.06;reasons.push("estampado equilibrado con liso")}
 }else unknown.push("estampado");
 if(a.style&&b.style){
  if(norm(a.style)===norm(b.style)){score+=.08;reasons.push("estética coherente")}
  else if((norm(a.style)==="sport"&&norm(b.style)==="party")||(norm(b.style)==="sport"&&norm(a.style)==="party")){
   score-=.12;reasons.push("contraste de formalidad pronunciado");
  }
 }else unknown.push("estilo");
 if(a.season&&b.season&&a.season!=="all"&&b.season!=="all"&&a.season!==b.season){
  if((a.season==="cold"&&b.season==="warm")||(a.season==="warm"&&b.season==="cold")){
   score-=.12;reasons.push("estaciones discordantes");
  }
 }
 return {a:a.id,b:b.id,score:Math.max(0,Math.min(1,Math.round(score*1000)/1000)),reasons,unknown,
   method:"metadata-v1",kind:"pair-estimate"};
}
export function updateCompatibilityGraph(garments,previous=null){
 if(!Array.isArray(garments))throw Error("garments must be an array");
 const active=garments.filter(x=>x&&typeof x.id==="string"&&x.id&&!x.deleted&&!x.archived);
 if(new Set(active.map(x=>x.id)).size!==active.length)throw Error("duplicate garment IDs");
 active.sort((a,b)=>a.id.localeCompare(b.id));
 const signatures=Object.fromEntries(active.map(x=>[x.id,signature(x)]));
 const old=previous?.method==="metadata-v1"?previous:null;
 const edges={};let reused=0,computed=0;
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
  const a=active[i],b=active[j],id=keyPair(a.id,b.id);
  if(old?.signatures?.[a.id]===signatures[a.id]&&old?.signatures?.[b.id]===signatures[b.id]&&old.edges?.[id]){
   edges[id]=old.edges[id];reused++;continue;
  }
  const result=scorePair(a,b);
  if(result){edges[id]=result;computed++}
 }
 return {method:"metadata-v1",signatures,edges,stats:{garments:active.length,relations:Object.keys(edges).length,reused,computed}};
}
export function neighbors(graph,id,{minScore=0,limit=20}={}){
 if(!graph?.edges||!Number.isFinite(minScore)||!Number.isInteger(limit)||limit<1)throw Error("invalid query");
 return Object.values(graph.edges).filter(e=>(e.a===id||e.b===id)&&e.score>=minScore)
  .map(e=>({garmentId:e.a===id?e.b:e.a,score:e.score,reasons:e.reasons,unknown:e.unknown}))
  .sort((a,b)=>b.score-a.score||a.garmentId.localeCompare(b.garmentId)).slice(0,limit);
}
// A small candidate can be only a top and a bottom: do not force 10 garments
// into a look. A separate full-outfit ranker must still check climate/context.
export function minimalLooks(garments,graph,{limit=20,minScore=.5}={}){
 if(!Number.isInteger(limit)||limit<1)throw Error("invalid limit");
 const byId=new Map(garments.map(g=>[g.id,g]));
 return Object.values(graph.edges).filter(e=>e.score>=minScore&&
   ((byId.get(e.a)?.category==="Arriba"&&byId.get(e.b)?.category==="Abajo")||
    (byId.get(e.b)?.category==="Arriba"&&byId.get(e.a)?.category==="Abajo")))
   .sort((a,b)=>b.score-a.score||a.a.localeCompare(b.a)||a.b.localeCompare(b.b))
   .slice(0,limit).map(e=>({garmentIds:[e.a,e.b],score:e.score,provisional:true}));
}

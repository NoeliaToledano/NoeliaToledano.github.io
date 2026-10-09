// Offline styling inspiration templates. No scraping, model calls or copyrighted images.
// This module deliberately produces CANDIDATES: the main Atelier engine remains the
// authority for climate, occasion, hard restrictions, profile taste and final ranking.
export const FORMULAS=[
 {id:"relaxed-tailoring",name:"Sastrería relajada",occasion:["daily","work"],slots:[
  {category:"Capas",style:["smart"]},{category:"Arriba",style:["smart","casual"]},
  {category:"Abajo",style:["smart","casual"]},{category:"Zapatos",style:["smart","casual"]}]},
 {id:"casual-layering",name:"Capas casuales",occasion:["daily"],slots:[
  {category:"Capas",style:["casual","smart"]},{category:"Arriba",style:["casual"]},
  {category:"Abajo",style:["casual"]},{category:"Zapatos",style:["casual","sport"]}]},
 {id:"dress-with-structure",name:"Vestido y estructura",occasion:["daily","work","party"],slots:[
  {category:"Vestidos"},{category:"Capas",style:["smart"]},{category:"Zapatos",style:["smart","party"]}]},
 {id:"one-pattern-focus",name:"Estampado protagonista",occasion:["daily","work"],slots:[
  {category:"Arriba",pattern:"patterned"},{category:"Abajo",pattern:"plain"},
  {category:"Zapatos",pattern:"plain"}]},
 {id:"sport-everyday",name:"Deportivo cotidiano",occasion:["daily"],slots:[
  {category:"Arriba",style:["casual","sport"]},{category:"Abajo",style:["casual","sport"]},
  {category:"Zapatos",style:["sport"]}]}
];
const isPatterned=g=>Boolean(g.pattern&&g.pattern!=="plain"&&g.pattern!=="unknown");
export function matchSlot(item,slot){
 if(!item||item.category!==slot.category)return false;
 if(slot.style&&(!item.style||!slot.style.includes(item.style)))return false;
 if(slot.pattern==="plain"&&item.pattern!=="plain")return false; // unknown pattern is not evidence of a plain garment
 if(slot.pattern==="patterned"&&!isPatterned(item))return false;
 return true;
}
export function generateFormulaCandidates(garments,{occasion="daily",formulas=FORMULAS,limit=30}={}){
 if(!Array.isArray(garments)||!Array.isArray(formulas)||!Number.isInteger(limit)||limit<1)throw Error("Invalid inputs");
 const results=[],seen=new Set();
 const pool=garments.filter(g=>g&&typeof g.id==="string"&&g.id&&!g.deleted&&!g.archived);
 // Round-robin across formulas. Previously the first formula exhausted the
 // global limit and prevented all subsequent styles from appearing.
 const iterators=[];
 for(const formula of formulas){
  if(!formula||!Array.isArray(formula.slots)||!formula.slots.length||!formula.occasion?.includes(occasion))continue;
  const options=formula.slots.map(slot=>pool.filter(g=>matchSlot(g,slot)).sort((a,b)=>a.id.localeCompare(b.id)));
  if(options.some(x=>!x.length))continue;
  function* combinations(i=0,ids=[]){
   if(i===options.length){yield [...ids];return}
   for(const item of options[i]){
    if(ids.includes(item.id))continue;
    ids.push(item.id);
    yield* combinations(i+1,ids);
    ids.pop();
   }
  }
  iterators.push({formula,iter:combinations()});
 }
 while(results.length<limit&&iterators.length){
  for(let i=0;i<iterators.length&&results.length<limit;){
   const {formula,iter}=iterators[i];
   const next=iter.next();
   if(next.done){iterators.splice(i,1);continue}
   const ids=next.value,key=[...ids].sort().join("|");
   if(!seen.has(key)){
    seen.add(key);
    results.push({formulaId:formula.id,formulaName:formula.name,garmentIds:ids});
   }
   i++;
  }
 }
 return results;
}

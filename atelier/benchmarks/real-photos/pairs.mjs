// Comparaciones A/B (#128): ¿el motor prefiere el mismo look que una estilista? Sin fotos, sin red y sin IA.
//   node atelier/benchmarks/real-photos/pairs.mjs [pairs-polyvore.json] [labels-polyvore.json] [--json]
// Cada par tiene dos looks completos (a, b), la ocasión, la temperatura, el mejor («better») y el motivo.
// «hard»: los dos looks cumplen las reglas básicas y la diferencia es estética o de contexto.
// Limitación: las etiquetas son de un solo juez (Claude); para validarlas hace falta la votación a ciegas de #128.
import fs from "node:fs";
const HERE=new URL(".",import.meta.url).pathname,args=process.argv.slice(2).filter(a=>!a.startsWith("--"));
const PAIRS=JSON.parse(fs.readFileSync(HERE+(args[0]||"pairs-polyvore.json"))),L=JSON.parse(fs.readFileSync(HERE+(args[1]||"labels-polyvore.json")));
const src=fs.readFileSync(new URL("../../atelier.js",import.meta.url),"utf8");
const node={classList:{add(){},remove(){},toggle(){}},replaceChildren(){},setAttribute(){},value:"",textContent:""};
const app=new Function("document","sessionStorage","crypto",src+";return {appState,normalizeData,engineContext,scoreOutfit,occasionFits,thermalOk,heavyKnitInHeat,weatherCompatible,bootInHeat,isPatterned,BIG,outdoorPack,hasSkirtOrDress,lookComplete,HEADWEAR,headwearMakesSense,summerFootwear};")(
 {addEventListener(){},querySelector:()=>node,querySelectorAll:()=>[]},{getItem(){return null},removeItem(){}},{randomUUID:()=>"x"});
const G=new Map(L.map(g=>[g.id,{...g,image:"",updatedAt:"x",createdAt:"2026-10-01"}]));
app.appState.profile={id:"bench",name:"Bench"};app.appState.data=app.normalizeData({garments:[...G.values()]});
/* Restricciones que aplica rankOutfits al generar (no la puntuación): si el look peor las incumple, el motor nunca lo propondría */
const violations=(gs,ctx)=>{const v=[],a=app;
 for(const g of gs){if(!a.occasionFits(g,ctx.occasion))v.push("ocasión: "+g.type);if(!a.thermalOk(g,ctx.temp)||a.heavyKnitInHeat(g,ctx.temp))v.push("calor/frío: "+g.type);
  if(!a.weatherCompatible(g,gs.filter(x=>x!==g),ctx))v.push("tiempo: "+g.type);if(a.bootInHeat(g,ctx.temp)&&ctx.allShoes.some(z=>!a.bootInHeat(z,ctx.temp)))v.push("botas con calor");
  if(a.HEADWEAR.test([g.type,g.subtype,g.name].filter(Boolean).join(" "))&&g.category==="Accesorios"&&!a.headwearMakesSense(g,ctx))v.push("sombrero sin motivo");
  if(a.outdoorPack(g)&&a.hasSkirtOrDress(gs))v.push("mochila de montaña con vestido o falda")}
 if(gs.filter(g=>a.isPatterned(g)&&!a.BIG.includes(g.category)).length&&gs.filter(a.isPatterned).length>=2)v.push("complemento estampado con estampado");
 if(!a.lookComplete(gs))v.push("incompleto");return v};
const rows=[];
for(const p of PAIRS){
 const ctx=app.engineContext({occasion:p.occasion,temp:p.temp,date:p.temp<12?"2026-01-15":p.temp<22?"2026-04-15":"2026-07-15",extras:{shoes:true,bag:true}});ctx.allShoes=[...G.values()].filter(g=>g.category==="Zapatos");
 const look=ids=>ids.map(id=>{const g=G.get(id);if(!g)throw Error(p.id+": falta "+id);return g});
 const sa=app.scoreOutfit(look(p.a),ctx).score,sb=app.scoreOutfit(look(p.b),ctx).score;
 const pick=sa===sb?"=":sa>sb?"a":"b",worse=p.better==="a"?"b":"a",va=violations(look(p.a),ctx),vb=violations(look(p.b),ctx);
 const vWorse=worse==="a"?va:vb,vBetter=worse==="a"?vb:va;
 rows.push({...p,sa,sb,pick,va,vb,okScore:pick===p.better,okRules:vWorse.length>0&&!vBetter.length,ok:pick===p.better||vWorse.length>0&&!vBetter.length,legal:!va.length&&!vb.length});
}
const pct=(xs)=>xs.length?Math.round(100*xs.filter(r=>r.ok).length/xs.length)+"% ("+xs.filter(r=>r.ok).length+"/"+xs.length+")":"—";
if(process.argv.includes("--json")){console.log(JSON.stringify(rows,null,1));process.exit(0)}
const pctK=(xs,k)=>xs.length?Math.round(100*xs.filter(r=>r[k]).length/xs.length)+"% ("+xs.filter(r=>r[k]).length+"/"+xs.length+")":"—";
console.log("Acierto del motor (restricciones o puntuación):",pct(rows),"· difíciles:",pct(rows.filter(r=>r.hard)));
console.log("  Restricciones: el look peor se descarta al generar:",pctK(rows,"okRules"));
console.log("  Puntuación: prefiere el mejor:",pctK(rows,"okScore"),"· en pares donde los dos cumplen las restricciones:",pctK(rows.filter(r=>r.legal),"okScore"),"· empates:",rows.filter(r=>r.pick==="=").length);
const by=k=>{const m={};for(const r of rows)(m[r[k]]??=[]).push(r);return Object.entries(m).map(([x,v])=>x+" "+pct(v)).join(" · ")};
console.log("Por ocasión:",by("occasion"));console.log("Por tipo:",by("kind"));
for(const r of rows.filter(r=>!r.ok))console.log("  ✗",r.id,r.occasion,r.temp+" °C","a="+r.sa,"b="+r.sb,"mejor="+r.better,"—",r.why);
for(const r of rows.filter(r=>r.ok&&!r.okScore))console.log("  · solo por restricción:",r.id,"("+(r.better==="a"?r.vb:r.va).join(", ")+") — la puntuación no lo ve: a="+r.sa,"b="+r.sb);
for(const r of rows.filter(r=>(r.better==="a"?r.va:r.vb).length))console.log("  ! el mejor incumple una restricción:",r.id,(r.better==="a"?r.va:r.vb).join(", "));

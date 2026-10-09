// Benchmark reproducible de Atelier (#45): node atelier/bench.mjs [chromium|webkit] [20,100,300,500]
// Necesita el servidor local (python3 -m http.server 8000) como las pruebas. No usa IA ni datos reales:
// armario sintético determinista con fotos generadas (JPEG 900 px). Mide la mediana de 5 repeticiones.
import { chromium, webkit } from "playwright";
const engine=process.argv[2]==="webkit"?webkit:chromium,sizes=(process.argv[3]||"20,100,300,500").split(",").map(Number);
const browser=await engine.launch(engine===chromium?{channel:"chrome"}:{});
const median=a=>{const s=[...a].sort((x,y)=>x-y);return Math.round(s[Math.floor(s.length/2)]*10)/10};
const rows=[];
for(const n of sizes){
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.route("https://atelier-ai-backend-pi.vercel.app/**",route=>{
  const headers={"access-control-allow-origin":"http://127.0.0.1:8000","access-control-allow-headers":"Content-Type, Authorization","access-control-allow-methods":"GET, POST, PUT, OPTIONS","content-type":"application/json"};
  if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  const u=route.request().url();
  if(u.endsWith("/api/session"))return route.fulfill({status:200,headers,body:JSON.stringify({authenticated:true,profileId:"noelia"})});
  return route.fulfill({status:503,headers,body:JSON.stringify({error:"sin servidor en el benchmark"})}); // sync desactivada: solo local
 });
 await page.goto("http://127.0.0.1:8000/atelier/");
 // Armario sintético determinista, guardado en IndexedDB como lo haría la app
 await page.evaluate(async n=>{
  localStorage.setItem("atelier-session",JSON.stringify({profile:"noelia",token:"bench"}));
  const COLORS=[["Negro","#222"],["Blanco","#eee"],["Gris","#888"],["Beige","#d8c3a0"],["Azul","#2a4d9b"],["Vaquero","#4a6fa5"],["Rojo","#b33"],["Verde","#3a6"],["Rosa","#e9a"],["Marrón","#6b4a2b"]];
  const CATS=[["Arriba",.3],["Abajo",.2],["Vestidos",.08],["Capas",.12],["Zapatos",.15],["Bolsos",.08],["Accesorios",.07]],STY=["casual","casual","smart","sport","party"];
  const photos=[];for(let i=0;i<40;i++){const c=document.createElement("canvas");c.width=900;c.height=1125;const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,900,1125);
   x.fillStyle=COLORS[i%10][1];x.fillRect(150+i%5*10,150,600,800);for(let k=0;k<4000;k++){x.fillStyle=`rgba(${k*7%255},${k*13%255},${k*3%255},.25)`;x.fillRect((k*37+i*11)%900,(k*53+i*7)%1125,3,3)}photos.push(c.toDataURL("image/jpeg",.8))}
  appState.profile={id:"noelia",name:"Noelia"};const d=emptyData();let k=0;
  for(const [cat,f] of CATS)for(let i=0;i<Math.max(2,Math.round(n*f));i++){k++;const [color]=COLORS[k%10];
   d.garments.push({id:"g"+k,name:cat+" "+color.toLowerCase()+" "+k,category:cat,color,style:STY[k%5],season:["all","all","warm","cold"][k%4],pattern:k%9===0?"stripes":"plain",
    warmth:cat==="Capas"?["bajo","medio","alto"][k%3]:undefined,image:photos[k%40],bgWhite:true,photoFx:1,createdAt:"2026-0"+(1+k%9)+"-15",updatedAt:"2026-09-01T00:00:00Z"})}
  const ids=c=>d.garments.filter(g=>g.category===c).map(g=>g.id),A=ids("Arriba"),B=ids("Abajo"),Z=ids("Zapatos");
  for(let i=0;i<Math.round(n/5);i++)d.looks.push({id:"l"+i,name:"Look "+i,garmentIds:[A[i%A.length],B[(i*3)%B.length],Z[(i*7)%Z.length]],occasion:"daily",updatedAt:"2026-09-01T00:00:00Z"});
  for(let i=0;i<n;i++)d.wearLog.push({id:"w"+i,date:shiftDay(-(i%120)-1),garmentIds:[A[i%A.length],B[i%B.length]],updatedAt:"2026-09-01T00:00:00Z"});
  appState.data=d;await saveState({fromSync:true});
 },n);
 const r={n,errors};
 // Arranque: recarga hasta ver «Tu look de hoy»
 const boot=[];for(let i=0;i<5;i++){await page.reload();await page.locator(".daily-look").waitFor({timeout:60000});boot.push(await page.evaluate(()=>performance.now()))}
 r.arranque=median(boot);
 r.medidas=await page.evaluate(async()=>{
  const t=async(fn,reps=5)=>{const a=[];for(let i=0;i<reps;i++){const s=performance.now();await fn();a.push(performance.now()-s)}a.sort((x,y)=>x-y);return Math.round(a[Math.floor(a.length/2)]*10)/10};
  const out={};
  out.hoy=await t(()=>{setView("today")});
  out.otroLook=await t(()=>{ensureDailyLook(true);render()});
  out.armario=await t(()=>{setView("wardrobe")});
  out.htmlArmarioKB=Math.round($("#content").innerHTML.length/1024);
  out.buscar=await t(()=>{ui.search="negro";render();ui.search=""});
  out.ficha=await t(()=>{openGarment(myGarments()[0].id);closeGarment()});
  out.motor=await t(()=>{rankOutfits({max:3})});
  out.misLooks=await t(()=>{setView("looks")});
  out.htmlLooksKB=Math.round($("#content").innerHTML.length/1024);
  out.guardar=await t(()=>mutate(()=>{const g=myGarments()[0];g.favorite=!g.favorite;g.updatedAt=new Date().toISOString()}));
  out.estadoKB=Math.round(JSON.stringify(slimData(appState.data)).length/1024);
  out.fotosMB=Math.round(myGarments().reduce((s,g)=>s+(g.image||"").length,0)/1048576*10)/10;
  out.memoriaMB=performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null;
  return out;
 });
 rows.push(r);await context.close();
}
await browser.close();
const cols=["arranque","hoy","otroLook","armario","htmlArmarioKB","buscar","ficha","motor","misLooks","htmlLooksKB","guardar","estadoKB","fotosMB","memoriaMB"];
console.log("| Prendas | "+cols.join(" | ")+" | Errores |\n|"+" --- |".repeat(cols.length+2));
for(const r of rows)console.log("| "+r.n+" | "+cols.map(c=>c==="arranque"?r.arranque:r.medidas[c]).join(" | ")+" | "+r.errors.length+" |");

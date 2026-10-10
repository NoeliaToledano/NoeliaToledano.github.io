// Comprobación rápida antes de publicar Atelier: node atelier/validate.mjs
// Falla si falta un archivo, una pantalla o una función clave (por ejemplo, tras reescribir un archivo entero).
import fs from "node:fs";
import {execFileSync} from "node:child_process";
const read=f=>fs.readFileSync(new URL("./"+f,import.meta.url),"utf8");
const html=read("index.html"),js=read("atelier.js"),css=read("atelier.css"),sw=read("sw.js");
const fail=m=>{throw new Error(m)};

// Página: un solo script y una sola hoja de estilos, y los elementos que usa la app
for(const x of ["atelier.css","atelier.js","https://api.open-meteo.com",'data-view="today"','data-view="wardrobe"','data-view="stylist"','data-view="trips"','data-view="shopping"','id="garmentPreview"','id="auth"','id="app"','id="garmentForm"','id="lookForm"','id="toast"'])
 if(!html.includes(x))fail("index.html: falta "+x);
for(const old of ["app-v2.js","features-v3.js","features-v4.js","styles-v2.css","styles-v4.css"])
 if(html.includes(old))fail("index.html: sigue cargando el archivo antiguo "+old+"; todo el código está en atelier.js");

// Código: funciones y piezas que no deben desaparecer
const mustJs=[
 "/api/login","/api/session","/api/analyze","/api/looks","/api/sync","/api/sync-image","indexedDB.open","state:",
 'localStorage.setItem("atelier-session"',"function saveState","function loadState","imgKey","function lookCard","function garmentCard",
 "function evaluateCandidate","function shoppingSuggestions","function looksAround","function fetchTodayTemperature",
 "AI_LIMITS","DEFAULT_TEMPERATURE=25","toLong","function promptWear","function syncNow","function mergeData","function tomb","function suggestPacking","function renderTrips","function whiteBackground","function outfitBoard","function garmentMask","function enhancePhoto","function retouchOnly","function isCatalogPhoto","function tasteProfile","function swapOptions","function renderWeek","function planWorn","function rankOutfits","function scoreOutfit","function ensureDailyLook"
];
for(const x of mustJs)if(!js.includes(x))fail("atelier.js: falta "+x);
if(js.includes("sessionStorage.setItem"))fail("La sesión debe guardarse en localStorage, no en sessionStorage");
// Sin capas de parches: no se redefinen funciones con "x=function" sobre otra versión anterior
const patched=[...js.matchAll(/^\s*(\w+)\s*=\s*(?:async\s+)?function\b/gm)].map(m=>m[1]);
if(patched.length)fail("atelier.js: no redefinas funciones con «"+patched[0]+"=function»; edita la función original");
for(const x of ["document.write(","document.open(","__ATELIER_B64","payload.js","fflate"])if(html.includes(x)||js.includes(x))fail("Código heredado prohibido: "+x);
if(css.length<5000)fail("atelier.css es demasiado pequeño");
new Function(js);new Function(sw);
for(const asset of ["./atelier.css","./atelier.js","./manifest.json"])if(!sw.includes(asset))fail("sw.js: falta en la caché "+asset);
// Backend: cada función debe cargar sin errores de sintaxis (las pruebas de navegador simulan el backend y no lo detectan)
const api=new URL("../atelier-api/",import.meta.url);
for(const f of ["_lib/auth.js","_lib/store.js",...fs.readdirSync(new URL("api/",api)).filter(f=>f.endsWith(".js")).map(f=>"api/"+f)]){
 try{execFileSync(process.execPath,["--check",new URL(f,api).pathname],{stdio:"pipe"})}catch(e){fail("atelier-api/"+f+": error de sintaxis\n"+String(e.stderr||e.message).split("\n").slice(0,4).join("\n"))}
}
// Regression checks for the offline external-model integration.
for(const test of ["benchmarks/real-photos/model-compare.test.mjs","benchmarks/real-photos/embeddings-to-pairs.test.mjs"]){
 try{execFileSync(process.execPath,[new URL("./"+test,import.meta.url).pathname],{stdio:"pipe"});}
 catch(e){fail(test+": benchmark regression\n"+String(e.stderr||e.message).split("\n").slice(0,8).join("\n"));}
}
try{execFileSync(process.execPath,[new URL("./benchmarks/styling-formulas.test.mjs",import.meta.url).pathname],{stdio:"pipe"});}
catch(e){fail("Styling formulas regression: "+String(e.stderr||e.message));}
try{execFileSync(process.execPath,[new URL("./benchmarks/relation-cache.test.mjs",import.meta.url).pathname],{stdio:"pipe"});}
catch(e){fail("Incremental relation cache regression: "+String(e.stderr||e.message));}
try{execFileSync(process.execPath,[new URL("./benchmarks/relation-rank-once.test.mjs",import.meta.url).pathname],{stdio:"pipe"});}
catch(e){fail("Contextual rank-once regression: "+String(e.stderr||e.message));}
for(const test of ["benchmarks/garment-evidence.test.mjs","benchmarks/audit-look-report.test.mjs"]){
 try{execFileSync(process.execPath,["--test",new URL("./"+test,import.meta.url).pathname],{stdio:"pipe"});}
 catch(e){fail(test+": stylist audit regression\n"+String(e.stderr||e.message));}
}
try{execFileSync(process.execPath,["--test",new URL("./benchmarks/pattern-mixing-engine.test.mjs",import.meta.url).pathname],{stdio:"pipe"});}
catch(e){fail("Pattern-mixing engine regression: "+String(e.stderr||e.message));}
console.log("Atelier release gate OK (app y backend)");

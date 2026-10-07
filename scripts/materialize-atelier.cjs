const fs=require("fs"),zlib=require("zlib"),vm=require("vm");
const root=process.cwd();
const index=fs.readFileSync(root+"/atelier/index.html","utf8");
const payload=fs.readFileSync(root+"/atelier/payload.js","utf8");
const start=index.indexOf("async function atelierLoadApp(){");
const stop=index.indexOf("function atelierInstallPreparedApp(){",start);
if(start<0||stop<0)throw new Error("atelierLoadApp source not found");
const loader=index.slice(start,stop);
const sandbox={
  window:{},console,TextDecoder,Uint8Array,Blob,Response,DecompressionStream,
  atob:s=>Buffer.from(s,"base64").toString("binary"),
  fflate:{gunzipSync:b=>new Uint8Array(zlib.gunzipSync(Buffer.from(b)))},
  document:{getElementById:()=>null},
  localStorage:{setItem:()=>{}},
  performance:{now:()=>0},
  setTimeout,clearTimeout
};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(payload,sandbox,{filename:"payload.js"});
vm.runInContext(loader+";window.__materialize=atelierLoadApp;",sandbox,{filename:"loader.js"});
(async()=>{
 await sandbox.__materialize();
 const html=sandbox.__atelierPreparedHtml;
 if(!html||html.length<10000)throw new Error("Generated HTML invalid");
 if(!html.includes("ATELIER_API_BASE"))throw new Error("Auth patch missing");
 if(!html.includes("profileStateKey(activeProfileId)"))throw new Error("Profile storage patch missing");
 fs.writeFileSync(root+"/atelier/app-static.html",html);
 console.log("Materialized",html.length,"chars");
})().catch(e=>{console.error(e);process.exit(1)});
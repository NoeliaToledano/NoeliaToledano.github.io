const fs=require("fs"),zlib=require("zlib");
const payload=fs.readFileSync("atelier/payload.js","utf8");
const m=payload.match(/__ATELIER_B64\s*=\s*"([^"]+)"/);
if(!m)throw new Error("Atelier payload not found");
let html=zlib.gunzipSync(Buffer.from(m[1],"base64")).toString("utf8");
const loader=fs.readFileSync("atelier/index.html","utf8");
const start=loader.indexOf("    const gateHtml=");
const end=loader.indexOf("    // Remove the temporary preloader before replacing the document.");
if(start<0||end<0||end<=start)throw new Error("Atelier transform block not found");
const block=loader.slice(start,end);
html=new Function("html",block+"\nreturn html;")(html);
const boot=`
<script>
if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(()=>{})}
window.addEventListener("DOMContentLoaded",function(){
 try{
  if(typeof renderProfileChoices==="function")renderProfileChoices();
  if(typeof showProfileGate==="function")showProfileGate();
 }catch(e){console.error("Atelier boot",e)}
});
<\/script>
`;
html=html.replace("</body>",boot+"</body>");
fs.writeFileSync("atelier/app.html",html);
console.log("Materialized Atelier:",html.length,"bytes");

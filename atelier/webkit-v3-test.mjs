import {webkit,devices} from "playwright";
import assert from "node:assert/strict";

const browser=await webkit.launch({headless:true});
const context=await browser.newContext({...devices["iPhone 13"],acceptDownloads:true});
const page=await context.newPage(),errors=[];
page.on("pageerror",e=>errors.push(e.message));
page.on("console",m=>{if(m.type()==="error")console.log("WEBKIT_CONSOLE",m.text())});
await page.addInitScript(()=>{
 const actual=window.fetch.bind(window);
 window.__atelierAudit={badAuth:false,serviceUnavailable:false};
 window.fetch=async(input,options={})=>{
  const path=typeof input==="string"?input:input?.url||"";
  if(!path.startsWith("https://atelier-ai-backend-pi.vercel.app/api/"))return actual(input,options);
  const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json"}});
  if(path.endsWith("/api/login")){
   const body=JSON.parse(options.body||"{}");
   return respond({profileId:body.profileId,token:"local-test-token"});
  }
  if(path.endsWith("/api/session")){
   const data=JSON.parse(localStorage.getItem("atelier-session")||"{}");
   return respond({authenticated:true,profileId:data.profile});
  }
  if(path.endsWith("/api/analyze"))return respond({garment:{name:"Foto analizada",type:"top",color:"Azul"}});
  if(path.endsWith("/api/looks")){
   if(window.__atelierAudit.badAuth)return respond({error:"Sesión caducada"},401);
   if(window.__atelierAudit.serviceUnavailable)return respond({error:"Unavailable"},503);
   const items=JSON.parse(options.body||"{}").items||[];
   return respond({looks:[{ids:items.slice(0,2).map(v=>v.i),why:"Combinación de prueba"}]});
  }
  return respond({error:"Unexpected test API"},404);
 };
});
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pVYAAAAASUVORK5CYII=","base64");
async function addGarment(name){
 await page.locator("#addGarment").click();
 await page.locator("#autoAnalyze").uncheck();
 await page.locator("#garmentName").fill(name);
 await page.locator("#garmentCategory").selectOption("Arriba");
 await page.locator("#garmentImage").setInputFiles({name:"prenda.png",mimeType:"image/png",buffer:png});
 await page.locator("#garmentPreview").waitFor({state:"visible"});
 await page.locator('#garmentForm button[type="submit"]').click();
 await page.getByText(name,{exact:true}).first().waitFor();
}
try{
 await page.goto("http://127.0.0.1:8000/atelier/",{waitUntil:"networkidle"});
 await page.getByRole("button",{name:"Noelia"}).click();
 await page.locator("#password").fill("test");
 await page.locator("#loginBtn").click();
 await page.getByRole("heading",{name:"Mi armario"}).waitFor({timeout:10000});
 await addGarment("Camiseta WebKit");
 await page.reload({waitUntil:"networkidle"});
 await page.getByText("Camiseta WebKit",{exact:true}).first().waitFor();
 await addGarment("Chaqueta WebKit");
 await page.locator('[data-view="stylist"]').click();
 await page.locator("#openLooks").click();
 await page.locator("#aiLooks").click();
 await page.getByText("Combinación de prueba",{exact:true}).waitFor();
 await page.locator('[data-view="shopping"]').click();
 await page.locator('[name="wishName"]').fill("Zapatos de prueba");
 await page.locator('#wishlistForm button[type="submit"]').click();
 await page.getByText("Zapatos de prueba").waitFor();
 await page.locator('[data-view="settings"]').click();
 const downloadPromise=page.waitForEvent("download");
 await page.locator("#exportBackup").click();
 const download=await downloadPromise;
 assert.ok(download.suggestedFilename().startsWith("atelier-noelia"));
 const backupPath=await download.path();
 assert.ok(backupPath,"Backup download path missing");
 await page.locator("#importBackup").setInputFiles(backupPath);
 page.once("dialog",d=>d.accept());
 await page.getByText("Copia restaurada").waitFor();
 await page.locator("#logout").click();
 assert.equal(await page.getByText("Camiseta WebKit").count(),0,"Logout leaked wardrobe");
 await page.getByRole("button",{name:"Irene"}).click();
 await page.locator("#password").fill("test");
 await page.locator("#loginBtn").click();
 await page.getByRole("heading",{name:"Mi armario"}).waitFor();
 assert.equal(await page.getByText("Camiseta WebKit").count(),0,"Cross-profile leak");
 assert.equal(await page.getByText("No hay prendas con estos filtros").count(),1);
 assert.deepEqual(errors,[]);
 console.log("PASS WebKit v3: login, photo import, saved wardrobe, AI looks mock, wishlist, backup export/import, logout and profile isolation");
}finally{await browser.close()}

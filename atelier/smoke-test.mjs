import { chromium, webkit, devices } from "playwright";
import assert from "node:assert/strict";
const useWebKit=process.env.ATELIER_BROWSER==="webkit";
const browser=await (useWebKit?webkit:chromium).launch(useWebKit?{headless:true}:{headless:true,channel:"chrome"});
const context=await browser.newContext({...devices["iPhone 13"],browserName:undefined});
const page=await context.newPage();
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
page.on("console",m=>{if(m.type()==="error")console.log("BROWSER_CONSOLE",m.text())});
page.on("requestfailed",r=>console.log("FAILED_REQUEST",r.url(),r.failure()?.errorText));
await page.addInitScript(() => {
 const realFetch=window.fetch.bind(window);
 window.fetch=async (input,init={})=>{
  const url=typeof input==="string"?input:input?.url||"";
  if(url.startsWith("https://atelier-ai-backend-pi.vercel.app/api/")){
   const suffix=new URL(url).pathname;
   if(suffix==="/api/login"){const data=JSON.parse(init.body||"{}");return new Response(JSON.stringify({profileId:data.profileId,token:"test-token"}),{status:200,headers:{"Content-Type":"application/json"}})}
   if(suffix==="/api/session"){const stored=JSON.parse(sessionStorage.getItem("atelier-session")||"{}");return new Response(JSON.stringify({authenticated:true,profileId:stored.profile}),{status:200,headers:{"Content-Type":"application/json"}})}
   return new Response(JSON.stringify({error:"Mock AI unavailable"}),{status:500,headers:{"Content-Type":"application/json"}});
  }
  return realFetch(input,init);
 };
});
await page.route("https://atelier-ai-backend-pi.vercel.app/**",async route=>{
 const req=route.request(),url=req.url(),origin="http://127.0.0.1:8000";
 const headers={"access-control-allow-origin":origin,"access-control-allow-headers":"Content-Type, Authorization","access-control-allow-methods":"GET, POST, OPTIONS","content-type":"application/json"};
 console.log("MOCK",req.method(),url);if(req.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
 if(url.endsWith("/api/login")){const body=JSON.parse(req.postData()||"{}");return route.fulfill({status:200,headers,body:JSON.stringify({profileId:body.profileId,token:"test-token"})})}
 if(url.endsWith("/api/session"))return route.fulfill({status:200,headers,body:JSON.stringify({authenticated:true,profileId:currentProfile})});
 return route.fulfill({status:500,headers,body:JSON.stringify({error:"Mock AI unavailable"})});
});
let currentProfile="noelia";
try{
 await page.goto("http://127.0.0.1:8000/atelier/",{waitUntil:"networkidle"});
 await page.getByRole("button",{name:"Noelia"}).click();
 await page.locator("#password").fill("test");
 await page.locator("#loginBtn").click();
 await page.getByRole("heading",{name:"Mi armario"}).waitFor({timeout:6000}).catch(async e=>{console.log("LOGIN_DIAGNOSTIC",{error:await page.locator("#authError").textContent(),authVisible:await page.locator("#auth").isVisible(),appVisible:await page.locator("#app").isVisible(),browserErrors:errors});throw e});
 assert.equal(await page.locator("#app").isVisible(),true);
 assert.equal(await page.locator("#auth").isVisible(),false);
 const bg=await page.locator("body").evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.notEqual(bg,"rgba(0, 0, 0, 0)","CSS not applied");
 await page.locator("#addGarment").click();
 await page.locator("#garmentName").fill("Prenda auditada");
 await page.locator("#garmentCategory").selectOption("Arriba");
 await page.locator("#garmentForm button[type=submit]").click();
 await page.getByText("Prenda auditada").waitFor();
 await page.reload({waitUntil:"networkidle"});
 await page.getByText("Prenda auditada").waitFor();
 await page.locator('[data-view="looks"]').click();
 await page.locator("#newLook").click();
 await page.locator("#lookName").fill("Look auditado");
 await page.locator('#lookGarments input[type="checkbox"]').first().check();
 await page.locator("#lookForm button[type=submit]").click();
 await page.getByText("Look auditado").waitFor();
 await page.locator('[data-view="settings"]').click();
 await page.locator("#logout").click();
 currentProfile="irene";
 await page.getByRole("button",{name:"Irene"}).click();
 await page.locator("#password").fill("test");
 await page.locator("#loginBtn").click();
 await page.getByRole("heading",{name:"Mi armario"}).waitFor();
 assert.equal(await page.getByText("Prenda auditada").count(),0,"Profile isolation broken");
 assert.equal(await page.getByText("Tu armario está vacío").count(),1);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:"atelier-smoke.png",fullPage:true});
 console.log("PASS: "+(useWebKit?"WebKit":"Chrome")+" iPhone viewport, styles, login, wardrobe CRUD, IndexedDB persistence, looks and profile isolation");
}finally{await browser.close()}

import { chromium, devices } from "playwright";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,channel:"chrome"});
const context=await browser.newContext({...devices["iPhone 13"],browserName:undefined});
const page=await context.newPage();
const errors=[];
let forceUnauthorized=false,forceServerError=false;
page.on("pageerror",e=>{errors.push(e.message);console.log("PAGEERROR_STACK",e.stack)});
page.on("console",m=>{if(m.type()==="error")console.log("BROWSER_CONSOLE",m.text())});
page.on("requestfailed",r=>console.log("FAILED_REQUEST",r.url(),r.failure()?.errorText));
await page.route("https://atelier-ai-backend-pi.vercel.app/**",async route=>{
 const req=route.request(),url=req.url(),origin="http://127.0.0.1:8000";
 const headers={"access-control-allow-origin":origin,"access-control-allow-headers":"Content-Type, Authorization","access-control-allow-methods":"GET, POST, OPTIONS","content-type":"application/json"};
 console.log("MOCK",req.method(),url);if(req.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
 if(url.endsWith("/api/login")){const body=JSON.parse(req.postData()||"{}");return route.fulfill({status:200,headers,body:JSON.stringify({profileId:body.profileId,token:"test-token"})})}
 if(url.endsWith("/api/session"))return route.fulfill({status:200,headers,body:JSON.stringify({authenticated:true,profileId:currentProfile})});
 if(url.endsWith("/api/analyze"))return route.fulfill({status:200,headers,body:JSON.stringify({garment:{name:"Camisa reconocida por IA",type:"top",color:"Azul",fabric:"cotton",pattern:"stripes",fit:"regular",sleeve:"larga",subtype:"camisa",confidence:"media",details:"botones frontales",occasions:["daily","work"]}})});
 if(url.endsWith("/api/looks")&&forceUnauthorized){forceUnauthorized=false;return route.fulfill({status:401,headers,body:JSON.stringify({error:"Sesión caducada"})})}
 if(url.endsWith("/api/looks")&&forceServerError){forceServerError=false;return route.fulfill({status:503,headers,body:JSON.stringify({error:"Servicio no disponible"})})}
 if(url.endsWith("/api/looks")){const items=JSON.parse(req.postData()||"{}").items||[];const top=items.find(x=>x.c==="Arriba"),bottom=items.find(x=>x.c==="Abajo"),ids=top&&bottom?[top.i,bottom.i]:items.slice(0,2).map(x=>x.i);return route.fulfill({status:200,headers,body:JSON.stringify({looks:[{ids,why:"Look de prueba IA"}]})})}
 return route.fulfill({status:500,headers,body:JSON.stringify({error:"Mock AI unavailable"})});
});
let currentProfile="noelia";
try{
 await page.goto("http://127.0.0.1:8000/atelier/",{waitUntil:"networkidle"});
 // «Volver a perfiles» quita la selección sin errores y se puede volver a elegir
 await page.getByRole("button",{name:"Noelia"}).click();
 await page.locator("#backToProfiles").click();
 assert.equal(await page.locator("#passwordStep").isVisible(),false);
 assert.equal(await page.locator(".profile-option.selected").count(),0);
 assert.deepEqual(errors,[]);
 await page.getByRole("button",{name:"Noelia"}).click();
 await page.locator("#password").fill("test");
 await page.locator("#loginBtn").click();
 await page.getByRole("heading",{name:"Hoy",exact:true}).waitFor({timeout:6000}).catch(async e=>{console.log("LOGIN_DIAGNOSTIC",{error:await page.locator("#authError").textContent(),authVisible:await page.locator("#auth").isVisible(),appVisible:await page.locator("#app").isVisible(),browserErrors:errors});throw e});

 // Regresión de collages de 1–7 prendas en un navegador móvil:
 // las fotos deben decodificar, no recortarse y conservar la jerarquía.
 const collageAudit=await page.evaluate(async()=>{
  const photo="data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="120"><rect width="60" height="120" fill="navy"/></svg>');
  const categories=["Arriba","Capas","Abajo","Zapatos","Bolsos","Accesorios","Vestidos"];
  const pieces=categories.map((category,i)=>({id:"audit-"+i,name:"Pieza "+i,category,image:photo,bgWhite:i===0}));
  // photoUrl solo acepta JPEG/PNG data URL: crear PNG rectangular con canvas.
  const canvas=document.createElement("canvas");canvas.width=60;canvas.height=120;
  const context=canvas.getContext("2d");context.fillStyle="#29374a";context.fillRect(0,0,60,120);
  const png=canvas.toDataURL("image/png");pieces.forEach(item=>item.image=png);
  const host=document.createElement("div");host.style.cssText="position:fixed;left:0;top:0;width:340px;opacity:.01;pointer-events:none;z-index:-1";document.body.append(host);
  const failures=[];
  try{
   for(let count=1;count<=7;count++){
    host.innerHTML=outfitBoard(pieces.slice(0,count));
    const board=host.querySelector(".look-mixed-board"),cards=[...host.querySelectorAll(".look-mixed-item")];
    if(!board||cards.length!==count||board.dataset.count!==String(count)){failures.push("Cantidad "+count);continue}
    const images=cards.map(card=>card.querySelector("img"));
    images.forEach(img=>{if(img)img.loading="eager"});
    await Promise.all(images.map(img=>img?.decode().catch(()=>{})||Promise.resolve()));
    const outer=board.getBoundingClientRect(),areas=[];
    for(let i=0;i<cards.length;i++){
     const card=cards[i],rect=card.getBoundingClientRect(),img=images[i],photoRect=img?.getBoundingClientRect();
     areas.push(rect.width*rect.height);
     if(rect.width<1||rect.height<1||rect.left<outer.left-1||rect.top<outer.top-1||rect.right>outer.right+1||rect.bottom>outer.bottom+1)failures.push("Tarjeta fuera de rejilla: "+count+"/"+i);
     if(!img||!img.complete||img.naturalWidth!==60||img.naturalHeight!==120||getComputedStyle(img).objectFit!=="contain"||!photoRect||photoRect.width<1||photoRect.height<1||photoRect.left<rect.left-1||photoRect.top<rect.top-1||photoRect.right>rect.right+1||photoRect.bottom>rect.bottom+1)failures.push("Foto recortada o sin cargar: "+count+"/"+i);
    }
    if(count>=2&&(images[0]?.alt!=="Pieza 0"||areas[0]<=Math.max(...areas.slice(1))))failures.push("Jerarquía protagonista: "+count);
   }
  }finally{host.remove()}
  return failures;
 });
 assert.deepEqual(collageAudit,[],"Regresión de composición fotográfica de looks");

 // El color de las prendas principales debe pesar más que 3 accesorios neutros:
 // añadir complementos nunca puede disimular una base de colores incompatibles.
 const colorPriority=await page.evaluate(()=>{
  const ctx=engineContext({occasion:null,temp:20,extras:{shoes:false,bag:false}});
  const top={id:"cp-top",category:"Arriba",color:"Rojo",style:"casual"};
  const pants={id:"cp-bottom",category:"Abajo",color:"Verde",style:"casual"};
  const neutral=[
   {id:"cp-shoes",category:"Zapatos",color:"Negro",style:"casual"},
   {id:"cp-bag",category:"Bolsos",color:"Negro",style:"casual"},
   {id:"cp-acc",category:"Accesorios",color:"Negro",style:"casual"}
  ];
  const main=scoreOutfit([top,pants],ctx).score;
  const decorated=scoreOutfit([top,pants,...neutral],ctx).score;
  const harmonious=scoreOutfit([top,{...pants,color:"Rojo"},...neutral],ctx).score;
  return {main,decorated,harmonious};
 });
 assert.ok(colorPriority.harmonious>colorPriority.decorated,
  "Los accesorios neutros no pueden superar una armonía real entre las prendas principales");
 assert.ok(colorPriority.decorated<=colorPriority.main,
  "Añadir complementos neutros no debe mejorar una base de colores discordantes");

 // Collages complejos: ocupan toda la fila también tras el breakpoint de 700 px.
 for(const width of [320,390,700,768,999]){
  await page.setViewportSize({width,height:844});
  const ratio=await page.evaluate(()=>{
   const host=document.createElement("div");host.className="grid";
   host.style.cssText="position:fixed;top:0;left:0;width:100%;opacity:.01;pointer-events:none;z-index:-1";
   host.innerHTML='<div class="look-tile"><div class="look-mixed-board" data-count="5"></div></div>';
   document.body.append(host);
   const card=host.querySelector(".look-tile");
   const fraction=card.getBoundingClientRect().width/host.getBoundingClientRect().width;
   host.remove();return fraction;
  });
  assert.ok(ratio>.8,"Un look de 5 prendas se estrecha a "+width+" px: "+ratio);
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator(".daily-look").waitFor(); // «Tu look de hoy» nada más entrar
 assert.equal(await page.locator("#app").isVisible(),true);
 assert.equal(await page.locator("#auth").isVisible(),false);
 const bg=await page.locator("body").evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.notEqual(bg,"rgba(0, 0, 0, 0)","CSS not applied");
 await page.locator('[data-view="wardrobe"]').click();
 await page.locator("#addGarment").click();
 console.log("GARMENT_DIAGNOSTIC",{classes:await page.locator("#garmentSheet").getAttribute("class"),visible:await page.locator("#garmentName").isVisible(),errors});
 await page.locator("#autoAnalyze").evaluate(el=>{el.checked=false;el.dispatchEvent(new Event("change",{bubbles:true}))});
 await page.locator("#garmentName").fill("Prenda auditada");
 await page.locator("#garmentCategory").selectOption("Arriba");
 const tinyPng=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pVYAAAAASUVORK5CYII=","base64");
 await page.locator("#garmentImage").setInputFiles({name:"foto.png",mimeType:"image/png",buffer:tinyPng});
 await page.locator("#garmentPreview").waitFor({state:"visible"});
 await page.locator("#garmentForm button[type=submit]").click();
 await page.getByText("Prenda auditada").waitFor();
 await page.reload({waitUntil:"networkidle"});
 await page.locator('[data-view="today"]').click();
 await page.locator('[data-open-week]').first().click();
 assert.equal(await page.evaluate(()=>appState.view),"stylist");
 assert.equal(await page.evaluate(()=>ui.stylistTab),"week");
 await page.locator('[data-view="wardrobe"]').click();
 await page.getByText("Prenda auditada").waitFor();
 // Desbloqueo: una camiseta sola no basta; con un pantalón aparece Estilista.
 await page.locator('[data-view="stylist"]').click();
 await page.getByText("Tu estilista estará listo pronto").waitFor();
 await page.locator("[data-outfit-photo]").first().waitFor();
 await page.evaluate(()=>myGarments().push({id:"bottomAudit",name:"Pantalón auditado",category:"Abajo",color:"Negro",updatedAt:new Date().toISOString()}));
 await page.locator('[data-view="wardrobe"]').click();
 await page.locator('[data-view="stylist"]').click(); await page.locator("#openLooks").click();
 await page.locator("#newLook").click();
 await page.locator("#lookName").fill("Look auditado");
 await page.locator('#lookGarments input[type="checkbox"]').first().check();
 // Regla obligatoria: solo la parte de arriba no es un look
 await page.locator("#lookForm button[type=submit]").click();
 await page.getByText("Un look necesita parte de arriba y de abajo, o un vestido o mono").first().waitFor();
 // La parte de abajo ya está en el armario; permanece desmarcada para probar la validación.
 await page.locator('#lookGarments input[value="bottomAudit"]').check();
 await page.locator("#lookForm button[type=submit]").click();
 await page.getByText("Look auditado").waitFor();
 await page.locator('[data-view="wardrobe"]').click();
 await page.locator("#addGarment").click();
 await page.locator("#autoAnalyze").check();

 await page.locator("#garmentImage").setInputFiles({name:"foto.png",mimeType:"image/png",buffer:tinyPng});
 await page.getByText("Análisis completado").waitFor();
 assert.equal(await page.locator("#meta-fabric").inputValue(),"cotton");
 assert.equal(await page.locator("#meta-fit").inputValue(),"regular");
 assert.equal(await page.locator("#meta-sleeve").inputValue(),"larga");
 assert.equal(await page.locator("#meta-subtype").inputValue(),"camisa");
 await page.locator("#garmentExtra").evaluate(el=>el.open=true);
 await page.locator("#meta-brand").fill("Marca introducida a mano");
 assert.equal(await page.locator("#garmentName").inputValue(),"Camisa reconocida por IA");
 assert.equal(await page.locator("#garmentCategory").inputValue(),"Arriba");
 await page.locator("#garmentForm button[type=submit]").click();
 await page.getByText("Camisa reconocida por IA").first().waitFor();
 await page.reload({waitUntil:"networkidle"});
 await page.locator('[data-view="wardrobe"]').click();
 await page.locator('[data-garment]').filter({hasText:"Camisa reconocida por IA"}).first().click();
 assert.equal(await page.locator("#meta-fit").inputValue(),"regular");
 assert.equal(await page.locator("#meta-brand").inputValue(),"Marca introducida a mano");
 await page.locator("#closeGarment").click();
 await page.locator('[data-view="stylist"]').click(); await page.locator("#openLooks").click();
 await page.locator(".looks-tools > summary").click();
 await page.locator(".looks-tools").evaluate(el=>el.open=true);
 await page.locator("#aiLooks").click();
 await page.getByText("Look de prueba IA").waitFor();
 // Las propuestas de la IA se revisan: no se guardan solas
 assert.equal(await page.evaluate(()=>myLooks().filter(l=>l.ai).length),0,"La IA no debe guardar looks sin revisión");
 await page.locator("#aiSheet [data-ai-save]").first().click();
 await page.locator("#aiSheet").waitFor({state:"detached"});
 assert.equal(await page.evaluate(()=>myLooks().filter(l=>l.ai).length),1);
 await page.locator('[data-view="wardrobe"]').click();
 await page.locator('[data-fav]').first().click();
 await page.locator('[data-wear]').first().click();
 await page.locator("#wearSheet [data-wear-day]").first().click();
 await page.locator("#toast",{hasText:"Uso registrado"}).waitFor();
 // Maletas: crear un viaje, marcar una prenda como preparada y comprobar que se conserva
 await page.locator('[data-view="stylist"]').click();
 await page.locator('[data-view="trips"]').click();
 await page.locator("#tripName").fill("Viaje de prueba");
 await page.locator("#tripStart").fill("2026-12-04");
 await page.locator("#tripEnd").fill("2026-12-06");
 await page.locator('#tripForm button[type="submit"]').click();
 await page.locator("#tripBack").waitFor();
 assert.match(await page.locator(".hero p").textContent(),/3 días/);
 await page.locator("#extraText").fill("Paraguas");
 await page.locator('#extraForm button[type="submit"]').click();
 await page.locator("[data-extra]").last().check();
 await page.locator("#tripBack").click();
 await page.locator("[data-trip]").filter({hasText:"Viaje de prueba"}).click();
 assert.equal(await page.locator("[data-extra]:checked").count(),1,"La casilla de la maleta debe conservarse");
 // Mi semana: planificar hoy con un look guardado; planificado no es usado hasta «Me lo he puesto»
 await page.locator('[data-view="stylist"]').click(); await page.locator('[data-stylist-tab="week"]').click();
 const usesBefore=await page.evaluate(()=>logs().length);
 await page.locator("section.is-today [data-plan-pick]").click();
 await page.locator("#planSheet [data-plan-saved]").first().click();
 await page.locator("section.is-today [data-plan-worn]").waitFor();
 assert.equal(await page.evaluate(()=>logs().length),usesBefore,"Planificar no debe registrar un uso");
 await page.locator("section.is-today [data-plan-worn]").click();
 await page.locator("section.is-today .badge-ok").waitFor();
 assert.equal(await page.evaluate(()=>logs().length),usesBefore+1);
 // En Hoy, lo planificado para hoy ocupa «Tu look de hoy»
 await page.locator('[data-view="today"]').click();
 await page.locator(".daily-look .badge-ok").waitFor();
 // Weather refresh must not collapse the panel or lose the user's location in Hoy.
 await page.locator(".today-unified-options > summary").click();
 await page.waitForFunction(()=>ui.todayOptionsOpen===true);
 await page.evaluate(()=>render());
 assert.equal(await page.locator(".today-unified-options").evaluate(el=>el.open),true,
  "More options stays expanded after a weather-triggered render");
 assert.equal(await page.locator("#stopWeather").count(),0,
  "The unnecessary reset-to-25-degrees button is removed");
 await page.locator('[data-view="shopping"]').click();
 await page.locator('[data-shop-tab="wish"]').click();
 await page.locator('[name="wishName"]').fill("Abrigo de prueba");
 await page.locator('[name="wishPrice"]').fill("80");
 await page.locator('#wishlistForm button[type="submit"]').click();
 await page.getByText("Abrigo de prueba").waitFor();
 await page.locator('[data-view="wardrobe"]').click();
 await page.locator(".wardrobe-summary > summary").click();
 await page.locator("#wardrobeForgotten").click();
 assert.equal(await page.evaluate(()=>ui.onlyForgotten),true);
 await page.locator(".wardrobe-summary > summary").click();
 await page.locator("#wardrobeHistory").click();
 await page.getByRole("heading",{name:"Calendario de looks"}).waitFor();
 assert.ok(await page.locator("[data-remove-use]").count()>0,"Wear records must appear in calendar");
 await page.locator('[data-view="today"]').click();
 assert.equal(await page.locator("#prefDiversity").count(),0,"El porcentaje de diversidad no debe mostrarse");
 await page.locator('[data-view="stylist"]').click(); await page.locator("#openLooks").click();
 const existingLooks=await page.locator("[data-look]").count();
 forceServerError=true;
 await page.locator(".looks-tools").evaluate(el=>el.open=true);
 await page.locator("#aiLooks").click();
 await page.getByText("No se pudieron generar looks").waitFor();
 assert.equal(await page.locator("[data-look]").count(),existingLooks,"Server failures must not create looks");
 await page.locator('[data-view="today"]').click();
 assert.equal(await page.locator("[data-extra-pref]").count(),0,"Los looks se completan automáticamente");
 await page.locator('[data-view="stylist"]').click(); await page.locator("#openLooks").click();
 forceUnauthorized=true;
 await page.locator(".looks-tools").evaluate(el=>el.open=true);
 await page.locator("#aiLooks").click();
 await page.locator("#auth").waitFor({state:"visible"});
 assert.equal(await page.locator("#app").isVisible(),false);
 assert.equal(await page.getByText("Prenda auditada").count(),0,"Logout must purge private DOM");
 assert.equal(await page.locator("#lookGarments").textContent(),"","Private look picker must be cleared");
 currentProfile="irene";
 await page.getByRole("button",{name:"Irene"}).click();
 await page.locator("#password").fill("test");
 await page.locator("#loginBtn").click();
 await page.getByRole("heading",{name:"Hoy",exact:true}).waitFor();
 await page.locator('[data-view="wardrobe"]').click();
 assert.equal(await page.getByText("Prenda auditada").count(),0,"Profile isolation broken");
 assert.equal(await page.getByText("No hay prendas con estos filtros").count(),1);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:"atelier-smoke.png",fullPage:true});
 console.log("PASS: iPhone viewport, styles, login, wardrobe CRUD, packing lists, IndexedDB persistence, manual looks, AI garment recognition, AI looks, AI outages, expired sessions, profile isolation");
}finally{await browser.close()}

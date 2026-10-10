import { chromium, devices } from "playwright";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,channel:"chrome"});
const context=await browser.newContext({...devices["iPhone 13"],browserName:undefined});
const page=await context.newPage();
const errors=[];
let forceUnauthorized=false,forceServerError=false,forceQuota=false;
page.on("pageerror",e=>{errors.push(e.message);console.log("PAGEERROR_STACK",e.stack)});
page.on("console",m=>{if(m.type()==="error")console.log("BROWSER_CONSOLE",m.text())});
page.on("requestfailed",r=>console.log("FAILED_REQUEST",r.url(),r.failure()?.errorText));
await page.route("https://atelier-ai-backend-pi.vercel.app/**",async route=>{
 const req=route.request(),url=req.url(),origin="http://127.0.0.1:8000";
 const headers={"access-control-allow-origin":origin,"access-control-allow-headers":"Content-Type, Authorization","access-control-allow-methods":"GET, POST, OPTIONS","content-type":"application/json"};
 console.log("MOCK",req.method(),url);if(req.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
 if(url.endsWith("/api/login")){const body=JSON.parse(req.postData()||"{}");return route.fulfill({status:200,headers,body:JSON.stringify({profileId:body.profileId,token:"test-token"})})}
 if(url.endsWith("/api/session"))return route.fulfill({status:200,headers,body:JSON.stringify({authenticated:true,profileId:currentProfile})});
 if(url.endsWith("/api/analyze")&&forceUnauthorized){forceUnauthorized=false;return route.fulfill({status:401,headers,body:JSON.stringify({error:"Sesión caducada"})})}
 if(url.endsWith("/api/analyze")&&forceQuota){forceQuota=false;return route.fulfill({status:429,headers,body:JSON.stringify({error:"Límite diario alcanzado"})})}
 if(url.endsWith("/api/analyze")&&forceServerError){forceServerError=false;return route.fulfill({status:503,headers,body:JSON.stringify({error:"Servicio no disponible"})})}
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

 // UX: dynamic dialogs keep keyboard focus inside and restore the invoking control.
 const dialogFocus=await page.evaluate(async()=>{
  const launcher=document.createElement("button");launcher.textContent="Abrir prueba de diálogo";
  document.body.append(launcher);launcher.focus();
  const popup=showSheet("uxFocusAudit",'<h2 id="uxFocusAuditTitle">Diálogo de prueba</h2><button id="uxFirst">Primero</button><button id="uxLast" data-close-sheet>Último</button>');
  await new Promise(resolve=>setTimeout(resolve,10));
  const first=document.querySelector("#uxFirst"),last=document.querySelector("#uxLast");
  last.focus();
  last.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true}));
  const wrapForward=document.activeElement===first;
  first.focus();
  first.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",shiftKey:true,bubbles:true,cancelable:true}));
  const wrapBack=document.activeElement===last;
  last.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}));
  const returned=document.activeElement===launcher&&!document.querySelector("#uxFocusAudit");
  launcher.focus();
  showSheet("uxFocusAudit",'<h2 id="uxFocusAuditTitle">Primer paso</h2><button>Continuar</button>');
  showSheet("uxFocusAudit",'<h2 id="uxFocusAuditTitle">Segundo paso</h2><button data-close-sheet>Cerrar</button>');
  document.querySelector("#uxFocusAudit [data-close-sheet]").click();
  const rerenderReturned=document.activeElement===launcher;
  launcher.remove();
  return {wrapForward,wrapBack,returned,rerenderReturned};
 });
 assert.deepEqual(dialogFocus,{wrapForward:true,wrapBack:true,returned:true,rerenderReturned:true},"Dialog keyboard focus must wrap and return");

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
    const hero=pieces.slice(0,count).find(p=>p.category==="Vestidos")?.name||"Pieza 0"; // un vestido siempre protagoniza
    if(count>=2&&(images[0]?.alt!==hero||areas[0]<=Math.max(...areas.slice(1))))failures.push("Jerarquía protagonista: "+count);
   }
  }finally{host.remove()}
  return failures;
 });
 assert.deepEqual(collageAudit,[],"Regresión de composición fotográfica de looks");
 // In dense looks, small accessories get a quieter presentation than clothing.
 const accessoryHierarchy=await page.evaluate(()=>{
  const canvas=document.createElement("canvas");canvas.width=40;canvas.height=80;
  canvas.getContext("2d").fillRect(0,0,40,80);
  const image=canvas.toDataURL("image/png");
  const garments=["Arriba","Abajo","Capas","Zapatos","Bolsos","Accesorios"].map((category,i)=>({id:"a"+i,name:category,category,image}));
  const host=document.createElement("div");host.style.cssText="position:fixed;left:0;top:0;width:340px;visibility:hidden";
  document.body.append(host);
  try{
   host.innerHTML=outfitBoard(garments);
   const accessory=host.querySelector('[data-piece-kind="accessory"] img');
   const bag=host.querySelector('[data-piece-kind="bag"] img');
   const clothing=host.querySelector('[data-piece-kind="garment"] img');
   return Boolean(accessory&&bag&&clothing&&
    parseFloat(getComputedStyle(accessory).paddingTop)>parseFloat(getComputedStyle(bag).paddingTop)&&
    parseFloat(getComputedStyle(bag).paddingTop)>parseFloat(getComputedStyle(clothing).paddingTop));
  }finally{host.remove()}
 });
 assert.equal(accessoryHierarchy,true,"Small accessories must remain visually secondary in dense looks");

 // A dress with shoes should not present the shoes as an equally important tile.
 const dressLayout=await page.evaluate(()=>{
  const cv=document.createElement("canvas");cv.width=40;cv.height=80;cv.getContext("2d").fillRect(0,0,40,80);
  const image=cv.toDataURL("image/png");
  const host=document.createElement("div");host.style.cssText="width:300px;position:fixed;left:0;top:0;visibility:hidden";
  document.body.append(host);
  try{
   const dress={id:"hero-dress",name:"Vestido",category:"Vestidos",image};
   const shoes={id:"side-shoes",name:"Zapatos",category:"Zapatos",image};
   host.innerHTML=outfitBoard([shoes,dress]);
   const board=host.querySelector(".look-mixed-board");
   const cards=[...host.querySelectorAll(".look-mixed-item")];
   const dressArea=cards[0].getBoundingClientRect(),shoeArea=cards[1].getBoundingClientRect();
   const ratio=(dressArea.width*dressArea.height)/(shoeArea.width*shoeArea.height);
   const dressOk=board.dataset.heroCategory==="dress"&&cards[0].querySelector("img").alt==="Vestido"&&ratio>2;
   host.innerHTML=outfitBoard([{id:"a",name:"Camisa",category:"Arriba",image},{id:"b",name:"Pantalón",category:"Abajo",image}]);
   const ordinary=host.querySelector(".look-mixed-board");
   return {dressOk,ordinaryOk:ordinary.dataset.heroCategory==="other"};
  }finally{host.remove()}
 });
 assert.equal(dressLayout.dressOk,true,"Dress must dominate shoes in a 2-piece collage");
 assert.equal(dressLayout.ordinaryOk,true,"Top-and-bottom looks retain their standard layout");


 // Premium: test actual responsive media queries, at each viewport width.
 const originalViewport=page.viewportSize();
 const cardOverflow=[];
 try{
  for(const width of [320,375,430]){
   await page.setViewportSize({width,height:844});
   const failures=await page.evaluate(()=>{
    const failures=[];
    const host=document.createElement("div");
    host.style.cssText="position:fixed;left:0;top:0;width:100vw;z-index:-1;visibility:hidden;pointer-events:none";
    host.innerHTML='<div class="grid"><article class="garment-tile"><div class="card-body"><div class="card-title">Chaqueta-de-invierno-impermeable-extralarga-con-nombre-muy-largo</div><div class="card-meta">Estampado floral multicolor con detalles especiales y descripción extensa</div></div><div class="tile-tools"><button class="chip-button">Editar esta prenda</button><button class="chip-button">Ver detalles adicionales</button></div></article><article class="look-tile"><div class="card-body"><div class="card-title">Look-para-evento-muy-especial-con-titulo-larguisimo</div><div class="card-meta">Descripción de conjunto para diferentes ocasiones</div></div><div class="tile-tools"><button class="chip-button">Guardar conjunto</button><button class="chip-button">Cambiar prendas</button></div></article></div>';
    document.body.append(host);
    try{
     const viewportWidth=document.documentElement.clientWidth;
     for(const tile of host.querySelectorAll(".garment-tile,.look-tile")){
      const bounds=tile.getBoundingClientRect();
      if(bounds.width<1||bounds.left< -1||bounds.right>viewportWidth+1)failures.push("Tile outside viewport: "+tile.className);
      if(tile.scrollWidth>tile.clientWidth+1)failures.push("Tile scroll overflow: "+tile.className);
      for(const element of tile.querySelectorAll(".card-title,.card-meta,.tile-tools,.tile-tools button")){
       const box=element.getBoundingClientRect();
       if(box.left<bounds.left-1||box.right>bounds.right+1)failures.push("Escapes tile: "+element.className);
       if(element.scrollWidth>element.clientWidth+1)failures.push("Text scroll overflow: "+element.className);
      }
     }
    }finally{host.remove()}
    return failures;
   });
   cardOverflow.push(...failures.map(message=>width+"px: "+message));
  }
 }finally{
  if(originalViewport)await page.setViewportSize(originalViewport);
 }
 assert.deepEqual(cardOverflow,[],"Premium cards must not overflow narrow mobile viewports");

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
   const flow=getComputedStyle(host).gridAutoFlow;
   host.remove();return {fraction,flow};
  });
  assert.ok(ratio.fraction>.8,"Un look de 5 prendas se estrecha a "+width+" px: "+ratio.fraction);
  assert.ok(!/dense/.test(ratio.flow),"El orden visual debe coincidir con el orden de teclado a "+width+" px");
 }
 await page.setViewportSize({width:390,height:844});
 // Motor de looks: si existen varias bases equivalentes, las primeras propuestas
 // no pueden ser el mismo top+pantalón cambiando solo complementos.
 const distinctBases=await page.evaluate(()=>{
  const garments=[
   {id:"style-top-1",name:"Camiseta blanca",category:"Arriba",color:"Blanco",style:"casual"},
   {id:"style-top-2",name:"Camiseta negra",category:"Arriba",color:"Negro",style:"casual"},
   {id:"style-top-3",name:"Camiseta beige",category:"Arriba",color:"Beige",style:"casual"},
   {id:"style-bottom-1",name:"Pantalón negro",category:"Abajo",color:"Negro",style:"casual"},
   {id:"style-bottom-2",name:"Pantalón beige",category:"Abajo",color:"Beige",style:"casual"}
  ];
  const looks=rankOutfits({pool:garments,occasion:null,temp:22,extras:{shoes:false,bag:false},max:3,avoid:new Set()});
  const keys=looks.map(l=>l.garments.filter(g=>["Arriba","Abajo","Vestidos"].includes(g.category)).map(g=>g.id).sort().join("|"));
  return {keys,count:looks.length};
 });
 assert.ok(distinctBases.count>=3,"El armario simulado debe producir tres conjuntos");
 assert.equal(new Set(distinctBases.keys).size,distinctBases.keys.length,
  "Las primeras propuestas deben usar bases diferentes, no solo variar accesorios");
 const principalDiversity=await page.evaluate(()=>{
  const pool=[
   {id:"t1",name:"Camiseta 1",category:"Arriba",color:"Blanco",style:"casual"},
   {id:"t2",name:"Camiseta 2",category:"Arriba",color:"Blanco",style:"casual"},
   {id:"b1",name:"Pantalón 1",category:"Abajo",color:"Negro",style:"casual"},
   {id:"b2",name:"Pantalón 2",category:"Abajo",color:"Negro",style:"casual"}
  ];
  const looks=rankOutfits({pool,occasion:null,temp:22,extras:{shoes:false,bag:false},max:2,avoid:new Set()});
  if(looks.length<2)return {count:looks.length,shared:99};
  const a=new Set(looks[0].garments.filter(g=>["Arriba","Abajo"].includes(g.category)).map(g=>g.id));
  return {count:looks.length,shared:looks[1].garments.filter(g=>a.has(g.id)).length};
 });
 assert.equal(principalDiversity.count,2,"Deben existir dos propuestas para el armario equilibrado");
 assert.equal(principalDiversity.shared,0,
  "Dos propuestas equivalentes deben cambiar tanto la camiseta como el pantalón");
 // Combina una prenda: mantener la pieza obligatoria y variar las otras.
 const fixedGarmentLooks=await page.evaluate(()=>{
  const pool=[
   {id:"req-top",name:"Camisa elegida",category:"Arriba",color:"Blanco",style:"casual"},
   {id:"req-bottom-a",name:"Pantalón A",category:"Abajo",color:"Negro",style:"casual"},
   {id:"req-bottom-b",name:"Pantalón B",category:"Abajo",color:"Beige",style:"casual"},
   {id:"req-bottom-c",name:"Pantalón C",category:"Abajo",color:"Azul",style:"casual"}
  ];
  // rankOutfits resuelve la prenda obligatoria desde el armario del perfil.
  const original=appState.data.garments;
  try{
   appState.data.garments=pool;
   const looks=rankOutfits({pool,required:"req-top",occasion:null,temp:22,extras:{shoes:false,bag:false},max:3,avoid:new Set()});
   return {count:looks.length,hasRequired:looks.every(l=>l.ids.includes("req-top")),bottoms:looks.map(l=>l.garments.find(g=>g.category==="Abajo")?.id)};
  }finally{appState.data.garments=original}
 });
 assert.equal(fixedGarmentLooks.count,3,"Deben ofrecerse tres looks con la prenda elegida");
 assert.ok(fixedGarmentLooks.hasRequired,"La prenda seleccionada no debe desaparecer");
 assert.equal(new Set(fixedGarmentLooks.bottoms).size,3,"Variar pantalón sin cambiar la prenda obligatoria");
 // Silueta: holgado + regular debe equilibrar más que oversize + holgado.
 const silhouettePriority=await page.evaluate(()=>{
  const ctx=engineContext({occasion:null,temp:22,extras:{shoes:false,bag:false}});
  const top={id:"sil-t",name:"Camisa",category:"Arriba",color:"Blanco",style:"casual",fit:"oversize"};
  const bottom={id:"sil-b",name:"Pantalón",category:"Abajo",color:"Negro",style:"casual"};
  return {
   balanced:scoreOutfit([top,{...bottom,fit:"entallado"}],ctx).score,
   intermediate:scoreOutfit([top,{...bottom,fit:"regular"}],ctx).score,
   unbalanced:scoreOutfit([top,{...bottom,fit:"holgado"}],ctx).score
  };
 });
 assert.ok(silhouettePriority.balanced>silhouettePriority.intermediate&&silhouettePriority.intermediate>silhouettePriority.unbalanced,
  "El ajuste de la silueta debe favorecer volúmenes complementarios frente a dos prendas holgadas");
 // En estilo cómodo se aceptan dos volúmenes amplios, pero no se fuerza el estilo en otros contextos.
 const comfyLoose=await page.evaluate(()=>{
  const top={id:"comfy-t",category:"Arriba",color:"Blanco",style:"casual",fit:"oversize"};
  const bottom={id:"comfy-b",category:"Abajo",color:"Negro",style:"casual",fit:"holgado"};
  const ctx=dress=>engineContext({occasion:null,temp:22,extras:{shoes:false,bag:false},dress});
  return {relaxed:scoreOutfit([top,bottom],ctx("comoda")).score,
   ordinary:scoreOutfit([top,bottom],ctx(null)).score};
 });
 assert.ok(comfyLoose.relaxed>comfyLoose.ordinary,
  "El estilo Cómoda debe aceptar la silueta holgada");
 const fittedComfort=await page.evaluate(()=>{
  const top={id:"fit-t",category:"Arriba",color:"Blanco",style:"casual",fit:"entallado"};
  const bottom={id:"fit-b",category:"Abajo",color:"Negro",style:"casual",fit:"ajustado"};
  const ctx=dress=>engineContext({occasion:null,temp:22,extras:{shoes:false,bag:false},dress});
  return {comfy:scoreOutfit([top,bottom],ctx("comoda")).score,
   ordinary:scoreOutfit([top,bottom],ctx(null)).score};
 });
 // La diferencia de estilo tiene su propia puntuación: comprobar el bonus de silueta
 // aislado con el mismo contexto y la misma ropa, sin premiar dos piezas ceñidas.
 assert.ok(fittedComfort.comfy<=fittedComfort.ordinary+5,
  "Dos prendas ajustadas no deben recibir el bonus de silueta holgada");
 await page.locator(".daily-look").waitFor(); // «Tu look de hoy» nada más entrar
 assert.equal(await page.locator("#app").isVisible(),true);
 assert.equal(await page.locator("#auth").isVisible(),false);
 const bg=await page.locator("body").evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.notEqual(bg,"rgba(0, 0, 0, 0)","CSS not applied");
 await page.locator('[data-view="wardrobe"]').click();
 await page.locator(".wardrobe-add-menu > summary").click();
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
 // Wardrobe prioritises garments and still makes stats/history discoverable.
 const wardrobeSummary=page.locator(".wardrobe-summary");
 await wardrobeSummary.locator("summary").waitFor();
 assert.equal(await wardrobeSummary.evaluate(el=>el.open),false,"Wardrobe metrics start collapsed");
 const wardrobeTrigger=await wardrobeSummary.locator("summary").evaluate(el=>({height:el.getBoundingClientRect().height,display:getComputedStyle(el).display,text:el.textContent}));
 assert.ok(wardrobeTrigger.height>=44&&wardrobeTrigger.display==="list-item"&&wardrobeTrigger.text.includes("prendas"),"Wardrobe summary is discoverable and tappable");
 await wardrobeSummary.locator("summary").click();
 await wardrobeSummary.locator("#wardrobeHistory").waitFor({state:"visible"});
 await page.reload({waitUntil:"networkidle"});
 await page.locator('[data-view="today"]').click();
 // Hoy stays uncluttered without hiding valid occasions or weather refresh.
 assert.equal(await page.locator(".today-unified-options").count(),0);
 for(const occasion of ["daily","work","sport","beach","home","event","party","formal"])assert.equal(await page.locator(`#dailyOccasion option[value="${occasion}"]`).count(),1);
 assert.equal(await page.locator("#dailyWeather").count(),1);
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
 // A saved look keeps the less-used controls behind a discoverable summary.
 const actions=page.locator(".look-tile .look-secondary-actions").first();
 await actions.locator("summary").waitFor();
 assert.equal(await actions.evaluate(el=>el.open),false,"Extra look actions start collapsed");
 const disclosure=await actions.locator("summary").evaluate(el=>({height:el.getBoundingClientRect().height,display:getComputedStyle(el).display}));
 assert.ok(disclosure.height>=44&&disclosure.display==="list-item","The actions disclosure is both tappable and visibly expandable");
 await actions.locator("summary").click();
 assert.equal(await actions.locator('[data-look-edit]').isVisible(),true,"Edit remains available after opening more actions");
 await page.locator('[data-view="wardrobe"]').click();
 await page.locator(".wardrobe-add-menu > summary").click();
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
 // Los looks ya no se piden a la IA (decisión de Noelia, 10/10/2026): «Explorar» los hace el motor y se guardan a mano
 await page.locator('[data-view="stylist"]').click(); await page.locator('[data-stylist-tab="explore"]').click();
 assert.equal(await page.locator("#aiLooks").count(),0,"Sin botón de looks con IA");
 const looksBefore=await page.evaluate(()=>myLooks().length);
 await page.locator("[data-explore-save]").first().click();
 await page.locator("#toast",{hasText:"Look guardado"}).waitFor();
 assert.equal(await page.evaluate(()=>myLooks().length),looksBefore+1);
 assert.equal(await page.evaluate(()=>myLooks().filter(l=>l.ai).length),0);
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
 // Hoy no presenta el panel redundante de opciones.
 assert.equal(await page.locator(".today-unified-options").count(),0);
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
 // Fallo del servidor de IA al analizar: aviso y nada cambia
 await page.locator('[data-view="wardrobe"]').click();
 const existingGarments=await page.evaluate(()=>myGarments().length);
 const withPhoto=await page.evaluate(()=>myGarments().find(g=>validImage(g.image))?.id);assert.ok(withPhoto,"Hace falta una prenda con foto");
 await page.evaluate(id=>openGarment(id),withPhoto);
 forceServerError=true;
 await page.locator("#analyzeBtn").click();
 await page.getByText("No se pudo analizar la prenda").waitFor();
 await page.locator("#closeGarment").click();
 assert.equal(await page.evaluate(()=>myGarments().length),existingGarments,"Server failures must not change the wardrobe");
 await page.locator('[data-view="today"]').click();
 assert.equal(await page.locator("[data-extra-pref]").count(),0,"Los looks se completan automáticamente");
 await page.locator('[data-view="wardrobe"]').click();
 // «Completar con IA»: rellena solo lo que falta en fichas con foto y no repite la misma prenda
 const fill=await page.evaluate(async()=>{
  const cv=document.createElement("canvas");cv.width=40;cv.height=60;const c=cv.getContext("2d");c.fillStyle="#345";c.fillRect(0,0,40,60);
  const now=new Date().toISOString();appState.data.garments.push({id:"fill-1",name:"Prenda por completar",category:"Arriba",color:"Azul",style:"casual",season:"all",pattern:"plain",image:cv.toDataURL("image/jpeg"),createdAt:now,updatedAt:now});
  const others=myGarments().filter(g=>g.id!=="fill-1"&&!g.aiFilledAt);others.forEach(g=>g.aiFilledAt="test"); /* solo esta prenda: no llenar la caché de análisis de las demás */
  const before=fillCandidates().some(g=>g.id==="fill-1");await completeSheetsWithAI();others.forEach(g=>delete g.aiFilledAt);const g=myGarments().find(x=>x.id==="fill-1");
  return {before,fabric:g.fabric,sleeve:g.sleeve,pattern:g.pattern,occ:g.occasions,filled:!!g.aiFilledAt,again:fillCandidates().some(x=>x.id==="fill-1")};
 });
 assert.ok(fill.before&&fill.filled&&!fill.again,"Completar con IA analiza una vez cada prenda "+JSON.stringify(fill));
 assert.equal(fill.fabric,"cotton");assert.equal(fill.sleeve,"larga");assert.ok(fill.occ?.includes("work"),"Ocasiones de la IA");
 assert.equal(fill.pattern,"plain","No pisa lo que ya estaba escrito");
 // Un fallo del servidor no marca la prenda: se puede reintentar
 forceServerError=true;
 const retry=await page.evaluate(async()=>{const now=new Date().toISOString();const cv=document.createElement("canvas");cv.width=30;cv.height=50;cv.getContext("2d").fillRect(0,0,30,50);
  appState.data.garments.push({id:"fill-2",name:"Otra por completar",category:"Arriba",color:"Negro",style:"casual",season:"all",image:cv.toDataURL("image/jpeg"),createdAt:now,updatedAt:now});
  const others=myGarments().filter(g=>g.id!=="fill-2"&&!g.aiFilledAt);others.forEach(g=>g.aiFilledAt="test");
  await completeSheetsWithAI();others.forEach(g=>delete g.aiFilledAt);const g=myGarments().find(x=>x.id==="fill-2");const r={marked:!!g.aiFilledAt,still:fillCandidates().some(x=>x.id==="fill-2")};
  appState.data.garments=myGarments().filter(x=>x.id!=="fill-2");tomb("fill-2");await saveState();return r});
 assert.ok(!retry.marked&&retry.still,"Tras un error 503 la prenda sigue pendiente "+JSON.stringify(retry));
 // Límite agotado en el servidor (otro móvil): este dispositivo deja de intentarlo hoy
 forceQuota=true;
 const quota=await page.evaluate(async()=>{const u=aiUsage(),prev=u.analyze;const cv=document.createElement("canvas");cv.width=20;cv.height=44;cv.getContext("2d").fillRect(0,0,20,44);
  let err="";try{await api("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:cv.toDataURL("image/jpeg")})})}catch(e){err=e.message}
  const r={err,full:aiUsage().analyze>=AI_LIMITS.analyze};u.analyze=prev;await saveState();return r});
 assert.deepEqual(quota,{err:"AI_QUOTA",full:true},"Un 429 del servidor agota el límite local");
 // Subida de varias fotos: cada prenda se guarda sola (analizada; sin análisis disponibles, pendiente para «Completar con IA»)
 const pngs=["iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pVYAAAAASUVORK5CYII=","iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==","iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="];
 const bulkFiles=pngs.map((b,i)=>({name:"bulk"+i+".png",mimeType:"image/png",buffer:Buffer.from(b,"base64")}));
 const countBy=()=>page.evaluate(()=>({ai:myGarments().filter(g=>g.name==="Camisa reconocida por IA").length,pend:myGarments().filter(g=>g.needsAI).length}));
 const before=await countBy();
 await page.evaluate(()=>{appState.data.preferences.autoAnalyze=true;appState.data.preferences.autoWhite=false;setView("wardrobe");openGarment()});
 await page.locator("#garmentImage").setInputFiles(bulkFiles);
 await page.waitForFunction(n=>myGarments().filter(g=>g.name==="Camisa reconocida por IA").length>=n,before.ai+3,{timeout:20000});
 assert.equal(await page.locator("#garmentSheet").evaluate(el=>el.classList.contains("hidden")),true,"La subida termina sola, sin dejar la ficha abierta");
 await page.evaluate(()=>{const u=aiUsage();u.analyze=AI_LIMITS.analyze;setView("wardrobe");openGarment()});
 await page.locator("#garmentImage").setInputFiles(bulkFiles.slice(1).map((f,i)=>({...f,name:"q"+i+".png"})));
 await page.waitForFunction(n=>myGarments().filter(g=>g.needsAI).length>=n,before.pend+2,{timeout:20000});
 const pend=await page.evaluate(()=>myGarments().filter(g=>g.needsAI).map(g=>({color:g.color,cand:pendingAI().includes(g)})));
 assert.ok(pend.every(x=>x.color&&x.cand),"Sin análisis: color estimado y pendiente de IA "+JSON.stringify(pend));
 await page.evaluate(async()=>{const ids=myGarments().filter(g=>g.needsAI||g.name==="Camisa reconocida por IA"&&g.createdAt>new Date(Date.now()-600000).toISOString()).map(g=>g.id);appState.data.garments=myGarments().filter(g=>!ids.includes(g.id));ids.forEach(tomb);aiUsage().analyze=0;appState.data.preferences.autoAnalyze=false;await saveState()});
 await page.evaluate(async()=>{appState.data.garments=myGarments().filter(g=>g.id!=="fill-1");tomb("fill-1");await saveState()});
 await page.evaluate(()=>openGarment(myGarments().find(g=>validImage(g.image))?.id));
 forceUnauthorized=true;
 await page.locator("#analyzeBtn").click();
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
 assert.equal(await page.getByText("Tu armario está vacío").count(),1,"Armario vacío: bienvenida, no «sin filtros»");
 assert.deepEqual(errors,[]);
 await page.screenshot({path:"atelier-smoke.png",fullPage:true});
 console.log("PASS: iPhone viewport, styles, login, wardrobe CRUD, packing lists, IndexedDB persistence, manual looks, AI garment recognition, explore looks, AI outages, expired sessions, profile isolation");
}finally{await browser.close()}

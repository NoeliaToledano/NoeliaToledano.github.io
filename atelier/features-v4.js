/* Atelier v4: almacenamiento persistente y ligero, looks con fotos y comprobador "¿Lo compro?". */

/* ---------- 1. Persistencia: que el navegador no borre el armario ---------- */
const isStandalone=()=>{try{return matchMedia("(display-mode: standalone)").matches||navigator.standalone===true}catch{return false}};
const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const storageInfo={persisted:null};
async function ensurePersistence(){
 try{
  if(!navigator.storage?.persisted)return;
  let ok=await navigator.storage.persisted();
  if(!ok&&navigator.storage.persist)ok=await navigator.storage.persist();
  storageInfo.persisted=ok;
 }catch{storageInfo.persisted=false}
}
const previousEnterApp=enterApp;
enterApp=async function(){await previousEnterApp();await ensurePersistence();if(appState.view==="wardrobe"||appState.view==="settings")render()};

function daysSince(iso){const t=Date.parse(iso||"");return Number.isNaN(t)?null:Math.floor((Date.now()-t)/86400000)}
function safetyBanner(){
 const p=appState.data.preferences,msgs=[];
 if(!isStandalone()&&p.installHintHidden!==true){
  msgs.push(isIOS()
   ?"Instala Atelier en tu pantalla de inicio para que Safari no borre tu armario: pulsa Compartir y luego «Añadir a pantalla de inicio»."
   :"Instala Atelier como aplicación (menú del navegador › «Instalar aplicación») para proteger tus datos.");
 }
 const since=daysSince(p.lastBackupAt);
 if(myGarments().length>=5&&(since===null||since>30))msgs.push(since===null?"Aún no has exportado ninguna copia de seguridad de tu armario.":"Hace "+since+" días de tu última copia de seguridad.");
 if(!msgs.length)return "";
 return '<div class="notice-card"><div>'+msgs.map(m=>'<p>'+fx(m)+'</p>').join("")+'</div><div class="notice-actions">'+
  (msgs.some(m=>m.includes("copia"))?'<button class="chip-button" id="bannerBackup">Exportar copia</button>':'')+
  (!isStandalone()&&p.installHintHidden!==true?'<button class="chip-button" id="bannerHide">Ya la he instalado</button>':'')+'</div></div>';
}
function bindBanner(){
 $("#bannerBackup")?.addEventListener("click",()=>downloadBackup());
 $("#bannerHide")?.addEventListener("click",()=>setPref("installHintHidden",true));
}
const previousDownloadBackup=downloadBackup;
downloadBackup=function(){previousDownloadBackup();setPref("lastBackupAt",new Date().toISOString())};

const previousWardrobe=renderAdvancedWardrobe;
renderAdvancedWardrobe=function(root){
 previousWardrobe(root);
 const html=safetyBanner();
 if(html){const hero=$(".hero",root);hero?.insertAdjacentHTML("afterend",html);bindBanner()}
};
const previousSettings=renderAdvancedSettings;
renderAdvancedSettings=function(root){
 previousSettings(root);
 const since=daysSince(appState.data.preferences.lastBackupAt);
 const state=storageInfo.persisted===true?"Almacenamiento protegido: el navegador no borrará estos datos automáticamente.":
  storageInfo.persisted===false?"El navegador no ha confirmado la protección del almacenamiento. Instala la app y exporta copias con frecuencia.":"";
 const html='<div class="feature-card"><h2>Estado de tus datos</h2>'+(state?'<p class="muted">'+fx(state)+'</p>':'')+
  '<p class="muted">'+fx(isStandalone()?"Estás usando Atelier como app instalada.":"Estás usando Atelier desde el navegador, sin instalar.")+'</p>'+
  '<p class="muted">'+fx(since===null?"Sin copias exportadas todavía.":"Última copia exportada hace "+since+" días.")+'</p></div>';
 const cards=$$(".feature-card",root);(cards.at(-1)||$(".hero",root))?.insertAdjacentHTML("afterend",html);
};

/* ---------- 2. Rendimiento: fotos más ligeras y guardadas por separado ---------- */
const IMAGE_MAX=900,IMAGE_QUALITY=.8;
const imgKey=id=>"img:"+appState.profile.id+":"+id;
const validImage=v=>typeof v==="string"&&/^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(v);
let storedImages=new Map();

function shrinkDataUrl(src,max=IMAGE_MAX){
 return new Promise(res=>{
  const img=new Image();
  img.onload=()=>{
   const scale=Math.min(1,max/Math.max(img.width,img.height));
   if(scale>=1&&src.length<250000)return res(src);
   const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),c=document.createElement("canvas");
   c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);res(c.toDataURL("image/jpeg",IMAGE_QUALITY));
  };
  img.onerror=()=>res(src);img.src=src;
 });
}
readImage=function(file){
 return new Promise((res,rej)=>{
  if(!file)return res(null);
  if(!file.type.startsWith("image/"))return rej(new Error("INVALID_IMAGE"));
  if(file.size>20*1024*1024)return rej(new Error("IMAGE_TOO_LARGE"));
  const r=new FileReader();r.onerror=()=>rej(r.error);
  r.onload=()=>{const img=new Image();img.onerror=()=>rej(new Error("INVALID_IMAGE"));img.onload=()=>{
   const scale=Math.min(1,IMAGE_MAX/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),c=document.createElement("canvas");
   c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);res(c.toDataURL("image/jpeg",IMAGE_QUALITY))};img.src=r.result};
  r.readAsDataURL(file);
 });
};

loadState=async function(){
 appState.data=emptyData();storedImages=new Map();let migrate=false;
 try{
  const data=normalizeData(await dbGet(stateKey()));
  await Promise.all(data.garments.map(async g=>{
   if(validImage(g.image)){migrate=true;g.image=await shrinkDataUrl(g.image);return}
   if(g.hasImage){try{const img=await dbGet(imgKey(g.id));if(validImage(img)){g.image=img;storedImages.set(g.id,img)}}catch(e){console.error("IMG_LOAD",e)}}
  }));
  appState.data=data;
 }catch(e){console.error("DB_LOAD",e);toast("No se pudo cargar el armario")}
 finally{lastSavedData=copyData(appState.data)}
 if(migrate&&await saveState())console.info("Atelier: fotos migradas al nuevo formato");
};

saveState=async function(){
 const d=appState.data;
 try{
  const db=await openDB(),ids=new Set(d.garments.map(g=>g.id));
  const slim={...d,garments:d.garments.map(g=>{const {image,...rest}=g;return {...rest,hasImage:validImage(image)}})};
  await new Promise((res,rej)=>{
   const tx=db.transaction(STORE,"readwrite"),st=tx.objectStore(STORE);
   for(const g of d.garments)if(validImage(g.image)&&storedImages.get(g.id)!==g.image)st.put(g.image,imgKey(g.id));
   for(const id of storedImages.keys())if(!ids.has(id))st.delete(imgKey(id));
   st.put(slim,stateKey());
   tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error("TX_ABORT"));
  });
  storedImages=new Map(d.garments.filter(g=>validImage(g.image)).map(g=>[g.id,g.image]));
  lastSavedData=copyData(d);return true;
 }catch(e){
  console.error("DB_SAVE",e);appState.data=copyData(lastSavedData);if(appState.profile)render();
  toast("No se pudo guardar. Comprueba el espacio disponible.");return false;
 }
};

/* ---------- 3. Looks con fotos ---------- */
function collage(images,extra=0){
 if(!images.length)return "";
 return '<div class="look-collage n'+Math.min(images.length,4)+'">'+images.slice(0,4).map((src,i)=>'<div class="look-thumb" style="background-image:url('+src+')">'+(i===3&&extra>0?'<span>+'+extra+'</span>':'')+'</div>').join("")+'</div>';
}
lookCard=function(l){
 const gs=(l.garmentIds||[]).map(id=>myGarments().find(g=>g.id===id)).filter(Boolean),imgs=gs.map(g=>g.image).filter(validImage);
 return '<article class="card" data-look="'+esc(l.id)+'">'+collage(imgs,imgs.length-4)+'<div class="card-body"><div class="card-title">'+esc(l.name)+'</div><div class="look-items">'+gs.map(g=>'<span class="look-chip">'+esc(g.name)+'</span>').join("")+'</div></div></article>';
};

/* ---------- 4. ¿Lo compro? ---------- */
const norm=s=>String(s||"").toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g,"");
const COLOR_WORDS=[
 ["neutro",["negro","negra","blanco","blanca","gris","beige","crudo","cruda","camel","marron","chocolate","marino","navy","denim","vaquero","vaquera","nude","arena","topo","crema","hueso","piedra","tostado","caqui","khaki","plata","plateado","plateada","dorado","dorada","oro"]],
 ["estampado",["estampado","estampada","rayas","cuadros","flores","floral","print","leopardo","animal","lunares"]],
 ["rojo",["rojo","roja","granate","burdeos","vino","coral","teja"]],
 ["rosa",["rosa","fucsia","magenta","malva","salmon"]],
 ["naranja",["naranja","mostaza","calabaza","ocre"]],
 ["amarillo",["amarillo","amarilla","limon","vainilla"]],
 ["verde",["verde","oliva","militar","menta","esmeralda","botella","kaki","salvia"]],
 ["azul",["azul","celeste","turquesa","cobalto","anil","indigo"]],
 ["morado",["morado","morada","lila","violeta","berenjena","lavanda"]]
];
function colorInfo(text){
 const words=norm(text).split(/[^a-z]+/).filter(Boolean);
 for(const w of words)for(const [fam,list] of COLOR_WORDS)if(list.includes(w))return {fam,word:w};
 return {fam:"",word:""};
}
const GOOD_PAIRS=new Set(["azul|rosa","azul|amarillo","azul|naranja","azul|rojo","azul|verde","verde|rosa","verde|morado","morado|amarillo","rojo|rosa","naranja|verde"]);
function colorsMatch(a,b){
 if(!a.fam||!b.fam)return true;
 if(a.fam==="neutro"||b.fam==="neutro")return true;
 if(a.fam==="estampado"&&b.fam==="estampado")return false;
 if(a.fam==="estampado"||b.fam==="estampado")return true;
 if(a.fam===b.fam)return true;
 return GOOD_PAIRS.has([a.fam,b.fam].sort().join("|"));
}
const PAIRS={Arriba:["Abajo","Capas","Zapatos","Bolsos","Accesorios"],Abajo:["Arriba","Capas","Zapatos","Bolsos","Accesorios"],Vestidos:["Capas","Zapatos","Bolsos","Accesorios"],Capas:["Arriba","Abajo","Vestidos","Zapatos","Bolsos","Accesorios"],Zapatos:["Arriba","Abajo","Vestidos","Capas","Bolsos"],Bolsos:["Arriba","Abajo","Vestidos","Capas","Zapatos"],Accesorios:["Arriba","Abajo","Vestidos","Capas"]};
const CORE={Arriba:["Abajo"],Abajo:["Arriba"],Vestidos:["Zapatos","Capas"],Capas:["Arriba","Abajo","Vestidos"],Zapatos:["Abajo","Vestidos"],Bolsos:["Arriba","Abajo","Vestidos"],Accesorios:["Arriba","Abajo","Vestidos"]};
const STYLE_OK={casual:["casual","smart","sport"],smart:["smart","casual","party"],party:["party","smart"],sport:["sport","casual"]};
const styleNames={casual:"casual",smart:"arreglado",party:"fiesta",sport:"deporte"};
function pairs(a,b){
 if(a.id&&a.id===b.id)return false;
 if(a.category&&b.category&&!(PAIRS[a.category]||[]).includes(b.category))return false;
 if(!a.category&&!b.category)return false;
 if(a.style&&b.style&&!(STYLE_OK[a.style]||[]).includes(b.style))return false;
 if(a.season&&b.season&&a.season!=="all"&&b.season!=="all"&&a.season!==b.season)return false;
 return colorsMatch(colorInfo(a.color),colorInfo(b.color));
}
function isDuplicate(a,b){
 if(!a.category||a.category!==b.category)return false;
 const ca=colorInfo(a.color),cb=colorInfo(b.color);
 if(!ca.fam||!cb.fam)return false;
 const sameColor=ca.fam==="neutro"||ca.fam==="estampado"?ca.word===cb.word:ca.fam===cb.fam;
 return sameColor&&(!a.style||!b.style||a.style===b.style);
}
function evaluateCandidate(c){
 const gs=myGarments(),compatible=gs.filter(g=>pairs(c,g)),core=compatible.filter(g=>!c.category||(CORE[c.category]||[]).includes(g.category));
 const duplicates=gs.filter(g=>isDuplicate(c,g));
 const rescued=gs.filter(g=>pairs(c,g)&&gs.filter(o=>pairs(g,o)).length<2);
 const reasons=[];let verdict,tone;
 if(duplicates.length>=2){verdict="No lo necesitas";tone="bad";reasons.push("Ya tienes "+duplicates.length+" prendas muy parecidas.")}
 else if(core.length>=3&&!duplicates.length){verdict="Cómpralo";tone="good";reasons.push("Combina con "+compatible.length+" prendas de tu armario.")}
 else if(core.length>=3){verdict="Piénsalo";tone="mid";reasons.push("Encaja bien, pero se parece a «"+duplicates[0].name+"».")}
 else{verdict="Piénsalo";tone="mid";reasons.push(core.length?"Solo combina con "+core.length+" prenda"+(core.length>1?"s":"")+" clave de tu armario.":"Ahora mismo no tienes con qué combinarla"+(c.category&&CORE[c.category]?" (te faltaría: "+CORE[c.category].join(" o ").toLocaleLowerCase("es")+")":"")+".")}
 if(rescued.length)reasons.push("Daría salida a "+rescued.length+" prenda"+(rescued.length>1?"s":"")+" que ahora casi no combinas.");
 const p=appState.data.preferences,pending=appState.data.wishlist.filter(w=>!w.bought).reduce((s,w)=>s+(Number(w.price)||0),0);
 if(Number(c.price)>0&&Number(p.budget)>=0&&pending+Number(c.price)>Number(p.budget))reasons.push("Con tu wishlist pendiente superaría tu presupuesto de "+euro(p.budget)+".");
 if(!gs.length)reasons.push("Añade prendas a tu armario para que el veredicto sea fiable.");
 return {verdict,tone,reasons,compatible,core,duplicates,rescued};
}

let buyCheck=null;
const previousShowAuth=showAuth;
showAuth=function(){buyCheck=null;storedImages=new Map();previousShowAuth()};
const categoriesList=["Arriba","Abajo","Vestidos","Capas","Zapatos","Bolsos","Accesorios"];
function thumbs(list,max=12){
 if(!list.length)return "";
 return '<div class="thumb-row">'+list.slice(0,max).map(g=>'<button class="thumb" data-thumb="'+fx(g.id)+'" title="'+fx(g.name)+'"'+(validImage(g.image)?' style="background-image:url('+g.image+')"':'')+'><span>'+fx(g.name)+'</span></button>').join("")+(list.length>max?'<span class="muted thumb-more">+'+(list.length-max)+'</span>':'')+'</div>';
}
function buyCheckCard(){
 const c=buyCheck;
 let html='<div class="feature-card" id="buyCheck"><h2>¿Lo compro?</h2><p class="muted">Haz una foto a la prenda en la tienda o sube una captura. Te digo con qué combina de tu armario y si se parece a algo que ya tienes.</p>'+
  '<label class="field"><span>Foto de la prenda</span><input id="buyImage" type="file" accept="image/*"></label>';
 if(!c)return html+'</div>';
 if(c.loading)return html+'<p class="muted">Analizando la prenda…</p></div>';
 const r=evaluateCandidate(c);
 html+='<div class="buy-head">'+(validImage(c.image)?'<img class="buy-img" src="'+c.image+'" alt="Prenda que estás valorando">':'')+
  '<div class="buy-fields"><label class="field"><span>Nombre</span><input id="buyName" maxlength="80" value="'+fx(c.name)+'"></label>'+
  '<div class="filter-grid"><label class="field"><span>Categoría</span><select id="buyCategory">'+optionList([["","Sin categoría"],...categoriesList.map(x=>[x,x])],c.category)+'</select></label>'+
  '<label class="field"><span>Color</span><input id="buyColor" maxlength="60" value="'+fx(c.color)+'"></label>'+
  '<label class="field"><span>Estilo</span><select id="buyStyle">'+optionList([["","Sin definir"],...Object.entries(styleNames)],c.style)+'</select></label>'+
  '<label class="field"><span>Temporada</span><select id="buySeason">'+optionList(Object.entries(seasons),c.season||"all")+'</select></label>'+
  '<label class="field"><span>Precio (€)</span><input id="buyPrice" type="number" min="0" step=".01" inputmode="decimal" value="'+fx(c.price??"")+'"></label></div></div></div>'+
  (c.analyzeFailed?'<p class="error">No se pudo analizar la foto. Completa categoría y color a mano para ver el veredicto.</p>':'')+
  '<div class="verdict '+r.tone+'"><strong>'+fx(r.verdict)+'</strong>'+r.reasons.map(x=>'<p>'+fx(x)+'</p>').join("")+'</div>'+
  '<h3 class="mini-title">Combina con ('+r.compatible.length+')</h3>'+(r.compatible.length?thumbs(r.compatible):'<p class="muted">Ninguna prenda de tu armario.</p>')+
  (r.duplicates.length?'<h3 class="mini-title">Se parece a ('+r.duplicates.length+')</h3>'+thumbs(r.duplicates):'')+
  '<button class="secondary wide" id="buyLooks"'+(r.compatible.length?'':' disabled')+'>✦ Ver looks con la IA</button>'+
  (c.looks?c.looks.length?'<div class="grid buy-looks">'+c.looks.map(l=>{const gs=l.ids.map(id=>id==="__nueva__"?{name:c.name||"Prenda nueva",image:c.image}:myGarments().find(g=>g.id===id)).filter(Boolean);const imgs=gs.map(g=>g.image).filter(validImage);return '<article class="card">'+collage(imgs,imgs.length-4)+'<div class="card-body"><div class="card-title">'+fx(l.why)+'</div><div class="look-items">'+gs.map(g=>'<span class="look-chip">'+fx(g.name)+'</span>').join("")+'</div></div></article>'}).join("")+'</div>':'<p class="muted">La IA no ha propuesto looks con esta prenda. Prueba a cambiar la ocasión en Estilista.</p>':'')+
  '<p class="helper">El veredicto se calcula en tu móvil con reglas de color, categoría, estilo y temporada; es orientativo. Para los looks se envían solo los nombres y atributos, nunca las fotos.</p>'+
  '<div class="actions"><button class="secondary" id="buyWish">♡ A la wishlist</button><button class="primary" id="buyAdd">Lo he comprado</button></div>'+
  '<button class="secondary small wide" id="buyReset">Valorar otra prenda</button></div>';
 return html;
}
function readBuyFields(){
 if(!buyCheck||buyCheck.loading)return;
 buyCheck.name=$("#buyName")?.value.trim()||"";buyCheck.category=$("#buyCategory")?.value||"";buyCheck.color=$("#buyColor")?.value.trim()||"";
 buyCheck.style=$("#buyStyle")?.value||"";buyCheck.season=$("#buySeason")?.value||"all";
 const p=$("#buyPrice")?.value;buyCheck.price=p===""||p==null?null:Math.max(0,Number(p)||0);
}
async function startBuyCheck(file){
 let image;
 try{image=await readImage(file)}catch(e){return toast(e.message==="IMAGE_TOO_LARGE"?"La imagen es demasiado grande":"No se pudo leer la imagen")}
 if(!image)return;
 buyCheck={image,loading:true};render();
 const c={image,name:"",category:"",color:"",style:"",season:"all",price:null,looks:null,analyzeFailed:false};
 try{
  const out=await api("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image})});
  const d=out.garment||out.result||out,map={top:"Arriba",bottom:"Abajo",dress:"Vestidos",outerwear:"Capas",shoes:"Zapatos",bag:"Bolsos",accessory:"Accesorios"};
  c.name=String(d.name||"").slice(0,80);
  const cat=map[d.category]||d.category||map[d.type];if(categoriesList.includes(cat))c.category=cat;
  if(d.color)c.color=(Array.isArray(d.color)?d.color.join(", "):String(d.color)).slice(0,60);
  const st=d.style==="basic"?"casual":d.style;if(STYLE_OK[st])c.style=st;
  if(seasons[d.season])c.season=d.season;
 }catch(e){console.error("BUY_ANALYZE",e);c.analyzeFailed=true;if(e.message==="SESSION_EXPIRED"){buyCheck=null;return}}
 if(buyCheck?.image===image){buyCheck=c;render();$("#buyCheck")?.scrollIntoView({block:"start",behavior:"smooth"})}
}
async function buyLooks(){
 readBuyFields();const c=buyCheck;if(!c)return;
 const btn=$("#buyLooks");if(btn){btn.disabled=true;btn.textContent="Pensando…"}
 const r=evaluateCandidate(c),p=appState.data.preferences;
 const items=[{i:"__nueva__",n:c.name||"Prenda nueva",c:c.category,color:c.color,style:c.style,used:0,forgotten:false},
  ...r.compatible.slice(0,20).map(g=>({i:g.id,n:g.name,c:g.category||"",color:g.color||"",style:g.style||"",used:wornCount(g.id),forgotten:false}))];
 try{
  const out=await api("/api/looks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items,need:3,occasion:p.occasion||"daily",season:c.season||"all",weather:p.temperature==null||p.temperature===""?"sin dato":String(p.temperature)+" °C",diversity:p.diversity??65,avoid:[]})});
  const allowed=new Set(items.map(x=>x.i));
  c.looks=(Array.isArray(out.looks)?out.looks:[]).map(l=>({why:String(l.why||"Look sugerido").slice(0,80),ids:[...new Set(Array.isArray(l.ids)?l.ids:[])].filter(id=>allowed.has(id)).slice(0,6)})).filter(l=>l.ids.includes("__nueva__")&&l.ids.length>=2);
 }catch(e){console.error("BUY_LOOKS",e);toast(e.message==="SESSION_EXPIRED"?"La sesión ha caducado":"No se pudieron generar looks");return}
 if(buyCheck===c)render();
}
const previousShopping=renderShopping;
renderShopping=function(root){
 previousShopping(root);
 $(".hero",root)?.insertAdjacentHTML("afterend",buyCheckCard());
 $("#buyImage")?.addEventListener("change",e=>{const f=e.target.files[0];if(f)startBuyCheck(f)});
 for(const id of ["buyName","buyColor","buyPrice"])$("#"+id)?.addEventListener("change",()=>{readBuyFields();buyCheck.looks=null;render()});
 for(const id of ["buyCategory","buyStyle","buySeason"])$("#"+id)?.addEventListener("change",()=>{readBuyFields();buyCheck.looks=null;render()});
 $("#buyLooks")?.addEventListener("click",buyLooks);
 $("#buyReset")?.addEventListener("click",()=>{buyCheck=null;render()});
 $$("[data-thumb]",root).forEach(b=>b.addEventListener("click",()=>openGarment(b.dataset.thumb)));
 $("#buyWish")?.addEventListener("click",async()=>{readBuyFields();const c=buyCheck,r=evaluateCandidate(c);
  await mutate(()=>appState.data.wishlist.unshift({id:uid(),name:c.name||"Prenda sin nombre",price:Number(c.price)||0,category:c.category,url:"",bought:false,addedAt:dayISO(),verdict:r.verdict}),"Añadida a la wishlist")});
 $("#buyAdd")?.addEventListener("click",async()=>{readBuyFields();const c=buyCheck;if(!validImage(c.image))return;
  if(!confirm("¿Añadir esta prenda a tu armario?"))return;
  const now=new Date().toISOString(),id=uid();
  const ok=await mutate(()=>appState.data.garments.unshift({id,name:c.name||"Prenda nueva",category:c.category,color:c.color,notes:"",season:c.season||"all",style:c.style,price:c.price,boughtAt:dayISO(),favorite:false,createdAt:now,image:c.image,updatedAt:now}),"Prenda añadida a tu armario");
  if(ok){buyCheck=null;render()}});
};

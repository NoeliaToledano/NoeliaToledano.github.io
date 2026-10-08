/* Atelier · Mi Armario — app web (PWA) para 3 perfiles familiares.
   Un solo archivo, sin capas de parches. Secciones:
   1. Configuración y utilidades       7. Estilista (looks IA, combinar prenda, tiempo)
   2. Almacenamiento local (IndexedDB) 8. Compras (¿Lo compro?, recomendaciones, wishlist)
   3. Sincronización con el servidor   9. Análisis y calendario
   4. API y ahorro de tokens          10. Ajustes y copias de seguridad
   5. Sesión y navegación             11. Arranque
   6. Armario, prendas y looks
   Prioridad del proyecto: gastar pocos tokens de OpenAI. Lo que se pueda calcular aquí no va a la IA. */

/* ===================== 1. Configuración y utilidades ===================== */
const API_BASE="https://atelier-ai-backend-pi.vercel.app";
const PROFILES=[{id:"noelia",name:"Noelia"},{id:"ana-maria",name:"Ana María"},{id:"irene",name:"Irene"},{id:"eva",name:"Eva"},{id:"virginia",name:"Virginia"}];
const DB_NAME="atelier-armario-db",DB_VERSION=2,STORE="kv";
const IMAGE_MAX=900,IMAGE_QUALITY=.8,AI_IMAGE_MAX=512;
const AI_LIMITS={analyze:40,looks:20},DEFAULT_TEMPERATURE=25;
const CATEGORIES=["Arriba","Abajo","Vestidos","Capas","Zapatos","Bolsos","Accesorios"];
const occasions={daily:"Día a día",work:"Trabajo",dinner:"Cena",event:"Evento",travel:"Viaje"};
const seasons={all:"Todo el año",warm:"Primavera / verano",cold:"Otoño / invierno"};
const styleNames={casual:"casual",smart:"arreglado",party:"fiesta",sport:"deporte"};
const ANALYSIS_FIELDS={pattern:["plain","stripes","checks","floral","animal","dots","graphic","other"],fabric:["unknown","cotton","denim","linen","wool","knit","leather","satin","silk","synthetic","mixed"],length:["na","cropped","regular","midi","long"],formality:["casual","smartcasual","formal","party","sport"]};

const emptyData=()=>({garments:[],looks:[],wishlist:[],wearLog:[],trips:[],feedback:{},deleted:{},preferences:{forgottenDays:60,diversity:65,occasion:"daily",season:"all",budget:100,avoidRepeats:true,temperature:DEFAULT_TEMPERATURE}});
function normalizeData(v){
 const d=emptyData();if(!v||typeof v!=="object")return d;
 for(const key of ["garments","looks","wishlist","wearLog","trips"])if(Array.isArray(v[key]))d[key]=v[key].filter(x=>x&&typeof x==="object"&&x.id);
 for(const key of ["feedback","deleted"])if(v[key]&&typeof v[key]==="object"&&!Array.isArray(v[key]))d[key]=v[key];
 if(v.preferences&&typeof v.preferences==="object")d.preferences={...d.preferences,...v.preferences};
 return d;
}
const copyData=d=>structuredClone(d);
const appState={profile:null,token:null,data:emptyData(),view:"wardrobe",authExpired:false};
let lastSavedData=emptyData();
const ui={search:"",category:"",season:"",onlyFavorites:false,onlyForgotten:false,sort:"recent",calendarMonth:new Date().toISOString().slice(0,7),lookFilter:"all",wishlistFilter:"all",stylistTab:"today",shopTab:"buy",aroundId:"",tripId:""};

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
function uid(){return crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
const fx=v=>esc(v==null?"":v);
function toast(msg){const n=$("#toast");n.textContent=msg;n.classList.remove("hidden");clearTimeout(toast.t);toast.t=setTimeout(()=>n.classList.add("hidden"),2600)}
const dayISO=(date=new Date())=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10);
function shiftDay(n){const d=new Date();d.setDate(d.getDate()+n);return dayISO(d)}
const euro=n=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(n)||0);
const validDay=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+"T12:00:00"));
const validImage=v=>typeof v==="string"&&/^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(v);
function daysSince(iso){const t=Date.parse(iso||"");return Number.isNaN(t)?null:Math.floor((Date.now()-t)/86400000)}
const norm=s=>String(s||"").toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g,"");
const plural=(n,one,many)=>n+" "+(n===1?one:many);
function optionList(values,current){return values.map(v=>'<option value="'+fx(v[0])+'"'+(String(current)===String(v[0])?' selected':'')+'>'+fx(v[1])+'</option>').join("")}
function heroHtml(title,subtitle){return '<section class="hero"><h1>'+fx(title)+'</h1><p>'+fx(subtitle)+'</p></section>'}
function miniStat(label,value){return '<div class="stat"><strong>'+fx(value)+'</strong><span class="muted">'+fx(label)+'</span></div>'}
function tabsHtml(name,tabs,current){return '<div class="seg-tabs" role="tablist">'+tabs.map(([id,label,extra])=>'<button type="button" role="tab" class="seg-tab'+(id===current?' active':'')+'" data-'+name+'-tab="'+id+'"'+(extra||'')+' aria-selected="'+(id===current)+'">'+fx(label)+'</button>').join("")+'</div>'}
/* Ficha de características de cada prenda: la IA propone, la persona revisa y corrige.
   [clave, etiqueta, opciones (lista) o longitud máxima (número), origen: "ia" o "manual"] */
const META_FIELDS=[
 ["subtype","Tipo concreto (ej. blazer, vaquero)",80,"ia"],
 ["pattern","Estampado",ANALYSIS_FIELDS.pattern,"ia"],
 ["secondaryColor","Color secundario",60,"ia"],
 ["fabric","Tejido aparente",ANALYSIS_FIELDS.fabric,"ia"],
 ["fit","Corte",["oversize","holgado","regular","entallado","ajustado","recto"],"ia"],
 ["length","Largo",ANALYSIS_FIELDS.length,"ia"],
 ["sleeve","Manga",["sin mangas","corta","tres cuartos","larga","no aplica"],"ia"],
 ["neckline","Escote / cuello",["redondo","pico","camisero","alto","barco","palabra de honor","no aplica"],"ia"],
 ["thickness","Grosor",["ligero","medio","grueso"],"ia"],
 ["warmth","Cuánto abriga",["bajo","medio","alto"],"ia"],
 ["formality","Formalidad",ANALYSIS_FIELDS.formality,"ia"],
 ["details","Detalles visibles",180,"ia"],
 ["brand","Marca",80,"manual"],["size","Talla",35,"manual"],["composition","Composición de la etiqueta",140,"manual"]
];
const META_LABELS={
 pattern:{plain:"Liso",stripes:"Rayas",checks:"Cuadros",floral:"Flores",animal:"Animal print",dots:"Lunares",graphic:"Gráfico",other:"Otro"},
 fabric:{unknown:"No se distingue",cotton:"Algodón",denim:"Vaquero",linen:"Lino",wool:"Lana",knit:"Punto",leather:"Piel",satin:"Satén",silk:"Seda",synthetic:"Sintético",mixed:"Mezcla"},
 length:{na:"No aplica",cropped:"Corto",regular:"Normal",midi:"Midi",long:"Largo"},
 formality:{casual:"Informal",smartcasual:"Arreglado informal",formal:"Formal",party:"Fiesta",sport:"Deporte"}
};
const metaLabel=(key,v)=>META_LABELS[key]?.[v]||(v?v[0].toUpperCase()+v.slice(1):"");
const metaValue=(def,v)=>Array.isArray(def[2])?(def[2].includes(v)?v:""):(typeof v==="string"?v.trim().slice(0,def[2]):"");
const CONFIDENCE=["alta","media","baja"];
/* Solo los campos que puede estimar la IA (nunca marca, talla ni composición) */
function cleanAnalysis(d){
 const o={};
 for(const def of META_FIELDS)if(def[3]==="ia"){const v=metaValue(def,d?.[def[0]]);if(v)o[def[0]]=v}
 if(Array.isArray(d?.occasions)){const occ=d.occasions.filter(x=>occasions[x]);if(occ.length)o.occasions=[...new Set(occ)]}
 if(CONFIDENCE.includes(d?.confidence))o.confidence=d.confidence;
 return o;
}
const isStandalone=()=>{try{return matchMedia("(display-mode: standalone)").matches||navigator.standalone===true}catch{return false}};
const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);

/* Datos del perfil activo */
const myGarments=()=>appState.data.garments;
const myLooks=()=>appState.data.looks;
const logs=()=>appState.data.wearLog;
function tomb(id){appState.data.deleted[id]=new Date().toISOString()}
const wornCount=id=>logs().filter(l=>Array.isArray(l.garmentIds)&&l.garmentIds.includes(id)).length;
const lastWorn=id=>logs().filter(l=>Array.isArray(l.garmentIds)&&l.garmentIds.includes(id)&&validDay(l.date)).map(l=>l.date).sort().at(-1)||null;
const dayAge=d=>validDay(d)?Math.max(0,Math.floor((new Date(dayISO()+"T12:00:00")-new Date(d+"T12:00:00"))/86400000)):null;
const thisSeason=()=>[3,4,5,6,7,8,9].includes(new Date().getMonth())?"warm":"cold";
const notInSeason=g=>g.season&&g.season!=="all"&&g.season!==thisSeason();
function forgottenStatus(g){
 const last=lastWorn(g.id),d=last||String(g.createdAt||"").slice(0,10),age=dayAge(d),threshold=Number(appState.data.preferences.forgottenDays)||60;
 if(age===null||notInSeason(g))return {forgotten:false,age,reason:notInSeason(g)?"Fuera de temporada":"Sin fecha de referencia"};
 return {forgotten:age>=threshold,age,reason:last?"Desde el último uso":"Sin usos registrados desde que la añadiste"};
}
function recommendGarments(){
 const diversity=(Number(appState.data.preferences.diversity)||65)/100,score=g=>(g.favorite?1:0)+diversity*(8/(1+wornCount(g.id)))+(forgottenStatus(g).forgotten?4:0);
 return myGarments().slice().sort((a,b)=>score(b)-score(a));
}
function currentTemperature(){const t=appState.data.preferences.temperature;return t==null||t===""||!Number.isFinite(Number(t))?DEFAULT_TEMPERATURE:Number(t)}

/* ===================== 2. Almacenamiento local (IndexedDB) ===================== */
let dbPromise=null;
function openDB(){if(dbPromise)return dbPromise;dbPromise=new Promise((res,rej)=>{const q=indexedDB.open(DB_NAME,DB_VERSION);q.onupgradeneeded=()=>{const d=q.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE)};q.onsuccess=()=>{const db=q.result;db.onversionchange=()=>{db.close();dbPromise=null};res(db)};q.onerror=()=>rej(q.error);q.onblocked=()=>rej(new Error("DB_BLOCKED"))}).catch(e=>{dbPromise=null;throw e});return dbPromise}
async function dbGet(key){const d=await openDB();return new Promise((res,rej)=>{const q=d.transaction(STORE).objectStore(STORE).get(key);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
async function dbSet(key,val){const d=await openDB();return new Promise((res,rej)=>{const tx=d.transaction(STORE,"readwrite");tx.objectStore(STORE).put(val,key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
async function dbBatch(puts,dels){const d=await openDB();return new Promise((res,rej)=>{const tx=d.transaction(STORE,"readwrite"),st=tx.objectStore(STORE);for(const [k,v] of puts)st.put(v,k);for(const k of dels)st.delete(k);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error("TX_ABORT"))})}
const stateKey=()=>`state:${appState.profile.id}`;
const imgKey=id=>"img:"+appState.profile.id+":"+id;
let storedImages=new Map();
const slimData=d=>({...d,garments:d.garments.map(g=>{const {image,...rest}=g;return {...rest,hasImage:validImage(image)||!!rest.hasImage}})});

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
function readImage(file){
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
}
async function loadState(){
 appState.data=emptyData();storedImages=new Map();let migrate=false;
 try{
  const data=normalizeData(await dbGet(stateKey()));
  await Promise.all(data.garments.map(async g=>{
   // Formato antiguo: la foto venía dentro del estado; se reduce y se guarda aparte.
   if(validImage(g.image)){migrate=true;g.image=await shrinkDataUrl(g.image);return}
   if(g.hasImage){try{const img=await dbGet(imgKey(g.id));if(validImage(img)){g.image=img;storedImages.set(g.id,img)}}catch(e){console.error("IMG_LOAD",e)}}
  }));
  appState.data=data;
 }catch(e){console.error("DB_LOAD",e);toast("No se pudo cargar el armario")}
 finally{lastSavedData=copyData(appState.data)}
 if(migrate)await saveState({quiet:true});
}
/* Guarda el estado (sin fotos) y las fotos por separado. Si falla, vuelve al último estado guardado. */
async function saveState(opts={}){
 const d=appState.data;
 try{
  const ids=new Set(d.garments.map(g=>g.id)),puts=[],dels=[];
  for(const g of d.garments)if(validImage(g.image)&&storedImages.get(g.id)!==g.image)puts.push([imgKey(g.id),g.image]);
  for(const id of storedImages.keys())if(!ids.has(id))dels.push(imgKey(id));
  if(puts.length||dels.length)await dbBatch(puts,dels);
  await dbSet(stateKey(),slimData(d));
  storedImages=new Map(d.garments.filter(g=>validImage(g.image)).map(g=>[g.id,g.image]));
  lastSavedData=copyData(d);
  if(!opts.fromSync)markDirty();
  return true;
 }catch(e){
  console.error("DB_SAVE",e);appState.data=copyData(lastSavedData);if(appState.profile)render();
  toast("No se pudo guardar. Comprueba el espacio disponible.");return false;
 }
}
async function mutate(action,success){action();if(await saveState()){render();if(success)toast(success);return true}return false}
async function setPref(key,val,rerender=true){appState.data.preferences[key]=val;if(await saveState()&&rerender)render()}
const storageInfo={persisted:null};
async function ensurePersistence(){
 try{
  if(!navigator.storage?.persisted)return;
  let ok=await navigator.storage.persisted();
  if(!ok&&navigator.storage.persist)ok=await navigator.storage.persist();
  storageInfo.persisted=ok;
 }catch{storageInfo.persisted=false}
}

/* ===================== 3. Sincronización con el servidor =====================
   El armario se guarda también en el backend (Upstash Redis vía /api/sync), así no depende de un solo móvil.
   - Cada cambio local marca "pendiente" y se sube a los pocos segundos.
   - Si otro dispositivo cambió el servidor a la vez, se fusionan ambos lados (gana la versión más reciente
     de cada prenda/look; lo borrado en cualquiera de los dos queda borrado).
   - Las fotos se suben y descargan una a una por /api/sync-image.
   - Si el servidor no tiene la base de datos configurada, la app sigue funcionando solo en local. */
const freshSync=()=>({rev:0,dirty:false,ever:false,lastAt:null,imgs:{},status:"idle",error:""});
/* sync: estado del perfil activo. syncGen cambia en cada inicio/cierre de sesión: una sincronización
   que empezó con otra sesión se cancela sola. editSeq cuenta los cambios locales para no perder
   ninguno que ocurra mientras una subida está en curso. */
let sync=freshSync(),syncTimer=null,syncRunning=false,syncAgain=false,syncGen=0,editSeq=0;
async function loadSyncMeta(){
 let m=null;try{m=await dbGet("sync:"+appState.profile.id)}catch{}
 sync={...freshSync(),...(m||{}),status:"idle",error:""};
 if(!sync.imgs||typeof sync.imgs!=="object")sync.imgs={};
}
async function saveSyncMeta(profile=appState.profile?.id,s=sync){if(!profile)return;try{await dbSet("sync:"+profile,{rev:s.rev,dirty:s.dirty,ever:s.ever,lastAt:s.lastAt,imgs:s.imgs})}catch(e){console.warn("SYNC_META",e)}}
function markDirty(){if(!appState.profile)return;editSeq++;sync.dirty=true;saveSyncMeta();scheduleSync(2500)}
function resetSyncSession(){syncGen++;clearTimeout(syncTimer);syncAgain=false}
function scheduleSync(ms){clearTimeout(syncTimer);if(sync.status==="off")return;syncTimer=setTimeout(()=>syncNow(),ms)}
async function syncFetch(path,options={},token=appState.token){
 const headers={...(options.headers||{})};if(token)headers.Authorization="Bearer "+token;
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),25000);
 try{
  const r=await fetch(API_BASE+path,{...options,headers,signal:ctrl.signal});let body={};try{body=await r.json()}catch{}
  if(r.status===401){if(token===appState.token)showAuth();throw new Error("SESSION_EXPIRED")}
  return {status:r.status,body};
 }finally{clearTimeout(timer)}
}
function mergeLists(local,remote,deleted){
 const out=new Map();
 for(const x of remote)if(x?.id&&!deleted[x.id])out.set(x.id,x);
 for(const x of local){if(!x?.id||deleted[x.id])continue;const r=out.get(x.id);if(!r||String(x.updatedAt||"")>=String(r.updatedAt||""))out.set(x.id,x)}
 const order=[...local.map(x=>x?.id),...remote.map(x=>x?.id)];
 return [...new Set(order)].filter(id=>out.has(id)).map(id=>out.get(id));
}
function mergeData(local,remote){
 const deleted={...(remote.deleted||{}),...(local.deleted||{})},cutoff=new Date(Date.now()-90*86400000).toISOString();
 for(const [id,at] of Object.entries(deleted))if(String(at)<cutoff)delete deleted[id];
 const m=normalizeData({...local,deleted});
 for(const key of ["garments","looks","wishlist","wearLog","trips"])m[key]=mergeLists(local[key]||[],remote[key]||[],deleted);
 m.feedback={...(remote.feedback||{}),...(local.feedback||{})};
 m.preferences={...(remote.preferences||{}),...(local.preferences||{})};
 return m;
}
/* Cada foto lleva una versión (imageAt): cambia al sustituir la foto, así se sube y descarga de nuevo. */
const imgVer=g=>String(g.imageAt||"0");
function reuseLocalImages(data,local){
 const byId=new Map(local.garments.map(g=>[g.id,g]));
 for(const g of data.garments){if(validImage(g.image))continue;const l=byId.get(g.id);if(l&&validImage(l.image)&&imgVer(l)===imgVer(g))g.image=l.image}
}
async function downloadImages(data,serverImages,call,s){
 const missing=data.garments.filter(g=>!validImage(g.image)&&serverImages.has(g.id));
 if(missing.length>3)toast("Descargando "+missing.length+" fotos de tu armario…");
 for(const g of missing){
  const r=await call("/api/sync-image?id="+encodeURIComponent(g.id));
  if(r.status===200&&validImage(r.body.image)){g.image=r.body.image;s.imgs[g.id]=imgVer(g)}
 }
}
async function uploadImages(serverImages,call,s){
 for(const g of myGarments()){
  if(!validImage(g.image))continue;
  const v=imgVer(g),image=g.image,id=g.id;
  if(serverImages.has(id)&&s.imgs[id]===v)continue;
  const r=await call("/api/sync-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,image})});
  if(r.status!==200)throw new Error(r.body.error||"SYNC_IMG_"+r.status);
  serverImages.add(id);s.imgs[id]=v;
 }
 const ids=new Set(myGarments().map(g=>g.id));for(const id of Object.keys(s.imgs))if(!ids.has(id))delete s.imgs[id];
}
let syncChangedView=false;
async function applyFromServer(data){
 // Preferencias propias de este dispositivo que no deben venir de otro.
 const local=appState.data.preferences,keep={aiUsage:local.aiUsage,installHintHidden:local.installHintHidden,lastBackupAt:local.lastBackupAt};
 data.preferences={...data.preferences,...Object.fromEntries(Object.entries(keep).filter(x=>x[1]!==undefined))};
 appState.data=data;syncChangedView=true;
 return saveState({fromSync:true});
}
const SYNC_STALE="SYNC_STALE";
async function syncNow(){
 if(!appState.profile||!appState.token)return;
 if(syncRunning){syncAgain=true;return}
 syncRunning=true;
 // Todo lo de esta sincronización usa la sesión con la que empezó; si cambia, se cancela.
 const gen=syncGen,profile=appState.profile.id,token=appState.token,s=sync;
 const alive=()=>gen===syncGen&&appState.profile?.id===profile&&appState.token===token;
 const call=async(path,options)=>{if(!alive())throw new Error(SYNC_STALE);const r=await syncFetch(path,options,token);if(!alive())throw new Error(SYNC_STALE);return r};
 s.status="syncing";
 try{
  for(let attempt=0;attempt<3;attempt++){
   const seqStart=editSeq;syncChangedView=false;
   const g=await call("/api/sync");
   if(g.status===503){s.status="off";s.error=g.body.error||"";return}
   if(g.status!==200)throw new Error(g.body.error||"SYNC_"+g.status);
   const serverRev=Number(g.body.rev)||0,serverData=g.body.data?normalizeData(g.body.data):null,serverImages=new Set(Array.isArray(g.body.images)?g.body.images:[]);
   const local=appState.data,localHasData=local.garments.length||local.looks.length||local.wishlist.length||local.wearLog.length||local.trips.length;
   let incoming=null,needPush=false;
   if(!serverData)needPush=!!localHasData||s.dirty;
   else if(!s.ever){incoming=localHasData?mergeData(local,serverData):serverData;needPush=!!localHasData}  // primera vez en este dispositivo
   else if(serverRev!==s.rev){incoming=s.dirty?mergeData(local,serverData):serverData;needPush=s.dirty}
   else needPush=s.dirty;
   if(incoming){
    reuseLocalImages(incoming,local);
    await downloadImages(incoming,serverImages,call,s);
    if(editSeq!==seqStart)continue;  // hubo cambios mientras se descargaba: se vuelve a fusionar con ellos
    if(!alive())throw new Error(SYNC_STALE);
    await applyFromServer(incoming);
   }
   s.ever=true;s.rev=serverRev;
   const pushSeq=editSeq;
   await uploadImages(serverImages,call,s);
   if(needPush){
    const p=await call("/api/sync",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({baseRev:serverRev,data:slimData(appState.data)})});
    if(p.status===409)continue;
    if(p.status!==200)throw new Error(p.body.error||"SYNC_PUT_"+p.status);
    s.rev=Number(p.body.rev)||serverRev+1;
   }
   // Solo queda al día si nadie editó durante la subida; si no, se repite enseguida.
   if(editSeq===pushSeq)s.dirty=false;else syncAgain=true;
   s.lastAt=new Date().toISOString();s.status="ok";s.error="";
   await saveSyncMeta(profile,s);
   if(!alive())return;
   // Solo se redibuja si llegaron cambios de otro dispositivo (así no se pierde lo que estés escribiendo).
   if(syncChangedView){syncChangedView=false;render()}else{const st=$("#syncStatus");if(st)st.textContent=syncStatusText()}
   return;
  }
  throw new Error("SYNC_CONFLICT");
 }catch(e){
  if(e.message===SYNC_STALE){s.status="idle";return}
  if(e.message==="SESSION_EXPIRED")return;
  console.warn("SYNC",e);s.status="error";s.error=e.name==="AbortError"||e instanceof TypeError?"Sin conexión":String(e.message||e);
  await saveSyncMeta(profile,s);if(alive())scheduleSync(60000);
 }finally{
  syncRunning=false;
  if(syncAgain&&appState.profile){syncAgain=false;scheduleSync(500)}
 }
}
function syncStatusText(){
 if(sync.status==="off")return "La sincronización no está activada en el servidor. Tus datos solo están en este dispositivo.";
 if(sync.status==="syncing")return "Sincronizando…";
 if(sync.status==="error")return "No se pudo sincronizar ("+sync.error+"). Lo reintentaré automáticamente.";
 if(sync.lastAt){const m=Math.round((Date.now()-Date.parse(sync.lastAt))/60000);return "Sincronizado "+(m<1?"hace un momento":m<60?"hace "+plural(m,"minuto","minutos"):"hace "+plural(Math.round(m/60),"hora","horas"))+(sync.dirty?" · hay cambios pendientes":"")+"."}
 return "Pendiente de la primera sincronización.";
}

/* ===================== 4. API y ahorro de tokens ===================== */
async function rawApi(path,options={}){
 const headers={...(options.headers||{})};if(appState.token)headers.Authorization=`Bearer ${appState.token}`;
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),20000);
 try{
  const r=await fetch(API_BASE+path,{...options,headers,signal:ctrl.signal});let body={};try{body=await r.json()}catch{}
  if(r.status===401&&path!=="/api/login"){showAuth();throw new Error("SESSION_EXPIRED")}
  if(!r.ok)throw new Error(body.error||`HTTP_${r.status}`);
  return body;
 }finally{clearTimeout(timer)}
}
function aiUsage(){const p=appState.data.preferences,today=dayISO();if(!p.aiUsage||p.aiUsage.day!==today)p.aiUsage={day:today,analyze:0,looks:0};return p.aiUsage}
async function sha(text){try{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}catch{return text.length+":"+text.slice(-64)}}
const analyzeCache=new Map();
/* Todas las llamadas a ChatGPT pasan por aquí: foto a 512 px, caché de análisis, IDs cortos,
   sin campos vacíos, máximo 24 prendas y límite diario por perfil. */
async function api(path,options={}){
 const kind=path==="/api/analyze"?"analyze":path==="/api/looks"?"looks":null;
 if(!kind||!appState.profile)return rawApi(path,options);
 let body;try{body=JSON.parse(options.body||"{}")}catch{return rawApi(path,options)}
 let cacheKey=null,toLong=null;
 if(kind==="analyze"){
  if(typeof body.image==="string")body.image=await shrinkDataUrl(body.image,AI_IMAGE_MAX);
  cacheKey=await sha(body.image||"");
  if(analyzeCache.has(cacheKey))return structuredClone(analyzeCache.get(cacheKey));
 }else{
  const toShort=new Map();toLong=new Map();
  body.items=(Array.isArray(body.items)?body.items:[]).slice(0,24).map((it,k)=>{
   const s=String(k+1);toShort.set(String(it.i),s);toLong.set(s,String(it.i));
   const o={i:s,n:String(it.n||"").slice(0,40)};
   for(const f of ["c","color","style","pattern","formality"])if(it[f]&&it[f]!=="plain")o[f]=it[f];
   if(it.forgotten)o.forgotten=1;return o;
  });
  const short=a=>(Array.isArray(a)?a:[]).map(String).filter(x=>toShort.has(x)).map(x=>toShort.get(x));
  body.avoid=short(body.avoid);
  body.liked=(Array.isArray(body.liked)?body.liked:[]).map(short).filter(l=>l.length>=2).slice(0,4);
  body.disliked=(Array.isArray(body.disliked)?body.disliked:[]).map(short).filter(l=>l.length>=2).slice(0,4);
  if(!body.weather||body.weather==="sin dato")body.weather=DEFAULT_TEMPERATURE+" °C";
  delete body.diversity;
 }
 const usage=aiUsage();
 if(usage[kind]>=AI_LIMITS[kind]){
  setTimeout(()=>toast(kind==="analyze"?"Has llegado al límite de "+AI_LIMITS.analyze+" análisis de hoy. Mañana podrás seguir.":"Has llegado al límite de "+AI_LIMITS.looks+" sugerencias de hoy. Mañana podrás seguir."),80);
  throw new Error("AI_QUOTA");
 }
 const out=await rawApi(path,{...options,body:JSON.stringify(body)});
 usage[kind]++;saveState({fromSync:true});
 if(kind==="analyze"){analyzeCache.set(cacheKey,structuredClone(out));if(analyzeCache.size>30)analyzeCache.delete(analyzeCache.keys().next().value);return out}
 if(Array.isArray(out?.looks))out.looks=out.looks.map(l=>({...l,ids:(Array.isArray(l.ids)?l.ids:[]).map(String).filter(id=>toLong.has(id)).map(id=>toLong.get(id))}));
 return out;
}
function mapAnalysis(d){
 const map={top:"Arriba",bottom:"Abajo",dress:"Vestidos",outerwear:"Capas",shoes:"Zapatos",bag:"Bolsos",accessory:"Accesorios"};
 const cat=map[d.category]||d.category||map[d.type],st=d.style==="basic"?"casual":d.style;
 return {name:String(d.name||"").slice(0,80),category:CATEGORIES.includes(cat)?cat:"",color:d.color?(Array.isArray(d.color)?d.color.join(", "):String(d.color)).slice(0,60):"",style:STYLE_OK[st]?st:"",season:seasons[d.season]?d.season:"",notes:d.notes?String(d.notes).slice(0,500):"",...cleanAnalysis(d)};
}

/* ===================== 5. Sesión y navegación ===================== */
function showAuth(){
 resetSyncSession();
 appState.profile=null;appState.token=null;appState.data=emptyData();lastSavedData=emptyData();appState.view="wardrobe";
 buyCheck=null;storedImages=new Map();ui.aroundId="";
 $("#content").replaceChildren();$("#profileName").textContent="";$("#garmentForm").reset();$("#lookForm").reset();$("#lookGarments").replaceChildren();
 $("#garmentSheet").classList.add("hidden");$("#lookSheet").classList.add("hidden");$$("#wearSheet").forEach(x=>x.remove());
 try{localStorage.removeItem("atelier-session")}catch{}
 $("#auth").classList.remove("hidden");$("#app").classList.add("hidden");$("#passwordStep").classList.add("hidden");$("#password").value="";setPasswordVisible(false);$("#authError").textContent="";
 $$(".profile-option").forEach(x=>{x.classList.remove("selected");x.setAttribute("aria-pressed","false")});
}
/* Botón «Mostrar/Ocultar» de la contraseña; al cerrar sesión vuelve a ocultarse */
function setPasswordVisible(visible){
 const input=$("#password"),btn=$("#togglePassword");if(!input)return;
 input.type=visible?"text":"password";
 if(btn){btn.textContent=visible?"Ocultar":"Mostrar";btn.setAttribute("aria-pressed",String(visible));btn.setAttribute("aria-label",visible?"Ocultar contraseña":"Mostrar contraseña")}
}
function selectProfile(id){appState.profile=PROFILES.find(p=>p.id===id);$$(".profile-option").forEach(x=>{const on=x.dataset.profile===id;x.classList.toggle("selected",on);x.setAttribute("aria-pressed",String(on))});setPasswordVisible(false);$("#passwordStep").classList.remove("hidden");$("#password").focus()}
async function login(){
 if(!appState.profile||$("#loginBtn").disabled)return;
 const profileId=appState.profile.id,btn=$("#loginBtn"),err=$("#authError");err.textContent="";btn.disabled=true;$$(".profile-option").forEach(b=>b.disabled=true);btn.textContent="Entrando…";
 try{
  const out=await rawApi("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profileId,password:$("#password").value})});
  const token=out.token||out.accessToken;
  if(!token||out.profileId!==profileId||appState.profile?.id!==profileId)throw new Error("LOGIN_IDENTITY_MISMATCH");
  appState.token=token;try{localStorage.setItem("atelier-session",JSON.stringify({profile:profileId,token}))}catch{}
  await enterApp();
 }catch(e){console.error("LOGIN",e);err.textContent=e.name==="AbortError"?"La conexión está tardando demasiado.":e.message==="LOGIN_IDENTITY_MISMATCH"?"No se pudo verificar el perfil.":"No se ha podido iniciar sesión. Revisa la contraseña."}
 finally{btn.disabled=false;$$(".profile-option").forEach(b=>b.disabled=false);btn.textContent="Entrar"}
}
async function enterApp(){
 appState.authExpired=false;resetSyncSession();
 await loadState();await loadSyncMeta();
 const p=appState.data.preferences;
 // Una vez por perfil: las temperaturas antiguas escritas a mano pasan a 25 °C.
 if(p.tempDefault25!==true){if(!p.autoWeather)p.temperature=DEFAULT_TEMPERATURE;p.tempDefault25=true;await saveState({fromSync:true})}
 $("#auth").classList.add("hidden");$("#app").classList.remove("hidden");$("#profileName").textContent=appState.profile.name;
 render();
 await ensurePersistence();
 syncNow();
 refreshWeatherIfNeeded();
}
async function restoreSession(){
 try{sessionStorage.removeItem("atelier-session")}catch{}
 let s=null;try{s=JSON.parse(localStorage.getItem("atelier-session")||"null")}catch{}
 try{
  if(!s?.profile||!s?.token)return false;
  const p=PROFILES.find(x=>x.id===s.profile);if(!p)return false;
  appState.profile=p;appState.token=s.token;
  const check=await rawApi("/api/session");
  if(!check.authenticated||check.profileId!==p.id)throw new Error("SESSION_INVALID");
  await enterApp();return true;
 }catch(e){
  // Sin conexión: se entra igualmente con los datos locales.
  if(appState.token&&appState.profile&&e.message!=="SESSION_INVALID"&&e.message!=="SESSION_EXPIRED"){try{await enterApp();return true}catch{}}
  try{localStorage.removeItem("atelier-session")}catch{}
  appState.profile=null;appState.token=null;return false;
 }
}
const NAV_PARENT={looks:"stylist",calendar:"insights"};
function setView(v){
 appState.view=v;
 $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===v||b.dataset.view===NAV_PARENT[v]));
 render();window.scrollTo?.(0,0);
}
function render(){
 const root=$("#content");if(!appState.profile)return;
 const views={wardrobe:renderWardrobe,stylist:renderStylist,looks:renderLooks,shopping:renderShopping,insights:renderInsights,calendar:renderCalendar,settings:renderSettings};
 (views[appState.view]||renderWardrobe)(root);
}

/* ===================== 6. Armario, prendas y looks ===================== */
function collage(images,extra=0){
 if(!images.length)return "";
 return '<div class="look-collage n'+Math.min(images.length,4)+'">'+images.slice(0,4).map((src,i)=>'<div class="look-thumb" style="background-image:url('+src+')">'+(i===3&&extra>0?'<span>+'+extra+'</span>':'')+'</div>').join("")+'</div>';
}
function thumbs(list,max=12){
 if(!list.length)return "";
 return '<div class="thumb-row">'+list.slice(0,max).map(g=>'<button class="thumb" data-thumb="'+fx(g.id)+'" title="'+fx(g.name)+'"'+(validImage(g.image)?' style="background-image:url('+g.image+')"':'')+'><span>'+fx(g.name)+'</span></button>').join("")+(list.length>max?'<span class="muted thumb-more">+'+(list.length-max)+'</span>':'')+'</div>';
}
function garmentCard(g){const image=validImage(g.image)?g.image:"";return `<article class="card" data-garment="${esc(g.id)}"><div class="card-img"${image?` style="background-image:url(${image})"`:""}></div><div class="card-body"><div class="card-title">${esc(g.name||"Sin nombre")}</div><div class="card-meta">${esc([g.category,g.color].filter(Boolean).join(" · "))}</div></div></article>`}
function lookCard(l){
 const gs=(l.garmentIds||[]).map(id=>myGarments().find(g=>g.id===id)).filter(Boolean),imgs=gs.map(g=>g.image).filter(validImage);
 return '<article class="card" data-look="'+esc(l.id)+'">'+collage(imgs,imgs.length-4)+'<div class="card-body"><div class="card-title">'+esc(l.name)+'</div><div class="look-items">'+gs.map(g=>'<span class="look-chip">'+esc(g.name)+'</span>').join("")+'</div></div></article>';
}
function safetyBanner(){
 const p=appState.data.preferences,msgs=[];
 if(!isStandalone()&&p.installHintHidden!==true)msgs.push(isIOS()?"Instala Atelier en tu pantalla de inicio: pulsa Compartir y luego «Añadir a pantalla de inicio».":"Instala Atelier como aplicación (menú del navegador › «Instalar aplicación»).");
 const since=daysSince(p.lastBackupAt);
 if(sync.status==="off"&&myGarments().length>=5&&(since===null||since>30))msgs.push(since===null?"Tu armario solo está en este dispositivo y aún no has exportado ninguna copia de seguridad.":"Hace "+since+" días de tu última copia de seguridad.");
 if(!msgs.length)return "";
 return '<div class="notice-card"><div>'+msgs.map(m=>'<p>'+fx(m)+'</p>').join("")+'</div><div class="notice-actions">'+
  (msgs.some(m=>m.includes("copia"))?'<button class="chip-button" id="bannerBackup">Exportar copia</button>':'')+
  (!isStandalone()&&p.installHintHidden!==true?'<button class="chip-button" id="bannerHide">Ya la he instalado</button>':'')+'</div></div>';
}
function renderWardrobe(root){
 const cats=[...new Set(myGarments().map(g=>g.category).filter(Boolean))].sort();
 const q=ui.search.toLocaleLowerCase("es");
 let gs=myGarments().filter(g=>(!q||[g.name,g.category,g.color,g.notes,g.style].join(" ").toLocaleLowerCase("es").includes(q))&&(!ui.category||g.category===ui.category)&&(!ui.season||g.season===ui.season)&&(!ui.onlyFavorites||g.favorite)&&(!ui.onlyForgotten||forgottenStatus(g).forgotten));
 const sorters={least:(a,b)=>wornCount(a.id)-wornCount(b.id),most:(a,b)=>wornCount(b.id)-wornCount(a.id),name:(a,b)=>String(a.name).localeCompare(String(b.name),"es"),oldest:(a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")),recent:(a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||""))};
 gs.sort(sorters[ui.sort]||sorters.recent);
 const filters='<div class="filter-panel"><label class="field"><span>Buscar prendas</span><input id="wardrobeSearch" type="search" placeholder="Nombre, color, estilo…" value="'+fx(ui.search)+'"></label>'+
  '<details id="advancedFilters"><summary>Filtros y ordenación ▾</summary><div class="filter-grid">'+
  '<label class="field"><span>Categoría</span><select id="filterCategory">'+optionList([["","Todas"],...cats.map(c=>[c,c])],ui.category)+'</select></label>'+
  '<label class="field"><span>Temporada</span><select id="filterSeason">'+optionList([["","Todas"],...Object.entries(seasons)],ui.season)+'</select></label>'+
  '<label class="field"><span>Ordenar</span><select id="filterSort">'+optionList([["recent","Recientes"],["name","Nombre"],["least","Menos usadas"],["most","Más usadas"],["oldest","Más antiguas"]],ui.sort)+'</select></label>'+
  '</div><label class="switch-line"><input type="checkbox" id="onlyFavorites"'+(ui.onlyFavorites?' checked':'')+'> Solo favoritas</label>'+
  '<label class="switch-line"><input type="checkbox" id="onlyForgotten"'+(ui.onlyForgotten?' checked':'')+'> Solo prendas olvidadas</label>'+
  '<button class="secondary small" id="resetFilters">Limpiar filtros</button></details></div>';
 const cards=gs.map(g=>{const f=forgottenStatus(g),n=wornCount(g.id);return '<div class="garment-tile">'+garmentCard(g)+'<div class="tile-tools"><button class="chip-button" data-fav="'+fx(g.id)+'" aria-label="Favorito">'+(g.favorite?'♥':'♡')+'</button><button class="chip-button" data-wear="'+fx(g.id)+'" aria-label="Registrar uso">✓ Usada</button></div><div class="tile-hints">'+fx(plural(n,"uso registrado","usos registrados"))+(f.forgotten?' · ✦ Olvidada':'')+'</div></div>'}).join("");
 root.innerHTML=heroHtml("Mi armario","Toda tu ropa, aprovechada al máximo.")+safetyBanner()+
  '<div class="stats">'+miniStat("prendas",myGarments().length)+miniStat("favoritas",myGarments().filter(g=>g.favorite).length)+miniStat("olvidadas",myGarments().filter(g=>forgottenStatus(g).forgotten).length)+miniStat("looks",myLooks().length)+'</div>'+
  '<div class="section-head"><h2>Prendas <span class="muted">('+gs.length+')</span></h2><button id="addGarment" class="primary">+ Añadir</button></div>'+filters+
  (gs.length?'<div class="grid">'+cards+'</div>':'<div class="empty"><h3>No hay prendas con estos filtros</h3><p class="muted">Prueba otro filtro o añade una prenda.</p><button class="primary" id="emptyAdd">Añadir prenda</button></div>');
 $("#bannerBackup")?.addEventListener("click",downloadBackup);
 $("#bannerHide")?.addEventListener("click",()=>setPref("installHintHidden",true));
 $("#addGarment")?.addEventListener("click",()=>openGarment());
 $("#emptyAdd")?.addEventListener("click",()=>openGarment());
 $("#wardrobeSearch")?.addEventListener("input",e=>{ui.search=e.target.value;const pos=e.target.selectionStart;renderWardrobe(root);const input=$("#wardrobeSearch");input.focus();input.setSelectionRange(pos,pos)});
 for(const [id,key] of [["filterCategory","category"],["filterSeason","season"],["filterSort","sort"],["onlyFavorites","onlyFavorites"],["onlyForgotten","onlyForgotten"]])
  $("#"+id)?.addEventListener("change",e=>{ui[key]=e.target.type==="checkbox"?e.target.checked:e.target.value;renderWardrobe(root);const dt=$("#advancedFilters");if(dt)dt.open=true});
 $("#resetFilters")?.addEventListener("click",()=>{Object.assign(ui,{search:"",category:"",season:"",onlyFavorites:false,onlyForgotten:false,sort:"recent"});render()});
 $$("[data-garment]",root).forEach(x=>x.addEventListener("click",()=>openGarment(x.dataset.garment)));
 $$("[data-fav]",root).forEach(b=>b.addEventListener("click",async()=>{const g=myGarments().find(x=>x.id===b.dataset.fav);if(g)await mutate(()=>{g.favorite=!g.favorite;g.updatedAt=new Date().toISOString()},"Favoritos actualizados")}));
 $$("[data-wear]",root).forEach(b=>b.addEventListener("click",()=>promptWear([b.dataset.wear],null)));
}
let lastAnalysis=null,metaConfidence="",pendingPhoto=null;
/* La foto puede venir de la cámara o de la galería: se usa la última elegida */
const currentPhoto=()=>pendingPhoto||$("#garmentImage").files[0]||null;
/* Ficha de características dentro de la hoja de la prenda (se crea una vez) */
function buildMetadataSection(){
 if($("#metadataDetails"))return;
 const field=def=>'<label class="field"><span>'+fx(def[1])+'</span>'+(Array.isArray(def[2])
  ?'<select id="meta-'+def[0]+'" data-metadata="'+def[0]+'"><option value="">Sin especificar</option>'+def[2].map(v=>'<option value="'+fx(v)+'">'+fx(metaLabel(def[0],v))+'</option>').join("")+'</select>'
  :'<input id="meta-'+def[0]+'" data-metadata="'+def[0]+'" type="text" maxlength="'+def[2]+'">')+'</label>';
 $("#garmentNotes")?.closest(".field")?.insertAdjacentHTML("beforebegin",'<details id="metadataDetails" class="feature-card meta-card"><summary>Características de la prenda · revisar y corregir</summary>'+
  '<p class="helper">La IA las estima a partir de la foto; no puede garantizar el tejido. Corrige lo que no cuadre. Marca, talla y composición se rellenan a mano.</p><p class="helper" id="metaConfidence"></p>'+
  '<div class="filter-grid">'+META_FIELDS.filter(d=>d[3]==="ia").map(field).join("")+'</div>'+
  '<div class="field"><span class="field-title">Ocasiones</span><div class="occ-grid">'+Object.entries(occasions).map(([k,t])=>'<label class="switch-line"><input type="checkbox" name="meta-occasion" value="'+k+'"> '+fx(t)+'</label>').join("")+'</div></div>'+
  '<div class="filter-grid">'+META_FIELDS.filter(d=>d[3]==="manual").map(field).join("")+'</div></details>');
 $("#garmentImage")?.closest(".field")?.insertAdjacentHTML("beforeend",'<label class="switch-line" id="autoAnalyzeOption"><input type="checkbox" id="autoAnalyze" checked> Analizar automáticamente al elegir la foto</label><p class="helper" id="autoAnalyzeStatus" role="status" aria-live="polite"></p>');
 $("#autoAnalyze")?.addEventListener("change",e=>{if(appState.profile)setPref("autoAnalyze",e.target.checked,false)});
}
function populateMetadata(src){
 for(const def of META_FIELDS){const el=$("#meta-"+def[0]);if(el)el.value=metaValue(def,src?.[def[0]])}
 const occ=new Set(Array.isArray(src?.occasions)?src.occasions:[]);
 $$('[name="meta-occasion"]').forEach(x=>x.checked=occ.has(x.value));
 metaConfidence=CONFIDENCE.includes(src?.confidence)?src.confidence:"";
 const c=$("#metaConfidence");if(c)c.textContent=metaConfidence?"Confianza de la IA en este análisis: "+metaConfidence+".":"";
}
function readMetadata(){
 const o={};
 for(const def of META_FIELDS){const el=$("#meta-"+def[0]),v=el?metaValue(def,el.value):"";if(v)o[def[0]]=v}
 const occ=$$('[name="meta-occasion"]').filter(x=>x.checked).map(x=>x.value);if(occ.length)o.occasions=occ;
 if(metaConfidence)o.confidence=metaConfidence;
 return o;
}
const META_KEYS=new Set([...META_FIELDS.map(d=>d[0]),"occasions","confidence"]);
function setAnalyzeStatus(t){const s=$("#autoAnalyzeStatus");if(s)s.textContent=t}
function openGarment(id){
 const g=myGarments().find(x=>x.id===id);
 $("#garmentTitle").textContent=g?"Editar prenda":"Nueva prenda";$("#garmentId").value=g?.id||"";$("#garmentName").value=g?.name||"";$("#garmentCategory").value=g?.category||"";$("#garmentColor").value=g?.color||"";$("#garmentNotes").value=g?.notes||"";$("#garmentSeason").value=g?.season||"all";$("#garmentStyle").value=g?.style||"";$("#garmentPrice").value=g?.price??"";$("#garmentBought").value=g?.boughtAt||"";$("#garmentFavorite").checked=!!g?.favorite;$("#garmentImage").value="";$("#garmentCamera").value="";pendingPhoto=null;
 const preview=$("#garmentPreview"),valid=validImage(g?.image);preview.src=valid?g.image:"";preview.classList.toggle("hidden",!valid);
 $("#deleteGarment").classList.toggle("hidden",!g);
 let btn=$("#garmentAround");
 if(!btn){$("#garmentForm .actions")?.insertAdjacentHTML("beforebegin",'<button type="button" id="garmentAround" class="secondary wide">✦ Ver looks con esta prenda</button>');btn=$("#garmentAround");btn?.addEventListener("click",()=>{const gid=$("#garmentId").value;if(!gid)return;ui.aroundId=gid;ui.stylistTab="around";closeGarment();setView("stylist")})}
 btn?.classList.toggle("hidden",!g);
 buildMetadataSection();populateMetadata(g);setAnalyzeStatus("");
 const details=$("#metadataDetails");if(details)details.open=false;
 const auto=$("#autoAnalyze");if(auto)auto.checked=appState.data.preferences.autoAnalyze!==false;
 lastAnalysis=null;$("#garmentSheet").classList.remove("hidden");
}
function closeGarment(){$("#garmentSheet").classList.add("hidden")}
async function saveGarment(e){
 e.preventDefault();
 const id=$("#garmentId").value||uid(),old=myGarments().find(x=>x.id===id),file=currentPhoto();let image=old?.image||"";
 try{if(file)image=await readImage(file)}catch(err){return toast(err.message==="IMAGE_TOO_LARGE"?"La imagen es demasiado grande":"No se pudo leer la imagen")}
 if(!validImage(image)&&!old?.hasImage)return toast("Añade una fotografía de la prenda antes de guardarla");
 const kept=Object.fromEntries(Object.entries(old||{}).filter(([k])=>!META_KEYS.has(k)));
 const g={...kept,...readMetadata(),id,name:$("#garmentName").value.trim()||"Sin nombre",category:$("#garmentCategory").value,color:$("#garmentColor").value.trim(),notes:$("#garmentNotes").value.trim(),season:$("#garmentSeason").value,style:$("#garmentStyle").value,price:$("#garmentPrice").value===""?null:Number($("#garmentPrice").value),boughtAt:$("#garmentBought").value,favorite:$("#garmentFavorite").checked,createdAt:old?.createdAt||new Date().toISOString(),image,updatedAt:new Date().toISOString()};
 if(!validImage(image)&&old?.hasImage)g.hasImage=true;
 g.imageAt=file?new Date().toISOString():old?.imageAt;if(!g.imageAt)delete g.imageAt;
 const i=myGarments().findIndex(x=>x.id===id);if(i>=0)myGarments()[i]=g;else myGarments().unshift(g);
 if(!await saveState())return;closeGarment();render();toast("Prenda guardada");
}
async function deleteGarment(){
 const id=$("#garmentId").value;if(!id||!confirm("¿Eliminar esta prenda?"))return;
 appState.data.garments=myGarments().filter(x=>x.id!==id);tomb(id);
 appState.data.looks=myLooks().map(l=>l.garmentIds.includes(id)?{...l,garmentIds:l.garmentIds.filter(x=>x!==id),updatedAt:new Date().toISOString()}:l);
 if(!await saveState())return;closeGarment();render();toast("Prenda eliminada");
}
async function analyzeGarment(){
 const file=currentPhoto();if(!file)return toast("Haz o elige una foto primero");
 const btn=$("#analyzeBtn");if(btn.disabled)return;btn.disabled=true;btn.textContent="Analizando…";setAnalyzeStatus("Analizando la foto…");
 try{
  const image=await readImage(file);
  const out=await api("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image})});
  const d=mapAnalysis(out.garment||out.result||out);lastAnalysis=cleanAnalysis(d);
  if(d.name)$("#garmentName").value=d.name;if(d.category)$("#garmentCategory").value=d.category;if(d.color)$("#garmentColor").value=d.color;
  if(d.style)$("#garmentStyle").value=d.style;if(d.season)$("#garmentSeason").value=d.season;if(d.notes&&!$("#garmentNotes").value.trim())$("#garmentNotes").value=d.notes;
  if(currentPhoto()===file){
   const manual=Object.fromEntries(Object.entries(readMetadata()).filter(([k])=>META_FIELDS.find(x=>x[0]===k)?.[3]==="manual"));
   populateMetadata({...manual,...lastAnalysis});const details=$("#metadataDetails");if(details)details.open=true;
   setAnalyzeStatus("Datos sugeridos por la IA. Revísalos antes de guardar.");
  }
  toast("Análisis completado");
 }catch(e){console.error("ANALYZE",e);setAnalyzeStatus("No se pudo analizar. Puedes rellenar los datos a mano o reintentarlo.");if(e.message!=="AI_QUOTA")toast("No se pudo analizar la prenda")}
 finally{btn.disabled=false;btn.textContent="✨ Analizar foto"}
}
function promptWear(ids,lookId){
 const valid=[...new Set(ids||[])].filter(id=>myGarments().some(g=>g.id===id));
 if(!valid.length)return toast("No hay prendas para registrar");
 $$("#wearSheet").forEach(x=>x.remove());
 const names=valid.map(id=>myGarments().find(g=>g.id===id)?.name).filter(Boolean),today=dayISO();
 document.body.insertAdjacentHTML("beforeend",'<div id="wearSheet" class="overlay"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="wearTitle">'+
  '<div class="section-head"><h2 id="wearTitle">¿Cuándo lo llevaste?</h2><button type="button" class="secondary" id="wearClose">Cerrar</button></div>'+
  '<p class="muted">'+fx(names.join(" · "))+'</p>'+
  '<div class="wear-quick"><button class="primary" data-wear-day="'+today+'">Hoy</button><button class="secondary" data-wear-day="'+shiftDay(-1)+'">Ayer</button></div>'+
  '<label class="field"><span>Otro día</span><input id="wearDate" type="date" max="'+today+'" value="'+today+'"></label>'+
  '<button class="secondary wide" id="wearOther">Guardar en esa fecha</button></section></div>');
 const close=()=>$$("#wearSheet").forEach(x=>x.remove());
 $("#wearClose").addEventListener("click",close);
 $("#wearSheet").addEventListener("click",e=>{if(e.target.id==="wearSheet")close()});
 const save=date=>{if(!validDay(date)||date>dayISO())return toast("Elige una fecha válida, no futura");close();recordWear(valid,date,lookId)};
 $$("[data-wear-day]").forEach(b=>b.addEventListener("click",()=>save(b.dataset.wearDay)));
 $("#wearOther").addEventListener("click",()=>save($("#wearDate").value));
}
async function recordWear(ids,date,lookId){
 const validIds=[...new Set(ids)].filter(id=>myGarments().some(g=>g.id===id));
 if(!validIds.length)return toast("No hay prendas para registrar");
 await mutate(()=>logs().unshift({id:uid(),date,garmentIds:validIds,lookId:lookId||null,updatedAt:new Date().toISOString()}),"Uso registrado");
}
function openLook(id){
 const l=myLooks().find(x=>x.id===id);
 $("#lookTitle").textContent=l?"Editar look":"Nuevo look";$("#lookId").value=l?.id||"";$("#lookName").value=l?.name||"";$("#lookOccasion").value=l?.occasion||"daily";$("#lookFavorite").checked=!!l?.favorite;
 $("#lookGarments").innerHTML=myGarments().length?myGarments().map(g=>`<label class="field"><span><input type="checkbox" value="${esc(g.id)}" ${l?.garmentIds.includes(g.id)?"checked":""}> ${esc(g.name)}</span></label>`).join(""):`<p class="muted">Añade prendas antes de crear un look.</p>`;
 $("#deleteLook").classList.toggle("hidden",!l);$("#lookSheet").classList.remove("hidden");
}
function closeLook(){$("#lookSheet").classList.add("hidden")}
async function saveLook(e){
 e.preventDefault();
 const id=$("#lookId").value||uid(),garmentIds=$$("#lookGarments input:checked").map(x=>x.value);
 if(!garmentIds.length)return toast("Selecciona al menos una prenda");
 const previous=myLooks().find(x=>x.id===id);
 const l={id,name:$("#lookName").value.trim()||"Mi look",garmentIds,occasion:$("#lookOccasion").value,favorite:$("#lookFavorite").checked,ai:previous?.ai||false,updatedAt:new Date().toISOString()};
 const i=myLooks().findIndex(x=>x.id===id);if(i>=0)myLooks()[i]=l;else myLooks().unshift(l);
 if(!await saveState())return;closeLook();render();toast("Look guardado");
}
async function deleteLook(){
 const id=$("#lookId").value;if(!id||!confirm("¿Eliminar este look?"))return;
 appState.data.looks=myLooks().filter(x=>x.id!==id);tomb(id);
 if(!await saveState())return;closeLook();render();toast("Look eliminado");
}

/* Reglas locales de combinación (sin IA): color, categoría, estilo, temporada y estampado */
const COLOR_WORDS=[
 ["neutro",["negro","negra","blanco","blanca","gris","beige","crudo","cruda","camel","marron","chocolate","marino","navy","denim","vaquero","vaquera","nude","arena","topo","crema","hueso","piedra","tostado","caqui","khaki","plata","plateado","plateada","dorado","dorada","oro"]],
 ["estampado",["estampado","estampada","multicolor","rayas","cuadros","flores","floral","print","leopardo","animal","lunares"]],
 ["rojo",["rojo","roja","granate","burdeos","vino","coral","teja"]],
 ["rosa",["rosa","fucsia","magenta","malva","salmon"]],
 ["naranja",["naranja","mostaza","calabaza","ocre"]],
 ["amarillo",["amarillo","amarilla","limon","vainilla"]],
 ["verde",["verde","oliva","militar","menta","esmeralda","botella","kaki","salvia"]],
 ["azul",["azul","celeste","turquesa","cobalto","anil","indigo"]],
 ["morado",["morado","morada","lila","violeta","berenjena","lavanda"]]
];
const colorCache=new Map();
function colorInfo(text,pattern){
 if(pattern&&pattern!=="plain")return {fam:"estampado",word:"estampado-"+pattern};
 const key=String(text||"");if(colorCache.has(key))return colorCache.get(key);
 let info={fam:"",word:""};
 outer:for(const w of norm(text).split(/[^a-z]+/).filter(Boolean))for(const [fam,list] of COLOR_WORDS)if(list.includes(w)){info={fam,word:w};break outer}
 colorCache.set(key,info);return info;
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
function pairs(a,b){
 if(a.id&&a.id===b.id)return false;
 if(a.category&&b.category&&!(PAIRS[a.category]||[]).includes(b.category))return false;
 if(!a.category&&!b.category)return false;
 if(a.style&&b.style&&!(STYLE_OK[a.style]||[]).includes(b.style))return false;
 if(a.season&&b.season&&a.season!=="all"&&b.season!=="all"&&a.season!==b.season)return false;
 return colorsMatch(colorInfo(a.color,a.pattern),colorInfo(b.color,b.pattern));
}
function isDuplicate(a,b){
 if(!a.category||a.category!==b.category)return false;
 const ca=colorInfo(a.color,a.pattern),cb=colorInfo(b.color,b.pattern);
 if(!ca.fam||!cb.fam)return false;
 const base=w=>w.replace(/a$/,"o"),sameColor=ca.fam==="neutro"?base(ca.word)===base(cb.word):ca.fam==="estampado"?ca.word===cb.word&&norm(a.color)===norm(b.color):ca.fam===cb.fam;
 return sameColor&&(!a.style||!b.style||a.style===b.style);
}
function outfitBases(gs){
 const tops=gs.filter(g=>g.category==="Arriba"),bottoms=gs.filter(g=>g.category==="Abajo"),bases=[];
 for(const t of tops)for(const b of bottoms)if(pairs(t,b))bases.push([t,b]);
 for(const d of gs.filter(g=>g.category==="Vestidos"))bases.push([d]);
 return bases.slice(0,400);
}

/* ===================== 7. Estilista ===================== */
const STYLIST_TABS=[["today","Hoy"],["around","Combinar prenda"],["looks","Mis looks",' id="openLooks"'],["trips","Maletas"]];
function stylistShell(root,title,subtitle,body){
 root.innerHTML=heroHtml(title,subtitle)+tabsHtml("stylist",STYLIST_TABS,appState.view==="looks"?"looks":ui.stylistTab)+body;
 $$("[data-stylist-tab]",root).forEach(b=>b.addEventListener("click",()=>{const t=b.dataset.stylistTab;if(t==="looks")return setView("looks");ui.stylistTab=t;setView("stylist")}));
}
function renderStylist(root){
 if(ui.stylistTab==="looks")ui.stylistTab="today";
 if(ui.stylistTab==="around")return renderAround(root);
 if(ui.stylistTab==="trips")return renderTrips(root);
 const p=appState.data.preferences,u=aiUsage(),candidates=recommendGarments().filter(g=>forgottenStatus(g).forgotten||wornCount(g.id)===0).slice(0,5);
 const info=p.autoWeather&&p.weatherDay===dayISO()?"Tiempo de hoy en tu zona: media de "+p.temperature+" °C.":p.autoWeather?"Actualizando el tiempo de hoy…":"";
 stylistShell(root,"Tu estilista","Combina lo que ya tienes. La IA no inventará prendas.",
  '<div class="feature-card"><div class="section-head"><h2>¿Qué me pongo hoy?</h2><span class="muted">IA</span></div>'+
  '<div class="filter-grid"><label class="field"><span>Ocasión</span><select id="prefOccasion">'+optionList(Object.entries(occasions),p.occasion)+'</select></label>'+
  '<label class="field"><span>Temporada</span><select id="prefSeason">'+optionList(Object.entries(seasons),p.season)+'</select></label></div>'+
  '<label class="field"><span>Temperatura exterior (°C; por defecto '+DEFAULT_TEMPERATURE+')</span><input id="prefTemperature" type="number" min="-30" max="55" step="1" placeholder="Si lo dejas vacío, uso '+DEFAULT_TEMPERATURE+' °C" value="'+fx(currentTemperature())+'"></label>'+
  '<div class="weather-line"><button type="button" class="chip-button" id="useWeather">📍 Usar el tiempo de hoy</button>'+(p.autoWeather?'<button type="button" class="chip-button" id="stopWeather">Volver a '+DEFAULT_TEMPERATURE+' °C</button>':'')+'</div>'+(info?'<p class="helper">'+fx(info)+'</p>':'')+
  '<div class="field"><label for="prefDiversity">Diversidad <abbr title="Cuánto priorizar prendas poco usadas para variar tus looks">ⓘ</abbr>: <strong id="diversityText">'+fx(p.diversity)+'</strong>%</label><input id="prefDiversity" type="range" min="0" max="100" step="5" value="'+fx(p.diversity)+'"></div>'+
  '<label class="switch-line"><input id="prefAvoid" type="checkbox"'+(p.avoidRepeats?' checked':'')+'> Evitar repetir combinaciones recientes</label>'+
  '<button class="primary wide" id="suggestSmart">✦ Generar looks con mi ropa</button>'+
  '<p class="helper">Se envían solo los nombres y atributos de tus prendas, nunca las fotos. Sugerencias con IA hoy: '+u.looks+' de '+AI_LIMITS.looks+'.</p></div>'+
  '<div class="actions"><button class="secondary" id="createManual">+ Crear look manual</button><button class="secondary" id="openCalendar">Calendario de uso</button></div>'+
  '<div class="section-head"><h2>Rescata una prenda olvidada</h2></div>'+
  (candidates.length?'<div class="insight-list">'+candidates.map(g=>'<button class="list-line link-line" data-rescue="'+fx(g.id)+'"><strong>'+fx(g.name)+'</strong><span class="muted">'+fx(plural(wornCount(g.id),"uso","usos"))+' · ver looks ›</span></button>').join("")+'</div>':'<div class="empty">No tienes prendas olvidadas. ¡Bien!</div>'));
 $("#prefOccasion")?.addEventListener("change",e=>setPref("occasion",e.target.value,false));
 $("#prefSeason")?.addEventListener("change",e=>setPref("season",e.target.value,false));
 $("#prefTemperature")?.addEventListener("change",e=>{const v=e.target.value,n=Number(v);if(v===""||(Number.isFinite(n)&&n>=-30&&n<=55)){p.autoWeather=false;setPref("temperature",v===""?DEFAULT_TEMPERATURE:n,v==="")}else toast("Introduce entre -30 y 55 °C")});
 $("#prefDiversity")?.addEventListener("input",e=>{$("#diversityText").textContent=e.target.value;setPref("diversity",Number(e.target.value),false)});
 $("#prefAvoid")?.addEventListener("change",e=>setPref("avoidRepeats",e.target.checked,false));
 $("#suggestSmart")?.addEventListener("click",()=>suggestLooks());
 $("#createManual")?.addEventListener("click",()=>openLook());
 $("#openCalendar")?.addEventListener("click",()=>setView("calendar"));
 $$("[data-rescue]",root).forEach(b=>b.addEventListener("click",()=>{ui.aroundId=b.dataset.rescue;ui.stylistTab="around";render()}));
 $("#useWeather")?.addEventListener("click",async e=>{e.target.disabled=true;e.target.textContent="Consultando…";
  try{const w=await fetchTodayTemperature(true);toast("Hoy: entre "+w.min+" y "+w.max+" °C (media "+w.mean+" °C)");render()}
  catch(err){console.warn("WEATHER",err);toast(err?.code===1?"Sin permiso de ubicación: sigo usando "+DEFAULT_TEMPERATURE+" °C":"No se pudo consultar el tiempo");e.target.disabled=false;e.target.textContent="📍 Usar el tiempo de hoy"}});
 $("#stopWeather")?.addEventListener("click",async()=>{Object.assign(p,{autoWeather:false,temperature:DEFAULT_TEMPERATURE,weatherDay:null,weatherPlace:null});await saveState();render()});
}
const aiLookCache=new Map();
async function suggestLooks(){
 if(myGarments().length<2)return toast("Añade al menos dos prendas");
 const btn=$("#aiLooks")||$("#suggestSmart");if(!btn||btn.disabled)return;btn.disabled=true;btn.textContent="Pensando…";
 try{
  const p=appState.data.preferences;
  const items=recommendGarments().slice(0,24).map(g=>({i:g.id,n:g.name,c:g.category||"",color:g.color||"",style:g.style||"",pattern:g.pattern||"",formality:g.formality||"",forgotten:forgottenStatus(g).forgotten}));
  const recent=logs().slice(0,8).flatMap(l=>l.garmentIds||[]),avoid=p.avoidRepeats?[...new Set(recent)].slice(0,12):[];
  const fb=appState.data.feedback||{},taste=v=>myLooks().filter(l=>fb[l.id]===v&&Array.isArray(l.garmentIds)&&l.garmentIds.length>1).slice(0,4).map(l=>l.garmentIds.slice(0,6));
  const body={items,need:3,liked:taste("up"),disliked:taste("down"),occasion:p.occasion||"daily",season:p.season||"all",weather:currentTemperature()+" °C",avoid};
  const key=appState.profile.id+":"+JSON.stringify(body),cached=aiLookCache.get(key),fresh=cached&&Date.now()-cached.at<300000;
  const out=fresh?cached.value:await api("/api/looks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!fresh)aiLookCache.set(key,{at:Date.now(),value:out});
  const suggestions=Array.isArray(out.looks)?out.looks:[],allowed=new Set(items.map(i=>i.i));
  const seen=new Set(myLooks().map(l=>(l.garmentIds||[]).slice().sort().join("|")));let added=0;
  for(const [i,l] of suggestions.entries()){
   const ids=[...new Set(Array.isArray(l.ids)?l.ids:[])].filter(id=>allowed.has(id)).slice(0,6),signature=ids.slice().sort().join("|");
   if(ids.length<2||seen.has(signature))continue;
   seen.add(signature);added++;myLooks().unshift({id:uid(),name:String(l.why||"Look sugerido "+(i+1)).slice(0,80),garmentIds:ids,ai:true,occasion:body.occasion,updatedAt:new Date().toISOString()});
  }
  if(!added)return toast("Estas combinaciones ya están guardadas. Cambia la ocasión o la diversidad.");
  if(!await saveState())return;
  if(appState.view==="stylist")setView("looks");else render();
  toast(plural(added,"look sugerido","looks sugeridos"));
 }catch(e){console.error("LOOKS_AI",e);if(e.message!=="AI_QUOTA")toast(e.message==="SESSION_EXPIRED"?"La sesión ha caducado":"No se pudieron generar looks")}
 finally{const a=$("#aiLooks"),s=$("#suggestSmart");if(a){a.disabled=false;a.textContent="✦ Sugerir nuevos looks"}if(s){s.disabled=false;s.textContent="✦ Generar looks con mi ropa"}}
}
function renderLooks(root){
 let looks=myLooks();
 if(ui.lookFilter==="favorites")looks=looks.filter(l=>l.favorite);
 if(ui.lookFilter==="ai")looks=looks.filter(l=>l.ai);
 const fb=appState.data.feedback;
 stylistShell(root,"Mis looks","Tus combinaciones guardadas y las sugeridas por la IA.",
  '<div class="section-head"><h2>Conjuntos ('+looks.length+')</h2><button class="primary" id="newLook">+ Crear</button></div>'+
  '<div class="filter-tabs">'+[["all","Todos"],["favorites","Favoritos ♡"],["ai","Sugeridos por IA"]].map(([k,t])=>'<button class="chip-button'+(ui.lookFilter===k?' on':'')+'" data-look-filter="'+k+'">'+t+'</button>').join("")+'</div>'+
  '<button class="secondary wide" id="aiLooks">✦ Sugerir nuevos looks</button>'+
  (looks.length?'<div class="grid">'+looks.map(l=>'<div class="look-tile">'+lookCard(l)+
   '<div class="tile-tools"><button class="chip-button" data-look-fav="'+fx(l.id)+'">'+(l.favorite?'♥':'♡')+'</button><button class="chip-button" data-look-wear="'+fx(l.id)+'">✓ Llevado</button></div>'+
   '<div class="tile-tools"><button class="chip-button'+(fb[l.id]==="up"?' on':'')+'" data-feedback="'+fx(l.id)+'" data-vote="up" aria-label="Me gusta">👍</button><button class="chip-button'+(fb[l.id]==="down"?' on':'')+'" data-feedback="'+fx(l.id)+'" data-vote="down" aria-label="No me gusta">👎</button></div>'+
   '<div class="tile-hints">'+(l.ai?"IA":"Manual")+'</div></div>').join("")+'</div>':'<div class="empty">Todavía no tienes looks para este filtro.</div>'));
 $("#newLook")?.addEventListener("click",()=>openLook());$("#aiLooks")?.addEventListener("click",()=>suggestLooks());
 $$("[data-look-filter]",root).forEach(b=>b.addEventListener("click",()=>{ui.lookFilter=b.dataset.lookFilter;render()}));
 $$("[data-look]",root).forEach(b=>b.addEventListener("click",()=>openLook(b.dataset.look)));
 $$("[data-look-fav]",root).forEach(b=>b.addEventListener("click",async()=>{const l=myLooks().find(l=>l.id===b.dataset.lookFav);if(l)await mutate(()=>{l.favorite=!l.favorite;l.updatedAt=new Date().toISOString()},"Look actualizado")}));
 $$("[data-look-wear]",root).forEach(b=>b.addEventListener("click",()=>{const l=myLooks().find(l=>l.id===b.dataset.lookWear);if(l)promptWear(l.garmentIds,l.id)}));
 $$("[data-feedback]",root).forEach(b=>b.addEventListener("click",async()=>{const id=b.dataset.feedback;await mutate(()=>{if(fb[id]===b.dataset.vote)delete fb[id];else fb[id]=b.dataset.vote},"Preferencia guardada")}));
}
/* Combinar una prenda: looks calculados en el móvil, sin IA */
function looksAround(g,max=8){
 const gs=myGarments().filter(x=>x.id!==g.id&&!notInSeason(x));
 const score=x=>(x.favorite?1.5:0)+2/(1+wornCount(x.id))+(forgottenStatus(x).forgotten?1:0);
 const best=(cat,pieces)=>gs.filter(x=>x.category===cat&&pieces.every(p=>pairs(x,p))).sort((a,b)=>score(b)-score(a))[0];
 let bases=[];
 if(g.category==="Arriba")bases=gs.filter(x=>x.category==="Abajo"&&pairs(g,x)).map(b=>[g,b]);
 else if(g.category==="Abajo")bases=gs.filter(x=>x.category==="Arriba"&&pairs(g,x)).map(t=>[t,g]);
 else if(g.category==="Vestidos")bases=[[g]];
 else if(g.category)bases=outfitBases(gs).filter(p=>p.every(x=>pairs(g,x))).map(p=>[...p,g]);
 const cold=thisSeason()==="cold"||currentTemperature()<17;
 const looks=bases.map(base=>{const l=[...base];for(const cat of ["Zapatos",cold?"Capas":null,"Bolsos"]){if(!cat||l.some(x=>x.category===cat))continue;const s=best(cat,l);if(s)l.push(s)}return l}).filter(l=>l.length>=2);
 const seen=new Set();
 return looks.map(l=>({l,s:l.reduce((t,x)=>t+(x.id===g.id?0:score(x)),0)})).sort((a,b)=>b.s-a.s).map(x=>x.l)
  .filter(l=>{const k=l.map(x=>x.id).sort().join("|");if(seen.has(k))return false;seen.add(k);return true}).slice(0,max);
}
function renderAround(root){
 const gs=myGarments().slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),"es")),sel=gs.find(g=>g.id===ui.aroundId),looks=sel?looksAround(sel):[];
 let body='<div class="feature-card" id="aroundCard"><div class="section-head"><h2>Combina una prenda</h2><span class="muted">Sin IA</span></div>'+
  '<label class="field"><span>¿Qué prenda quieres ponerte?</span><select id="aroundSelect">'+optionList([["","Elige una prenda"],...gs.map(g=>[g.id,g.name+(g.category?" · "+g.category:"")])],ui.aroundId)+'</select></label>';
 if(sel)body+=looks.length?'<p class="muted">'+plural(looks.length,"combinación","combinaciones")+' con «'+fx(sel.name)+'», empezando por las prendas que menos usas.</p><div class="grid">'+looks.map((l,i)=>{const imgs=l.map(x=>x.image).filter(validImage);return '<div class="look-tile"><article class="card">'+collage(imgs,imgs.length-4)+'<div class="card-body"><div class="look-items">'+l.map(x=>'<span class="look-chip'+(x.id===sel.id?' new':'')+'">'+fx(x.name)+'</span>').join("")+'</div></div></article><div class="tile-tools"><button class="chip-button" data-around-save="'+i+'">Guardar look</button><button class="chip-button" data-around-wear="'+i+'">✓ Llevado</button></div></div>'}).join("")+'</div>'
  :'<p class="muted">No encuentro combinaciones para esta prenda con tu armario actual. Mira «Recomendaciones» en Compras para ver qué le falta.</p>';
 stylistShell(root,"Tu estilista","Elige una prenda y te digo con qué ponértela.",body+'</div>');
 $("#aroundSelect")?.addEventListener("change",e=>{ui.aroundId=e.target.value;render()});
 $$("[data-around-save]",root).forEach(b=>b.addEventListener("click",async()=>{const l=looks[Number(b.dataset.aroundSave)];if(!l)return;
  const sig=l.map(x=>x.id).sort().join("|");if(myLooks().some(x=>(x.garmentIds||[]).slice().sort().join("|")===sig))return toast("Ese look ya está guardado");
  await mutate(()=>myLooks().unshift({id:uid(),name:"Con "+sel.name,garmentIds:l.map(x=>x.id),occasion:appState.data.preferences.occasion||"daily",ai:false,updatedAt:new Date().toISOString()}),"Look guardado")}));
 $$("[data-around-wear]",root).forEach(b=>b.addEventListener("click",()=>{const l=looks[Number(b.dataset.aroundWear)];if(l)promptWear(l.map(x=>x.id),null)}));
}
/* Tiempo de hoy con Open-Meteo (gratis, sin tokens). Por defecto, 25 °C. */
async function fetchTodayTemperature(ask){
 const p=appState.data.preferences;let pos=p.weatherPlace;
 if(!pos||ask)pos=await new Promise((res,rej)=>{if(!navigator.geolocation)return rej(new Error("NO_GEO"));navigator.geolocation.getCurrentPosition(x=>res({lat:Math.round(x.coords.latitude*100)/100,lon:Math.round(x.coords.longitude*100)/100}),e=>rej(e),{timeout:10000,maximumAge:3600000})});
 const r=await fetch("https://api.open-meteo.com/v1/forecast?latitude="+pos.lat+"&longitude="+pos.lon+"&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1");
 if(!r.ok)throw new Error("WEATHER_"+r.status);
 const d=await r.json(),max=d?.daily?.temperature_2m_max?.[0],min=d?.daily?.temperature_2m_min?.[0];
 if(typeof max!=="number"||typeof min!=="number")throw new Error("WEATHER_DATA");
 Object.assign(p,{weatherPlace:pos,temperature:Math.round((max+min)/2),weatherDay:dayISO(),autoWeather:true});
 await saveState({fromSync:true});return {mean:p.temperature,max:Math.round(max),min:Math.round(min)};
}
let weatherInFlight=false;
async function refreshWeatherIfNeeded(){
 const p=appState.data.preferences;
 if(weatherInFlight||!p.autoWeather||!p.weatherPlace||p.weatherDay===dayISO())return;
 weatherInFlight=true;
 try{await fetchTodayTemperature(false);if(appState.view==="stylist")render()}catch(e){console.warn("WEATHER",e)}finally{weatherInFlight=false}
}

/* Maletas: lista de equipaje por viaje, calculada en el móvil (sin IA).
   La sugerencia elige pocas prendas que den al menos un look por día del viaje. */
const PACK_EXTRAS=["Pijama","Ropa interior y calcetines","Neceser","Cargador del móvil","Documentación"];
const PACK_ORDER=["Arriba","Abajo","Vestidos","Capas","Zapatos","Bolsos","Accesorios",""];
const myTrips=()=>appState.data.trips;
const fmtDay=d=>validDay(d)?new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"short",year:d.slice(0,4)===dayISO().slice(0,4)?undefined:"numeric"}).format(new Date(d+"T12:00:00")):"";
function tripDays(t){if(!validDay(t.start)||!validDay(t.end)||t.end<t.start)return 1;return Math.round((Date.parse(t.end+"T12:00:00")-Date.parse(t.start+"T12:00:00"))/86400000)+1}
function seasonFor(day){const m=validDay(day)?Number(day.slice(5,7))-1:new Date().getMonth();return m>=3&&m<=9?"warm":"cold"}
const fitsSeason=(g,season)=>!g.season||g.season==="all"||g.season===season;
const tripItems=t=>(t.garmentIds||[]).map(id=>myGarments().find(g=>g.id===id)).filter(Boolean);
/* Looks posibles con lo que va en la maleta: arriba + abajo, o vestido; con calzado y capa si encajan */
function packLooks(items){
 const looks=[];
 for(const t of items.filter(g=>g.category==="Arriba"))for(const b of items.filter(g=>g.category==="Abajo"))if(pairs(t,b))looks.push([t,b]);
 for(const d of items.filter(g=>g.category==="Vestidos"))looks.push([d]);
 return looks.map(l=>{const out=[...l];for(const cat of ["Zapatos","Capas"]){const x=items.find(g=>g.category===cat&&out.every(p=>pairs(g,p)));if(x)out.push(x)}return out});
}
function suggestPacking(t){
 const season=seasonFor(t.start),days=tripDays(t),all=myGarments().filter(g=>fitsSeason(g,season));
 const core=all.filter(g=>["Arriba","Abajo","Vestidos"].includes(g.category)),chosen=[],max=Math.min(12,days+4);
 const looksOf=list=>packLooks(list).length;
 // Versatilidad: con cuántas prendas complementarias combina (desempata cuando aún no suma looks)
 const partner={Arriba:"Abajo",Abajo:"Arriba"},versatility=g=>core.filter(o=>o.category===partner[g.category]&&pairs(g,o)).length;
 while(looksOf(chosen)<days&&chosen.length<max){
  const now=looksOf(chosen);let best=null,bestScore=-1;
  for(const g of core){
   if(chosen.includes(g))continue;
   const score=(looksOf([...chosen,g])-now)*100+versatility(g)+(g.favorite?.5:0);
   if(score>bestScore){best=g;bestScore=score}
  }
  if(!best)break;chosen.push(best);
 }
 // Complementos: el calzado que más looks cubre (y otro si quedan muchos sin calzado), capa si hace frío, un bolso
 const looks=packLooks(chosen).map(l=>l.filter(x=>["Arriba","Abajo","Vestidos"].includes(x.category)));
 const coverBest=(cat,need)=>{const opts=all.filter(g=>g.category===cat&&!chosen.includes(g));let best=null,n=0;for(const g of opts){const c=need.filter(l=>l.every(p=>pairs(g,p))).length;if(c>n){best=g;n=c}}return best?{g:best,covers:need.filter(l=>l.every(p=>pairs(best,p)))}:null};
 let pending=looks;
 for(let i=0;i<2&&pending.length;i++){const s=coverBest("Zapatos",pending);if(!s)break;if(i===1&&s.covers.length<pending.length/2&&pending.length<looks.length/2)break;chosen.push(s.g);pending=pending.filter(l=>!s.covers.includes(l))}
 if(season==="cold"){const c=coverBest("Capas",looks);if(c)chosen.push(c.g)}  // según la temporada del viaje, no el tiempo de hoy
 const bag=coverBest("Bolsos",looks);if(bag)chosen.push(bag.g);
 return chosen.map(g=>g.id);
}
function tripSummary(t){const items=tripItems(t),days=tripDays(t),looks=packLooks(items).length;return {items,days,looks}}
function renderTrips(root){
 const trip=myTrips().find(t=>t.id===ui.tripId);
 if(trip)return renderTrip(root,trip);
 const today=dayISO(),list=myTrips().slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));
 stylistShell(root,"Maletas","Prepara el equipaje con la ropa que ya tienes.",
  '<div class="feature-card"><h2>Nuevo viaje</h2><form id="tripForm"><label class="field"><span>Destino o nombre</span><input id="tripName" maxlength="60" required placeholder="Por ejemplo, Lisboa"></label>'+
  '<div class="filter-grid"><label class="field"><span>Ida</span><input id="tripStart" type="date" required value="'+today+'"></label><label class="field"><span>Vuelta</span><input id="tripEnd" type="date" required value="'+shiftDay(2)+'"></label></div>'+
  '<button class="primary wide" type="submit">✦ Preparar maleta</button></form>'+
  '<p class="helper">Te propongo pocas prendas que den al menos un look por día, según la temporada del viaje. Se calcula en tu móvil, sin gastar tokens.</p></div>'+
  (list.length?'<div class="section-head"><h2>Mis maletas</h2></div><div class="insight-list">'+list.map(t=>{const s=tripSummary(t),packed=s.items.filter(g=>t.packed?.[g.id]).length;return '<button class="list-line link-line" data-trip="'+fx(t.id)+'"><strong>'+fx(t.name)+'</strong><span class="muted">'+fx(fmtDay(t.start)+" · "+plural(s.days,"día","días")+" · "+packed+"/"+s.items.length+" preparadas")+' ›</span></button>'}).join("")+'</div>':''));
 $("#tripForm")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const name=$("#tripName").value.trim(),start=$("#tripStart").value,end=$("#tripEnd").value;
  if(!name||!validDay(start)||!validDay(end))return toast("Completa el nombre y las fechas");
  if(end<start)return toast("La vuelta no puede ser antes de la ida");
  const now=new Date().toISOString(),t={id:uid(),name,start,end,garmentIds:[],packed:{},extras:PACK_EXTRAS.map(text=>({id:uid(),text,done:false})),createdAt:now,updatedAt:now};
  t.garmentIds=suggestPacking(t);
  if(await mutate(()=>myTrips().unshift(t),t.garmentIds.length?"Maleta preparada":"Maleta creada")){ui.tripId=t.id;render()}
 });
 $$("[data-trip]",root).forEach(b=>b.addEventListener("click",()=>{ui.tripId=b.dataset.trip;render()}));
}
function renderTrip(root,t){
 const {items,days,looks}=tripSummary(t),season=seasonFor(t.start),packed=items.filter(g=>t.packed?.[g.id]).length;
 const extras=t.extras||[],done=extras.filter(x=>x.done).length,total=items.length+extras.length,ready=packed+done;
 const order=g=>PACK_ORDER.indexOf(g.category||""),sorted=items.slice().sort((a,b)=>order(a)-order(b)||String(a.name).localeCompare(String(b.name),"es"));
 const others=myGarments().filter(g=>!(t.garmentIds||[]).includes(g.id)).sort((a,b)=>order(a)-order(b)||String(a.name).localeCompare(String(b.name),"es"));
 const examples=packLooks(items).slice(0,6);
 stylistShell(root,t.name,(validDay(t.start)?fmtDay(t.start)+" – "+fmtDay(t.end)+" · ":"")+plural(days,"día","días")+" · "+seasons[season],
  '<div class="actions"><button class="secondary" id="tripBack">← Mis maletas</button><button class="secondary" id="tripResuggest">✦ Volver a sugerir</button></div>'+
  '<div class="stats">'+miniStat("prendas",items.length)+miniStat("looks posibles",looks)+'</div>'+
  (items.length&&looks<days?'<p class="notice-card">Con estas prendas tienes '+plural(looks,"look","looks")+' para '+plural(days,"día","días")+'. Repetirás alguno, o añade más prendas.</p>':'')+
  (!items.length?'<p class="notice-card">No he encontrado prendas de '+fx(seasons[season].toLocaleLowerCase("es"))+' que combinen entre sí. Añádelas a mano abajo.</p>':'')+
  '<div class="feature-card"><div class="section-head"><h2>Equipaje</h2><span class="muted">'+ready+' de '+total+'</span></div>'+
  '<div class="progress-track"><div style="width:'+(total?Math.round(100*ready/total):0)+'%"></div></div>'+
  '<div class="pack-list">'+sorted.map(g=>'<div class="pack-row"><input type="checkbox" data-pack="'+fx(g.id)+'" aria-label="Preparada: '+fx(g.name)+'"'+(t.packed?.[g.id]?' checked':'')+'><span class="pack-thumb"'+(validImage(g.image)?' style="background-image:url('+g.image+')"':'')+'></span><span class="pack-name">'+fx(g.name)+'<small class="muted">'+fx(g.category||"")+'</small></span><button class="chip-button" data-unpack="'+fx(g.id)+'" aria-label="Quitar '+fx(g.name)+'">✕</button></div>').join("")+'</div>'+
  (others.length?'<div class="pack-add"><select id="tripAddSelect" aria-label="Prenda para añadir">'+optionList([["","Añadir otra prenda…"],...others.map(g=>[g.id,g.name+(g.category?" · "+g.category:"")])],"")+'</select><button class="secondary" id="tripAdd">Añadir</button></div>':'')+
  '<h3 class="mini-title">Además</h3><div class="pack-list">'+extras.map(x=>'<div class="pack-row extra"><input type="checkbox" data-extra="'+fx(x.id)+'" aria-label="Preparado: '+fx(x.text)+'"'+(x.done?' checked':'')+'><span class="pack-name">'+fx(x.text)+'</span><button class="chip-button" data-extra-remove="'+fx(x.id)+'" aria-label="Quitar '+fx(x.text)+'">✕</button></div>').join("")+'</div>'+
  '<form id="extraForm" class="pack-add"><input id="extraText" maxlength="60" placeholder="Añadir algo (gafas de sol, bañador…)" aria-label="Otra cosa para la maleta"><button class="secondary" type="submit">Añadir</button></form></div>'+
  (examples.length?'<div class="section-head"><h2>Looks con tu maleta</h2></div><div class="grid">'+examples.map((l,i)=>{const imgs=l.map(x=>x.image).filter(validImage);return '<div class="look-tile"><article class="card">'+collage(imgs,imgs.length-4)+'<div class="card-body"><div class="look-items">'+l.map(x=>'<span class="look-chip">'+fx(x.name)+'</span>').join("")+'</div></div></article><div class="tile-tools"><button class="chip-button" data-trip-look="'+i+'">Guardar look</button></div></div>'}).join("")+'</div>':'')+
  '<button class="danger wide" id="tripDelete">Eliminar maleta</button>');
 const touch=fn=>mutate(()=>{fn();t.updatedAt=new Date().toISOString()});
 $("#tripBack")?.addEventListener("click",()=>{ui.tripId="";render()});
 $("#tripResuggest")?.addEventListener("click",async()=>{if(!confirm("¿Sustituir las prendas de la maleta por una nueva sugerencia?"))return;const ids=suggestPacking(t);await touch(()=>{t.garmentIds=ids;t.packed=Object.fromEntries(Object.entries(t.packed||{}).filter(([id])=>ids.includes(id)))});toast("Maleta actualizada")});
 $$("[data-pack]",root).forEach(c=>c.addEventListener("change",()=>touch(()=>{t.packed={...(t.packed||{})};if(c.checked)t.packed[c.dataset.pack]=true;else delete t.packed[c.dataset.pack]})));
 $$("[data-unpack]",root).forEach(b=>b.addEventListener("click",()=>touch(()=>{const id=b.dataset.unpack;t.garmentIds=t.garmentIds.filter(x=>x!==id);if(t.packed)delete t.packed[id]})));
 $("#tripAdd")?.addEventListener("click",()=>{const id=$("#tripAddSelect").value;if(id)touch(()=>{t.garmentIds=[...t.garmentIds,id]})});
 $$("[data-extra]",root).forEach(c=>c.addEventListener("change",()=>touch(()=>{const x=t.extras.find(e=>e.id===c.dataset.extra);if(x)x.done=c.checked})));
 $$("[data-extra-remove]",root).forEach(b=>b.addEventListener("click",()=>touch(()=>{t.extras=t.extras.filter(e=>e.id!==b.dataset.extraRemove)})));
 $("#extraForm")?.addEventListener("submit",e=>{e.preventDefault();const text=$("#extraText").value.trim();if(text)touch(()=>{t.extras=[...(t.extras||[]),{id:uid(),text,done:false}]})});
 $$("[data-trip-look]",root).forEach(b=>b.addEventListener("click",async()=>{const l=examples[Number(b.dataset.tripLook)];if(!l)return;
  const sig=l.map(x=>x.id).sort().join("|");if(myLooks().some(x=>(x.garmentIds||[]).slice().sort().join("|")===sig))return toast("Ese look ya está guardado");
  await mutate(()=>myLooks().unshift({id:uid(),name:"Viaje: "+t.name,garmentIds:l.map(x=>x.id),occasion:"travel",ai:false,updatedAt:new Date().toISOString()}),"Look guardado")}));
 $("#tripDelete")?.addEventListener("click",async()=>{if(!confirm("¿Eliminar la maleta «"+t.name+"»?"))return;const id=t.id;if(await mutate(()=>{appState.data.trips=myTrips().filter(x=>x.id!==id);tomb(id)},"Maleta eliminada")){ui.tripId="";render()}});
}

/* ===================== 8. Compras ===================== */
let buyCheck=null;
function evaluateCandidate(c){
 const gs=myGarments(),compatible=gs.filter(g=>pairs(c,g)),core=compatible.filter(g=>!c.category||(CORE[c.category]||[]).includes(g.category));
 const duplicates=gs.filter(g=>isDuplicate(c,g)),rescued=gs.filter(g=>pairs(c,g)&&gs.filter(o=>pairs(g,o)).length<2);
 const reasons=[];let verdict,tone;
 if(duplicates.length>=2){verdict="No lo necesitas";tone="bad";reasons.push("Ya tienes "+duplicates.length+" prendas muy parecidas.")}
 else if(core.length>=3&&!duplicates.length){verdict="Cómpralo";tone="good";reasons.push("Combina con "+plural(compatible.length,"prenda","prendas")+" de tu armario.")}
 else if(core.length>=3){verdict="Piénsalo";tone="mid";reasons.push("Encaja bien, pero se parece a «"+duplicates[0].name+"».")}
 else{verdict="Piénsalo";tone="mid";reasons.push(core.length?"Solo combina con "+plural(core.length,"prenda clave","prendas clave")+" de tu armario.":"Ahora mismo no tienes con qué combinarla"+(c.category&&CORE[c.category]?" (te faltaría: "+CORE[c.category].join(" o ").toLocaleLowerCase("es")+")":"")+".")}
 if(rescued.length)reasons.push("Daría salida a "+plural(rescued.length,"prenda","prendas")+" que ahora casi no combinas.");
 const p=appState.data.preferences,pending=appState.data.wishlist.filter(w=>!w.bought).reduce((s,w)=>s+(Number(w.price)||0),0);
 if(Number(c.price)>0&&Number(p.budget)>=0&&pending+Number(c.price)>Number(p.budget))reasons.push("Con tu wishlist pendiente superaría tu presupuesto de "+euro(p.budget)+".");
 if(!gs.length)reasons.push("Añade prendas a tu armario para que el veredicto sea fiable.");
 return {verdict,tone,reasons,compatible,core,duplicates,rescued};
}
function buyCheckHtml(){
 const c=buyCheck;
 let html='<div class="feature-card" id="buyCheck"><h2>¿Lo compro?</h2><p class="muted">Haz una foto a la prenda en la tienda o sube una captura. Te digo con qué combina de tu armario y si se parece a algo que ya tienes.</p>'+
  '<div class="photo-buttons"><button type="button" class="primary" data-photo-pick="buyCamera">📷 Hacer foto</button><button type="button" class="secondary" data-photo-pick="buyImage">🖼️ Galería</button></div>'+
  '<input id="buyCamera" class="file-hidden" type="file" tabindex="-1" accept="image/*" capture="environment" aria-label="Hacer foto con la cámara"><input id="buyImage" class="file-hidden" type="file" tabindex="-1" accept="image/*" aria-label="Elegir foto de la galería">';
 if(!c)return html+'</div>';
 if(c.loading)return html+'<p class="muted">Analizando la prenda…</p></div>';
 const r=evaluateCandidate(c);
 html+='<div class="buy-head">'+(validImage(c.image)?'<img class="buy-img" src="'+c.image+'" alt="Prenda que estás valorando">':'')+
  '<div class="buy-fields"><label class="field"><span>Nombre</span><input id="buyName" maxlength="80" value="'+fx(c.name)+'"></label>'+
  '<div class="filter-grid"><label class="field"><span>Categoría</span><select id="buyCategory">'+optionList([["","Sin categoría"],...CATEGORIES.map(x=>[x,x])],c.category)+'</select></label>'+
  '<label class="field"><span>Color</span><input id="buyColor" maxlength="60" value="'+fx(c.color)+'"></label>'+
  '<label class="field"><span>Estilo</span><select id="buyStyle">'+optionList([["","Sin definir"],...Object.entries(styleNames)],c.style)+'</select></label>'+
  '<label class="field"><span>Temporada</span><select id="buySeason">'+optionList(Object.entries(seasons),c.season||"all")+'</select></label>'+
  '<label class="field"><span>Precio (€)</span><input id="buyPrice" type="number" min="0" step=".01" inputmode="decimal" value="'+fx(c.price??"")+'"></label></div></div></div>'+
  (c.analyzeFailed?'<p class="error">No se pudo analizar la foto. Completa categoría y color a mano para ver el veredicto.</p>':'')+
  '<div class="verdict '+r.tone+'"><strong>'+fx(r.verdict)+'</strong>'+r.reasons.map(x=>'<p>'+fx(x)+'</p>').join("")+'</div>'+
  '<h3 class="mini-title">Combina con ('+r.compatible.length+')</h3>'+(r.compatible.length?thumbs(r.compatible):'<p class="muted">Ninguna prenda de tu armario.</p>')+
  (r.duplicates.length?'<h3 class="mini-title">Se parece a ('+r.duplicates.length+')</h3>'+thumbs(r.duplicates):'')+
  '<button class="secondary wide" id="buyLooks"'+(r.compatible.length?'':' disabled')+'>✦ Ver looks con la IA</button>'+
  (c.looks?c.looks.length?'<div class="grid buy-looks">'+c.looks.map(l=>{const gs=l.ids.map(id=>id==="__nueva__"?{name:c.name||"Prenda nueva",image:c.image}:myGarments().find(g=>g.id===id)).filter(Boolean),imgs=gs.map(g=>g.image).filter(validImage);return '<article class="card">'+collage(imgs,imgs.length-4)+'<div class="card-body"><div class="card-title">'+fx(l.why)+'</div><div class="look-items">'+gs.map(g=>'<span class="look-chip">'+fx(g.name)+'</span>').join("")+'</div></div></article>'}).join("")+'</div>':'<p class="muted">La IA no ha propuesto looks con esta prenda. Prueba a cambiar la ocasión en Estilista.</p>':'')+
  '<p class="helper">El veredicto se calcula en tu móvil con reglas de color, categoría, estilo y temporada; es orientativo y no gasta tokens.</p>'+
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
 try{const out=await api("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image})});const d=mapAnalysis(out.garment||out.result||out);Object.assign(c,d,{season:d.season||"all",notes:undefined})}
 catch(e){console.error("BUY_ANALYZE",e);c.analyzeFailed=true;if(e.message==="SESSION_EXPIRED"){buyCheck=null;return}}
 if(buyCheck?.image===image){buyCheck=c;render();$("#buyCheck")?.scrollIntoView?.({block:"start",behavior:"smooth"})}
}
async function buyLooks(){
 readBuyFields();const c=buyCheck;if(!c)return;
 const btn=$("#buyLooks");if(btn){btn.disabled=true;btn.textContent="Pensando…"}
 const r=evaluateCandidate(c),p=appState.data.preferences;
 const items=[{i:"__nueva__",n:c.name||"Prenda nueva",c:c.category,color:c.color,style:c.style,pattern:c.pattern||"",formality:c.formality||""},
  ...r.compatible.slice(0,20).map(g=>({i:g.id,n:g.name,c:g.category||"",color:g.color||"",style:g.style||"",pattern:g.pattern||"",formality:g.formality||""}))];
 try{
  const out=await api("/api/looks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items,need:3,occasion:p.occasion||"daily",season:c.season||"all",weather:currentTemperature()+" °C",avoid:[]})});
  const allowed=new Set(items.map(x=>x.i));
  c.looks=(Array.isArray(out.looks)?out.looks:[]).map(l=>({why:String(l.why||"Look sugerido").slice(0,80),ids:[...new Set(Array.isArray(l.ids)?l.ids:[])].filter(id=>allowed.has(id)).slice(0,6)})).filter(l=>l.ids.includes("__nueva__")&&l.ids.length>=2);
 }catch(e){console.error("BUY_LOOKS",e);if(e.message!=="AI_QUOTA")toast(e.message==="SESSION_EXPIRED"?"La sesión ha caducado":"No se pudieron generar looks");if(btn){btn.disabled=false;btn.textContent="✦ Ver looks con la IA"}return}
 if(buyCheck===c)render();
}
/* Recomendaciones de compra: un catálogo de básicos evaluado contra el armario (sin IA) */
const CATALOG=[
 ["Camiseta blanca básica","Arriba","Blanco","casual","all"],["Camiseta negra básica","Arriba","Negro","casual","all"],
 ["Camisa blanca","Arriba","Blanco","smart","all"],["Camisa vaquera","Arriba","Vaquero","casual","all"],
 ["Blusa beige fluida","Arriba","Beige","smart","all"],["Camiseta de rayas marineras","Arriba","Blanco y marino","casual","all","stripes"],
 ["Jersey de punto gris","Arriba","Gris","casual","cold"],["Jersey camel","Arriba","Camel","smart","cold"],
 ["Jersey azul marino","Arriba","Azul marino","casual","cold"],["Top negro de tirantes","Arriba","Negro","party","warm"],
 ["Vaquero recto azul","Abajo","Vaquero","casual","all"],["Vaquero negro","Abajo","Negro","casual","all"],
 ["Pantalón negro de vestir","Abajo","Negro","smart","all"],["Pantalón beige ancho","Abajo","Beige","smart","all"],
 ["Falda midi negra","Abajo","Negro","smart","all"],["Pantalón blanco","Abajo","Blanco","casual","warm"],
 ["Falda vaquera","Abajo","Vaquero","casual","warm"],
 ["Vestido negro sencillo","Vestidos","Negro","party","all"],["Vestido camisero beige","Vestidos","Beige","smart","warm"],
 ["Blazer negro","Capas","Negro","smart","all"],["Blazer camel","Capas","Camel","smart","all"],
 ["Gabardina beige","Capas","Beige","smart","all"],["Chaqueta vaquera","Capas","Vaquero","casual","all"],
 ["Cárdigan crudo","Capas","Crudo","casual","all"],["Abrigo camel","Capas","Camel","smart","cold"],
 ["Cazadora de piel negra","Capas","Negro","casual","all"],
 ["Zapatillas blancas","Zapatos","Blanco","casual","all"],["Botines negros","Zapatos","Negro","casual","cold"],
 ["Mocasines negros","Zapatos","Negro","smart","all"],["Sandalias planas camel","Zapatos","Camel","casual","warm"],
 ["Salones nude","Zapatos","Nude","party","all"],
 ["Bolso negro de hombro","Bolsos","Negro","smart","all"],["Bolso camel","Bolsos","Camel","casual","all"],
 ["Cinturón negro de piel","Accesorios","Negro","smart","all"]
].map(([name,category,color,style,season,pattern])=>({name,category,color,style,season,pattern:pattern||"plain"}));
function simulate(c,gs,bases){
 let looks=[];
 if(c.category==="Arriba")looks=gs.filter(g=>g.category==="Abajo"&&pairs(c,g)).map(b=>[c,b]);
 else if(c.category==="Abajo")looks=gs.filter(g=>g.category==="Arriba"&&pairs(c,g)).map(t=>[t,c]);
 else if(c.category==="Vestidos")looks=gs.filter(g=>["Zapatos","Capas"].includes(g.category)&&pairs(c,g)).map(e=>[c,e]);
 else looks=bases.filter(p=>p.every(x=>pairs(c,x))).map(p=>[...p,c]);
 const complete=c.category==="Zapatos"?looks.filter(l=>!gs.some(g=>g.category==="Zapatos"&&l.slice(0,-1).every(p=>pairs(g,p)))).length:0;
 const examples=looks.slice(0,40).map(l=>{if(["Arriba","Abajo"].includes(c.category)){const rest=l.filter(x=>x!==c),s=gs.find(g=>g.category==="Zapatos"&&pairs(g,c)&&rest.every(p=>pairs(g,p)));return s?[...l,s]:l}return l});
 examples.sort((a,b)=>b.length-a.length);
 return {count:looks.length,complete,examples:examples.slice(0,2)};
}
function shoppingSuggestions(){
 const gs=myGarments(),bases=outfitBases(gs),season=thisSeason(),wished=new Set(appState.data.wishlist.map(w=>norm(w.name)));
 const lonely=new Set(gs.filter(g=>gs.filter(o=>pairs(g,o)).length<2).map(g=>g.id)),partner={Arriba:["Abajo"],Abajo:["Arriba"]},out=[];
 for(const c of CATALOG){
  if(wished.has(norm(c.name))||gs.some(g=>isDuplicate(c,g)))continue;
  const compatible=gs.filter(g=>pairs(c,g));if(!compatible.length)continue;
  const sim=simulate(c,gs,bases),rescued=compatible.filter(g=>lonely.has(g.id)&&(partner[c.category]||[]).includes(g.category));
  if(sim.count<2&&!rescued.length)continue;
  const seasonBoost=c.season==="all"?1:c.season===season?1.2:.5;
  const value=["Arriba","Abajo","Vestidos"].includes(c.category)?sim.count*2:c.category==="Zapatos"?sim.complete*2+sim.count*.3:c.category==="Capas"?sim.count*.6:sim.count*.25;
  out.push({c,compatible,rescued,looks:sim.count,complete:sim.complete,examples:sim.examples,score:(value+rescued.length*3+compatible.length*.3)*seasonBoost});
 }
 out.sort((a,b)=>b.score-a.score);
 const perCat={},picked=[];
 for(const s of out){if((perCat[s.c.category]||0)>=2)continue;perCat[s.c.category]=(perCat[s.c.category]||0)+1;picked.push(s);if(picked.length>=6)break}
 return picked;
}
function suggestionCard(s,i){
 const c=s.c,why=["Combina con "+plural(s.compatible.length,"prenda","prendas")+" de tu armario."],core=["Arriba","Abajo","Vestidos"].includes(c.category);
 if(core&&s.looks)why.push("Te da "+plural(s.looks,"look nuevo","looks nuevos")+".");
 else if(c.category==="Zapatos"&&s.complete)why.push("Completa "+plural(s.complete,"look","looks")+" que ahora no tienen calzado a juego.");
 else if(c.category==="Capas"&&s.looks)why.push("Puedes llevarla encima de "+s.looks+" de tus looks.");
 else if(s.looks)why.push("Encaja con "+s.looks+" de tus looks.");
 if(s.rescued.length)why.push("Le da salida a "+s.rescued.slice(0,2).map(g=>"«"+g.name+"»").join(" y ")+(s.rescued.length>2?" y "+(s.rescued.length-2)+" más":"")+", que ahora casi no combinas.");
 const piece=g=>'<span class="look-chip'+(g.id?'':' new')+'">'+fx(g.name)+'</span>';
 return '<div class="suggestion"><div class="suggestion-head"><div><strong>'+fx(c.name)+'</strong><p class="muted">'+fx(c.category+" · "+c.color+" · "+(styleNames[c.style]||"")+(c.season!=="all"?" · "+seasons[c.season]:""))+'</p></div>'+
  (core&&s.looks?'<span class="looks-badge">+'+s.looks+' looks</span>':c.category==="Zapatos"&&s.complete?'<span class="looks-badge">completa '+s.complete+'</span>':'')+'</div>'+
  '<p class="suggestion-why">'+fx(why.join(" "))+'</p>'+thumbs(s.compatible,8)+
  (s.examples.length?'<div class="suggestion-examples">'+s.examples.map(l=>'<div class="example-line"><span class="muted">Por ejemplo:</span>'+l.map(piece).join("")+'</div>').join("")+'</div>':'')+
  '<div class="suggestion-actions"><button class="chip-button" data-suggest-wish="'+i+'">♡ A la wishlist</button>'+
  '<a class="chip-button" href="https://www.google.com/search?tbm=shop&q='+encodeURIComponent(c.name+" mujer")+'" target="_blank" rel="noopener noreferrer">Buscar en tiendas ↗</a></div></div>';
}
let suggestionCache={key:"",list:[]};
function suggestionsHtml(){
 const gs=myGarments();
 let html='<div class="feature-card" id="suggestions"><h2>Te recomiendo comprar</h2>';
 if(gs.length<5)return html+'<p class="muted">Añade al menos 5 prendas a tu armario y te diré qué piezas te darían más looks nuevos.</p></div>';
 const key=JSON.stringify([gs.map(g=>[g.id,g.category,g.color,g.style,g.season,g.pattern]),appState.data.wishlist.map(w=>w.name)]);
 if(suggestionCache.key!==key)suggestionCache={key,list:shoppingSuggestions()};
 const list=suggestionCache.list;
 return html+'<p class="muted">Prendas básicas que más partido sacarían a lo que ya tienes. Descarto las que se parecen a algo de tu armario.</p>'+
  (list.length?list.map(suggestionCard).join(""):'<p>Tu armario ya está muy completo: ninguna prenda básica te daría looks nuevos. Prioriza combinar lo que tienes.</p>')+
  '<p class="helper">Calculado en tu móvil, sin gastar tokens. Cuando la veas en tienda, hazle una foto en «¿Lo compro?» para comprobar esa prenda concreta.</p></div>';
}
function wishlistHtml(){
 const wishlist=appState.data.wishlist.filter(w=>ui.wishlistFilter!=="pending"||!w.bought);
 const existingCats=new Set(myGarments().map(g=>g.category)),total=appState.data.wishlist.filter(w=>!w.bought).reduce((s,w)=>s+(Number(w.price)||0),0);
 const gaps=[["Zapatos","Zapatos"],["Arriba","Prendas superiores"],["Abajo","Prendas inferiores"],["Capas","Capas y abrigos"],["Accesorios","Accesorios"]].filter(x=>!existingCats.has(x[0]));
 const budget=Number(appState.data.preferences.budget)||0,over=total>budget;
 return '<div class="stats">'+miniStat("pendientes",appState.data.wishlist.filter(w=>!w.bought).length)+miniStat("total previsto",euro(total))+'</div>'+
  '<div class="budget-line'+(over?' over':'')+'"><span>'+fx(over?"Tu wishlist pendiente supera tu presupuesto de "+euro(budget)+" en "+euro(total-budget)+".":"Tu wishlist cabe en tu presupuesto de "+euro(budget)+".")+'</span><button class="chip-button" id="editBudget">Cambiar</button></div>'+
  '<div class="feature-card"><h2>Mi wishlist</h2><form id="wishlistForm"><label class="field"><span>Prenda que quiero</span><input name="wishName" maxlength="80" required placeholder="Por ejemplo, abrigo camel"></label>'+
  '<div class="filter-grid"><label class="field"><span>Precio (€)</span><input name="wishPrice" type="number" min="0" max="100000" step=".01" inputmode="decimal"></label>'+
  '<label class="field"><span>Categoría</span><select name="wishCategory">'+optionList([["","Sin categoría"],...CATEGORIES.map(x=>[x,x])],"")+'</select></label></div>'+
  '<label class="field"><span>Enlace (opcional)</span><input name="wishUrl" type="url" placeholder="https://..."></label>'+
  '<button class="primary wide" type="submit">Añadir a mi lista</button></form></div>'+
  '<div class="section-head"><h2>Mis deseos</h2><button id="wishPending" class="secondary">'+(ui.wishlistFilter==="pending"?"Ver todos":"Solo pendientes")+'</button></div>'+
  (wishlist.length?'<div class="insight-list">'+wishlist.map(w=>{const similar=myGarments().filter(g=>g.category&&g.category===w.category).length,link=/^https?:\/\//i.test(w.url||"")?'<a href="'+fx(w.url)+'" rel="noopener noreferrer" target="_blank">Ver tienda ↗</a>':"";return '<div class="wish-row"><div><strong>'+fx(w.name)+'</strong><p class="muted">'+euro(w.price)+(w.verdict?' · '+fx(w.verdict):'')+(w.bought?' · Comprada':'')+(similar?' · '+plural(similar,"prenda","prendas")+' de esa categoría en tu armario':'')+'</p>'+link+'</div><div class="wish-actions"><button class="chip-button" data-wish-bought="'+fx(w.id)+'">'+(w.bought?'Pendiente':'Comprada ✓')+'</button><button class="chip-button" data-wish-remove="'+fx(w.id)+'" aria-label="Quitar">✕</button></div></div>'}).join("")+'</div>':'<div class="empty">Tu lista está vacía.</div>')+
  (gaps.length?'<p class="helper">Categorías que aún no tienes en el armario: '+fx(gaps.map(x=>x[1].toLocaleLowerCase("es")).join(", "))+'.</p>':'');
}
function renderShopping(root){
 const pending=appState.data.wishlist.filter(w=>!w.bought).length;
 const body=ui.shopTab==="suggest"?suggestionsHtml():ui.shopTab==="wish"?wishlistHtml():buyCheckHtml();
 root.innerHTML=heroHtml("Compras inteligentes","Compra solo lo que de verdad combina con tu ropa.")+tabsHtml("shop",[["buy","¿Lo compro?"],["suggest","Recomendaciones"],["wish","Wishlist"+(pending?" ("+pending+")":"")]],ui.shopTab)+body;
 $$("[data-shop-tab]",root).forEach(b=>b.addEventListener("click",()=>{ui.shopTab=b.dataset.shopTab;render()}));
 $$("[data-thumb]",root).forEach(b=>b.addEventListener("click",()=>openGarment(b.dataset.thumb)));
 // ¿Lo compro?
 for(const id of ["buyImage","buyCamera"])$("#"+id)?.addEventListener("change",e=>{const f=e.target.files[0];if(f)startBuyCheck(f)});
 for(const id of ["buyName","buyColor","buyPrice","buyCategory","buyStyle","buySeason"])$("#"+id)?.addEventListener("change",()=>{readBuyFields();buyCheck.looks=null;render()});
 $("#buyLooks")?.addEventListener("click",buyLooks);
 $("#buyReset")?.addEventListener("click",()=>{buyCheck=null;render()});
 $("#buyWish")?.addEventListener("click",async()=>{readBuyFields();const c=buyCheck,r=evaluateCandidate(c);
  await mutate(()=>appState.data.wishlist.unshift({id:uid(),name:c.name||"Prenda sin nombre",price:Number(c.price)||0,category:c.category,url:"",bought:false,addedAt:dayISO(),verdict:r.verdict,updatedAt:new Date().toISOString()}),"Añadida a la wishlist")});
 $("#buyAdd")?.addEventListener("click",async()=>{readBuyFields();const c=buyCheck;if(!validImage(c.image))return;
  if(!confirm("¿Añadir esta prenda a tu armario?"))return;
  const now=new Date().toISOString();
  const ok=await mutate(()=>myGarments().unshift({...cleanAnalysis(c),id:uid(),name:c.name||"Prenda nueva",category:c.category,color:c.color,notes:"",season:c.season||"all",style:c.style,price:c.price,boughtAt:dayISO(),favorite:false,createdAt:now,image:c.image,imageAt:now,updatedAt:now}),"Prenda añadida a tu armario");
  if(ok){buyCheck=null;render()}});
 // Recomendaciones
 $$("[data-suggest-wish]",root).forEach(b=>b.addEventListener("click",async()=>{const s=suggestionCache.list[Number(b.dataset.suggestWish)];if(!s)return;
  await mutate(()=>appState.data.wishlist.unshift({id:uid(),name:s.c.name,price:0,category:s.c.category,url:"",bought:false,addedAt:dayISO(),verdict:"Recomendada",updatedAt:new Date().toISOString()}),"Añadida a la wishlist")}));
 // Wishlist
 $("#wishlistForm")?.addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(e.target),name=String(fd.get("wishName")||"").trim(),url=String(fd.get("wishUrl")||"").trim();if(!name)return;if(url&&!/^https?:\/\//i.test(url))return toast("El enlace debe ser HTTPS o HTTP");
  await mutate(()=>appState.data.wishlist.unshift({id:uid(),name,price:Number(fd.get("wishPrice"))||0,category:String(fd.get("wishCategory")||""),url,bought:false,addedAt:dayISO(),updatedAt:new Date().toISOString()}),"Añadido a la wishlist")});
 $("#wishPending")?.addEventListener("click",()=>{ui.wishlistFilter=ui.wishlistFilter==="all"?"pending":"all";render()});
 $("#editBudget")?.addEventListener("click",()=>{setView("settings");setTimeout(()=>{const i=$("#shoppingBudget");i?.scrollIntoView?.({block:"center"});i?.focus()},50)});
 $$("[data-wish-bought]",root).forEach(b=>b.addEventListener("click",async()=>{const w=appState.data.wishlist.find(w=>w.id===b.dataset.wishBought);if(w)await mutate(()=>{w.bought=!w.bought;w.updatedAt=new Date().toISOString()},"Compra actualizada")}));
 $$("[data-wish-remove]",root).forEach(b=>b.addEventListener("click",async()=>{if(!confirm("¿Quitar de la wishlist?"))return;const id=b.dataset.wishRemove;await mutate(()=>{appState.data.wishlist=appState.data.wishlist.filter(w=>w.id!==id);tomb(id)},"Eliminado")}));
}

/* ===================== 9. Análisis y calendario ===================== */
function renderInsights(root){
 const gs=myGarments(),n=logs().length,forgotten=gs.filter(g=>forgottenStatus(g).forgotten),never=gs.filter(g=>!lastWorn(g.id)),priced=gs.filter(g=>g.price!==null&&g.price!==undefined),totalValue=priced.reduce((s,g)=>s+(Number(g.price)||0),0);
 const cats=[...new Set(gs.map(g=>g.category||"Sin categoría"))].map(c=>({name:c,n:gs.filter(g=>(g.category||"Sin categoría")===c).length})).sort((a,b)=>b.n-a.n);
 const ranked=gs.slice().sort((a,b)=>wornCount(b.id)-wornCount(a.id)),top=Math.max(1,ranked.length?wornCount(ranked[0].id):1);
 root.innerHTML=heroHtml("Tu armario en cifras","Decisiones basadas en usos que hayas registrado.")+
  '<div class="stats">'+miniStat("prendas",gs.length)+miniStat("usos registrados",n)+miniStat("olvidadas",forgotten.length)+miniStat("valor registrado",euro(totalValue))+'</div>'+
  '<div class="actions"><button class="primary" id="goCalendar">Calendario e historial</button><button class="secondary" id="goForgotten">Ver olvidadas</button></div>'+
  '<div class="feature-card"><div class="section-head"><h2>Prendas olvidadas</h2><button class="secondary" id="configureForget">Configurar</button></div>'+
  '<p class="muted">Sin utilizar durante al menos '+fx(appState.data.preferences.forgottenDays)+' días. Excluimos las prendas fuera de temporada.</p>'+
  (forgotten.length?'<div class="insight-list">'+forgotten.map(g=>'<div class="list-line"><strong>'+fx(g.name)+'</strong><span class="muted">'+fx(forgottenStatus(g).age)+' días · '+fx(forgottenStatus(g).reason)+'</span></div>').join("")+'</div>':'<p>De momento no hay prendas identificadas como olvidadas.</p>')+
  '<p class="helper">'+plural(never.length,"prenda","prendas")+' sin usos registrados. Esto no demuestra que nunca te las hayas puesto.</p></div>'+
  '<div class="feature-card"><h2>Rotación de prendas</h2><div class="insight-list">'+(ranked.length?ranked.slice(0,12).map(g=>'<div class="progress-row"><span>'+fx(g.name)+'</span><div class="progress-track"><div style="width:'+Math.round(100*wornCount(g.id)/top)+'%"></div></div><strong>'+wornCount(g.id)+'</strong></div>').join(""):'Añade prendas para ver su rotación.')+'</div></div>'+
  '<div class="feature-card"><h2>Distribución por categorías</h2><div class="insight-list">'+cats.map(c=>'<div class="progress-row"><span>'+fx(c.name)+'</span><div class="progress-track"><div style="width:'+Math.round(100*c.n/Math.max(1,gs.length))+'%"></div></div><strong>'+c.n+'</strong></div>').join("")+'</div></div>'+
  '<div class="feature-card"><h2>Coste por uso</h2><p class="helper">Disponible cuando introduces el precio de compra y registras usos.</p>'+
  (priced.length?'<div class="insight-list">'+priced.filter(g=>wornCount(g.id)>0).sort((a,b)=>(Number(b.price)/wornCount(b.id))-(Number(a.price)/wornCount(a.id))).slice(0,12).map(g=>'<div class="list-line"><strong>'+fx(g.name)+'</strong><span>'+euro(g.price/wornCount(g.id))+' / uso</span></div>').join("")+'</div>':'<p>Registra el precio de tus prendas para calcularlo.</p>')+'</div>';
 $("#goCalendar")?.addEventListener("click",()=>setView("calendar"));
 $("#goForgotten")?.addEventListener("click",()=>{ui.onlyForgotten=true;ui.search="";setView("wardrobe")});
 $("#configureForget")?.addEventListener("click",()=>{const v=prompt("Días sin usar para considerar una prenda olvidada (30–365)",appState.data.preferences.forgottenDays);if(v===null)return;const n=Number(v);if(!Number.isInteger(n)||n<30||n>365)return toast("Introduce entre 30 y 365 días");setPref("forgottenDays",n)});
}
function renderCalendar(root){
 const month=ui.calendarMonth,year=Number(month.slice(0,4)),mon=Number(month.slice(5,7)),days=new Date(year,mon,0).getDate(),first=(new Date(year,mon-1,1).getDay()+6)%7,byDay=new Map();
 for(const entry of logs())if(entry.date?.startsWith(month))byDay.set(entry.date,(byDay.get(entry.date)||0)+1);
 let grid="<div class='calendar-grid'>"+["L","M","X","J","V","S","D"].map(d=>'<span class="weekday">'+d+'</span>').join("");
 for(let i=0;i<first;i++)grid+='<span></span>';
 for(let d=1;d<=days;d++){const date=month+"-"+String(d).padStart(2,"0"),count=byDay.get(date)||0;grid+='<button class="cal-day '+(count?"used":"")+'" data-cal-date="'+date+'"><strong>'+d+'</strong>'+(count?'<small>'+plural(count,"uso","usos")+'</small>':"")+'</button>'}
 grid+="</div>";
 const history=logs().slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,60);
 root.innerHTML=heroHtml("Calendario de looks","Solo los días que hayas registrado; nunca inventamos usos.")+
  '<div class="feature-card"><label class="field"><span>Mes</span><input id="calendarMonth" type="month" value="'+fx(month)+'"></label>'+grid+'</div>'+
  '<div class="section-head"><h2>Historial de usos</h2><button class="secondary" id="backInsights">← Análisis</button></div>'+
  (history.length?'<div class="insight-list">'+history.map(l=>'<div class="history-line"><div><strong>'+fx(l.date)+'</strong><p class="muted">'+fx((l.garmentIds||[]).map(id=>myGarments().find(g=>g.id===id)?.name).filter(Boolean).join(" · "))+'</p></div><button class="chip-button" data-remove-use="'+fx(l.id)+'">Eliminar</button></div>').join("")+'</div>':'<div class="empty">Todavía no has registrado ningún conjunto utilizado.</div>');
 $("#calendarMonth")?.addEventListener("change",e=>{ui.calendarMonth=e.target.value||dayISO().slice(0,7);render()});
 $("#backInsights")?.addEventListener("click",()=>setView("insights"));
 $$("[data-cal-date]",root).forEach(b=>b.addEventListener("click",()=>{const day=b.dataset.calDate,items=logs().filter(l=>l.date===day);toast(items.length?plural(items.length,"uso registrado","usos registrados")+" el "+day:"Sin usos registrados el "+day)}));
 $$("[data-remove-use]",root).forEach(b=>b.addEventListener("click",async()=>{if(!confirm("¿Eliminar este registro de uso?"))return;const id=b.dataset.removeUse;await mutate(()=>{appState.data.wearLog=logs().filter(l=>l.id!==id);tomb(id)},"Registro eliminado")}));
}

/* ===================== 10. Ajustes y copias de seguridad ===================== */
function downloadBackup(){
 const payload=JSON.stringify({type:"atelier-backup",version:4,profile:appState.profile.id,exportedAt:new Date().toISOString(),data:appState.data});
 const url=URL.createObjectURL(new Blob([payload],{type:"application/json"})),a=document.createElement("a");
 a.href=url;a.download="atelier-"+appState.profile.id+"-"+dayISO()+".json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 setPref("lastBackupAt",new Date().toISOString());
}
async function importBackup(file){
 if(!file||file.size>60*1024*1024)return toast("Copia demasiado grande (máximo 60 MB)");
 try{
  const obj=JSON.parse(await file.text());
  if(obj?.type!=="atelier-backup"||obj.profile!==appState.profile.id||!obj.data||!Array.isArray(obj.data.garments)||!Array.isArray(obj.data.looks))return toast("Copia inválida o perteneciente a otro perfil");
  if(!confirm("¿Sustituir todos los datos actuales de "+appState.profile.name+" por esta copia? Esta acción no se puede deshacer."))return;
  const ids=d=>[...d.garments,...d.looks,...d.wishlist,...d.wearLog,...d.trips].map(x=>x.id);
  const current=new Set(ids(appState.data)),data=normalizeData(obj.data),kept=new Set(ids(data));
  await mutate(()=>{appState.data=data;for(const id of current)if(!kept.has(id))tomb(id)},"Copia restaurada");
 }catch(e){console.error("BACKUP",e);toast("No se pudo importar la copia")}
}
function renderSettings(root){
 const p=appState.data.preferences,u=aiUsage(),since=daysSince(p.lastBackupAt);
 const storage=storageInfo.persisted===true?"Almacenamiento protegido: el navegador no borrará estos datos automáticamente.":storageInfo.persisted===false?"El navegador no ha confirmado la protección del almacenamiento.":"";
 root.innerHTML=heroHtml("Ajustes","Perfil "+appState.profile.name)+
  '<div class="feature-card"><h2>Sincronización</h2><p class="muted" id="syncStatus">'+fx(syncStatusText())+'</p>'+
  (sync.status!=="off"?'<p class="helper">Tu armario y tus fotos se guardan en el servidor de Atelier, solo accesibles con tu contraseña. Así puedes cambiar de móvil o usar varios dispositivos.</p><button class="secondary wide" id="syncButton"'+(sync.status==="syncing"?' disabled':'')+'>↻ Sincronizar ahora</button>':'')+'</div>'+
  '<div class="feature-card"><h2>Compras</h2><label class="field"><span>Presupuesto de compras (€)</span><input id="shoppingBudget" type="number" min="0" max="100000" step="1" inputmode="numeric" value="'+fx(p.budget)+'"></label><p class="helper">Lo uso en la wishlist y en «¿Lo compro?» para avisarte si una compra te haría pasarte.</p></div>'+
  '<div class="feature-card"><h2>Preferencias del estilista</h2>'+
  '<label class="field"><span>Prenda olvidada tras (días)</span><input id="settingsForget" type="number" min="30" max="365" value="'+fx(p.forgottenDays)+'"></label>'+
  '<label class="field"><span>Diversidad de combinaciones: <strong id="settingsDiversityText">'+fx(p.diversity)+'</strong>%</span><input id="settingsDiversity" type="range" min="0" max="100" step="5" value="'+fx(p.diversity)+'"></label></div>'+
  '<div class="feature-card"><h2>Uso de la IA hoy</h2><p class="muted">Análisis de fotos: '+u.analyze+' de '+AI_LIMITS.analyze+'. Sugerencias de looks: '+u.looks+' de '+AI_LIMITS.looks+'.</p><p class="helper">Los límites diarios mantienen bajo el coste de la API. «¿Lo compro?», las recomendaciones y «Combinar prenda» no usan la IA.</p></div>'+
  '<div class="feature-card"><h2>Copias de seguridad</h2>'+(storage?'<p class="muted">'+fx(storage)+'</p>':'')+
  '<p class="muted">'+fx(isStandalone()?"Estás usando Atelier como app instalada.":"Estás usando Atelier desde el navegador, sin instalar.")+' '+fx(since===null?"Sin copias exportadas todavía.":"Última copia exportada hace "+plural(since,"día","días")+".")+'</p>'+
  '<button id="exportBackup" class="secondary wide">↓ Exportar copia JSON</button>'+
  '<label class="field"><span>Importar copia de este perfil</span><input id="importBackup" type="file" accept=".json,application/json"></label>'+
  '<p class="helper">La copia incluye fotografías y datos personales. Guárdala en un lugar privado.</p></div>'+
  '<button id="logout" class="danger wide">Cerrar sesión</button>';
 $("#syncButton")?.addEventListener("click",async e=>{e.target.disabled=true;e.target.textContent="Sincronizando…";$("#syncStatus").textContent="Sincronizando…";await syncNow();render()});
 $("#shoppingBudget")?.addEventListener("change",e=>{const n=Number(e.target.value);if(e.target.value===""||!Number.isFinite(n)||n<0)return toast("Introduce un importe en euros");setPref("budget",Math.round(n*100)/100,false);toast("Presupuesto guardado: "+euro(n))});
 $("#settingsForget")?.addEventListener("change",e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=30&&n<=365)setPref("forgottenDays",n);else toast("Introduce entre 30 y 365 días")});
 $("#settingsDiversity")?.addEventListener("input",e=>{$("#settingsDiversityText").textContent=e.target.value;setPref("diversity",Number(e.target.value),false)});
 $("#exportBackup")?.addEventListener("click",downloadBackup);
 $("#importBackup")?.addEventListener("change",e=>importBackup(e.target.files[0]));
 $("#logout")?.addEventListener("click",showAuth);
}

/* ===================== 11. Arranque ===================== */
function bind(){
 $$(".profile-option").forEach(b=>b.addEventListener("click",()=>selectProfile(b.dataset.profile)));
 $("#loginBtn").addEventListener("click",login);
 $("#togglePassword").addEventListener("click",()=>setPasswordVisible($("#password").type==="password"));
 $("#password").addEventListener("keydown",e=>{if(e.key==="Enter")login()});
 $$(".nav-btn").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
 $("#garmentForm").addEventListener("submit",saveGarment);$("#closeGarment").addEventListener("click",closeGarment);$("#deleteGarment").addEventListener("click",deleteGarment);$("#analyzeBtn").addEventListener("click",analyzeGarment);
 const onPhoto=async e=>{const f=e.target.files[0],p=$("#garmentPreview");if(!f)return;pendingPhoto=f;try{p.src=await readImage(f);p.classList.remove("hidden")}catch{pendingPhoto=null;p.src="";p.classList.add("hidden");return toast("No se pudo leer la foto")}
  if($("#autoAnalyze")?.checked)analyzeGarment()};
 $("#garmentImage").addEventListener("change",onPhoto);$("#garmentCamera").addEventListener("change",onPhoto);
 // Botones «Hacer foto» y «Galería»: abren el selector correspondiente (en la ficha y en «¿Lo compro?»)
 document.addEventListener("click",e=>{const b=e.target.closest?.("[data-photo-pick]");if(b)$("#"+b.dataset.photoPick)?.click()});
 buildMetadataSection();
 $("#lookForm").addEventListener("submit",saveLook);$("#closeLook").addEventListener("click",closeLook);$("#deleteLook").addEventListener("click",deleteLook);
 $("#profileName").addEventListener("click",()=>setView("settings"));
 // Al volver a la app tras un rato, se traen los cambios de otros dispositivos.
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&appState.profile)syncNow()});
}
document.addEventListener("DOMContentLoaded",async()=>{
 bind();
 if(!await restoreSession())showAuth();
 if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(e=>console.warn("SW",e));
});

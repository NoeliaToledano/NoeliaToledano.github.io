/* Atelier · Mi Armario — app web (PWA) para 3 perfiles familiares.
   Un solo archivo, sin capas de parches. Secciones:
   1. Configuración y utilidades       7. Estilista (explorar, combinar prenda, semana, tiempo)
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
const CATEGORIES=["Arriba","Abajo","Vestidos","Capas","Zapatos","Bolsos","Accesorios","Casa","Baño"];
const occasions={daily:"Día a día",work:"Trabajo",sport:"Deporte",beach:"Playa y piscina",home:"Estar en casa",event:"Eventos y celebraciones",party:"Fiesta y salir",formal:"Formal"};
const seasons={all:"Todo el año",warm:"Primavera / verano",cold:"Otoño / invierno"};
const styleNames={casual:"casual",smart:"arreglado",party:"fiesta",sport:"deporte"};
const ANALYSIS_FIELDS={pattern:["plain","stripes","checks","floral","animal","dots","graphic","other"],fabric:["unknown","cotton","denim","linen","wool","knit","leather","satin","silk","synthetic","mixed"],length:["na","cropped","regular","midi","long"],formality:["casual","smartcasual","formal","party","sport"]};

const emptyData=()=>({garments:[],looks:[],wishlist:[],wearLog:[],trips:[],plans:[],feedback:{},deleted:{},preferences:{forgottenDays:60,diversity:65,occasion:"daily",season:"all",budget:100,avoidRepeats:true,temperature:DEFAULT_TEMPERATURE}});
/* Un plan por día con id fijo plan:AAAA-MM-DD; los planes antiguos (id aleatorio) se migran y, si hay dos el mismo día, gana el más reciente */
function onePlanPerDay(list){
 const byDay=new Map();
 for(const p of list||[]){if(!validDay(p?.date))continue;const q=p.id==="plan:"+p.date?p:{...p,id:"plan:"+p.date};const o=byDay.get(p.date);if(!o||String(q.updatedAt||"")>String(o.updatedAt||""))byDay.set(p.date,q)}
 return [...byDay.values()];
}
function normalizeData(v){
 const d=emptyData();if(!v||typeof v!=="object")return d;
 // Claves que esta versión no conoce (de una versión más nueva): se conservan para no borrarlas al sincronizar
 for(const k of Object.keys(v))if(!(k in d)&&k!=="__proto__")d[k]=v[k];
 for(const key of ["garments","looks","wishlist","wearLog","trips","plans"])if(Array.isArray(v[key]))d[key]=v[key].filter(x=>x&&typeof x==="object"&&x.id);
 for(const key of ["feedback","deleted"])if(v[key]&&typeof v[key]==="object"&&!Array.isArray(v[key]))d[key]=v[key];
 if(v.preferences&&typeof v.preferences==="object")d.preferences={...d.preferences,...v.preferences};
 d.plans=onePlanPerDay(d.plans);
 return d;
}
/* Copia del estado sin duplicar las fotos: las cadenas de texto son inmutables, así que las fotos se comparten (R1).
   Antes, cada guardado copiaba todas las fotos (0,8 s con 500 prendas). */
const copyData=d=>{const imgs=(d.garments||[]).map(g=>g.image),c=structuredClone({...d,garments:(d.garments||[]).map(({image,...g})=>g)});
 c.garments.forEach((g,i)=>{if(imgs[i]!==undefined)g.image=imgs[i]});return c};
/* URL corta (blob:) para pintar la foto de una prenda, creada una vez por foto (R1).
   Así el HTML no lleva la foto entera dentro (44 MB por pintado con 500 prendas). g.image sigue siendo el data URL. */
const photoUrls=new Map();
function photoUrl(g){
 const src=g?.image;if(!validImage(src))return "";
 const c=photoUrls.get(g.id);if(c&&c.src===src)return c.url;
 try{const comma=src.indexOf(","),mime=src.slice(5,src.indexOf(";")),bin=atob(src.slice(comma+1)),u=new Uint8Array(bin.length);
  for(let k=0;k<bin.length;k++)u[k]=bin.charCodeAt(k);
  const url=URL.createObjectURL(new Blob([u],{type:mime}));if(c)URL.revokeObjectURL(c.url);photoUrls.set(g.id,{src,url});return url}
 catch{return src}
}
function clearPhotoUrls(){for(const c of photoUrls.values())URL.revokeObjectURL(c.url);photoUrls.clear()}
const appState={profile:null,token:null,data:emptyData(),view:"today",authExpired:false};
let lastSavedData=emptyData();
const ui={search:"",category:"",season:"",onlyFavorites:false,onlyForgotten:false,sort:"recent",calendarMonth:new Date().toISOString().slice(0,7),lookFilter:"all",wishlistFilter:"all",stylistTab:"today",shopTab:"buy",aroundId:"",tripId:"",todayOptionsOpen:false};

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
 ["patternScale","Tamaño del estampado",["small","medium","large"],"ia"],
 ["patternPlacement","Distribución del estampado",["localized","allover"],"ia"],
 ["patternContrast","Contraste del estampado",["low","medium","high"],"ia"],
 ["secondaryColor","Color secundario",60,"ia"],
 ["fabric","Tejido aparente",ANALYSIS_FIELDS.fabric,"ia"],
 ["denimWash","Lavado vaquero (si se distingue)",["raw","clean","light","medium","dark","stone","acid","bleached","gradient","other"],"ia"],
 ["fit","Corte",["oversize","holgado","regular","entallado","ajustado","recto"],"ia"],
 ["drape","Caída visual",["fluid","soft","structured"],"ia"],
 ["surfaceSheen","Brillo de la superficie",["matte","soft","shiny"],"ia"],
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
/* Fondo blanco, en el móvil y sin IA: separa la prenda del fondo por color y la coloca centrada sobre blanco,
   como en una tienda online. Hace crecer la zona de fondo desde los bordes de la foto mientras el color cambie
   poco entre píxeles vecinos y se parezca al del borde. Funciona bien con fotos sobre una superficie lisa
   (cama, suelo, pared); con fondos estampados o del mismo color que la prenda devuelve null y se deja la original. */
const WHITE_W=800,WHITE_H=1000,MASK_MAX=480;
const SRGB_LIN=Float32Array.from({length:256},(_,i)=>{const c=i/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)});
const origKey=id=>"orig:"+appState.profile.id+":"+id;  // foto original, solo en este dispositivo
/* R3: el retoque usa estos dos helpers para funcionar igual en la página y en el Worker (OffscreenCanvas) */
function mkCanvas(w,h){if(typeof document==="undefined")return new OffscreenCanvas(w,h);const c=document.createElement("canvas");c.width=w;c.height=h;return c}
async function toJpeg(c,q){if(c.toDataURL)return c.toDataURL("image/jpeg",q);return new FileReaderSync().readAsDataURL(await c.convertToBlob({type:"image/jpeg",quality:q}))}
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error("INVALID_IMAGE"));i.src=src})}
function labArrays(d,n){
 const L=new Float32Array(n),A=new Float32Array(n),B=new Float32Array(n),f=t=>t>.008856?Math.cbrt(t):7.787*t+.137931;
 for(let i=0,j=0;i<n;i++,j+=4){
  const r=SRGB_LIN[d[j]],g=SRGB_LIN[d[j+1]],b=SRGB_LIN[d[j+2]];
  const x=f((r*.4124+g*.3576+b*.1805)/.95047),y=f(r*.2126+g*.7152+b*.0722),z=f((r*.0193+g*.1192+b*.9505)/1.08883);
  L[i]=116*y-16;A[i]=500*(x-y);B[i]=200*(y-z);
 }
 return [L,A,B];
}
const quantile=(a,q)=>{const s=Float32Array.from(a).sort();return s.length?s[Math.min(s.length-1,Math.floor(q*s.length))]:0};
/* Máscara de la prenda frente al fondo, a resolución reducida; null si no se puede separar con fiabilidad */
function garmentMask(d,w,h,stats){
 const n=w*h,[L,A,B]=labArrays(d,n),band=Math.max(2,Math.round(Math.min(w,h)*.03)),border=[];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<band||y<band||x>=w-band||y>=h-band)border.push(y*w+x);
 const bl=quantile(border.map(i=>L[i]),.5),ba=quantile(border.map(i=>A[i]),.5),bb=quantile(border.map(i=>B[i]),.5);
 const dBg=i=>Math.hypot(L[i]-bl,A[i]-ba,B[i]-bb),dN=(i,j)=>Math.hypot(L[i]-L[j],A[i]-A[j],B[i]-B[j]);
 // Umbrales según lo uniforme que sea el fondo y el ruido de la foto
 const spread=quantile(border.map(dBg),.75),noise=quantile(border.filter(i=>i%w<w-1).map(i=>dN(i,i+1)),.5);
 const tGlobal=Math.min(40,Math.max(14,spread*1.8+10)),tLocal=Math.min(12,Math.max(4,noise*3+3));
 const bg=new Uint8Array(n),queue=new Int32Array(n);let qh=0,qt=0;
 for(const i of border)if(!bg[i]&&dBg(i)<tGlobal){bg[i]=1;queue[qt++]=i}
 const grow=(p,q)=>{if(!bg[q]&&dN(p,q)<tLocal&&dBg(q)<tGlobal){bg[q]=1;queue[qt++]=q}};
 while(qh<qt){const p=queue[qh++],x=p%w;if(x>0)grow(p,p-1);if(x<w-1)grow(p,p+1);if(p>=w)grow(p,p-w);if(p<n-w)grow(p,p+w)}
 const raw=n-bg.reduce((t,v)=>t+v,0);
 // Limpieza: (1) apertura (encoger y volver a crecer 3 px) para cortar líneas finas pegadas (juntas del suelo, sombras);
 // (2) solo las piezas grandes (≥ 15 % de la mayor: así caben los dos zapatos de un par) y, salvo la mayor, que no toquen el borde de la foto;
 // (3) se rellenan los huecos pequeños; los grandes se cuentan: si son muchos, el recorte se ha comido la prenda.
 const morph=(src,keep)=>{const o=new Uint8Array(n);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let all=1,any=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,v=xx>=0&&yy>=0&&xx<w&&yy<h?src[yy*w+xx]:0;all&=v;any|=v}
  o[y*w+x]=keep?all:any}return o};
 const notBg=Uint8Array.from(bg,v=>1-v);
 const opened=morph(morph(morph(morph(morph(morph(notBg,1),1),1),0),0),0);
 const labels=new Int32Array(n).fill(-1),parts=[];
 for(let s=0;s<n;s++){if(!opened[s]||labels[s]>=0)continue;const id=parts.length;let size=0;qh=qt=0;queue[qt++]=s;labels[s]=id;
  while(qh<qt){const p=queue[qh++],x=p%w;size++;for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,p>=w?p-w:-1,p<n-w?p+w:-1])if(q>=0&&opened[q]&&labels[q]<0){labels[q]=id;queue[qt++]=q}}
  parts.push(size)}
 const touches=new Uint8Array(parts.length);for(const i of border)if(labels[i]>=0)touches[labels[i]]=1;
 const biggest=parts.reduce((m,v)=>v>m?v:m,0),keepPart=parts.map((v,id)=>v>=Math.max(biggest*.15,n*.002)&&(v===biggest||!touches[id]));
 let near=Uint8Array.from(labels,l=>l>=0&&keepPart[l]?1:0);near=morph(morph(morph(near,0),0),0);
 let mask=Uint8Array.from(notBg,(v,i)=>v&near[i]);
 // Huecos: fondo rodeado de prenda
 const out=new Uint8Array(n);qh=qt=0;
 for(let i=0;i<n;i++){const x=i%w,y=(i-x)/w;if(!mask[i]&&(x===0||y===0||x===w-1||y===h-1)){out[i]=1;queue[qt++]=i}}
 while(qh<qt){const p=queue[qh++],x=p%w;for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,p>=w?p-w:-1,p<n-w?p+w:-1])if(q>=0&&!mask[q]&&!out[q]){out[q]=1;queue[qt++]=q}}
 let holes=0,fg=0,x0=w,y0=h,x1=-1,y1=-1;
 const hlab=new Int32Array(n).fill(-1);
 for(let s=0;s<n;s++){if(mask[s]||out[s]||hlab[s]>=0)continue;const list=[];qh=qt=0;queue[qt++]=s;hlab[s]=1;
  while(qh<qt){const p=queue[qh++],x=p%w;list.push(p);for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,p>=w?p-w:-1,p<n-w?p+w:-1])if(q>=0&&!mask[q]&&!out[q]&&hlab[q]<0){hlab[q]=1;queue[qt++]=q}}
  if(list.length<n*.004)for(const p of list)mask[p]=1;else holes+=list.length}
 for(let i=0;i<n;i++)if(mask[i]){fg++;const x=i%w,y=(i-x)/w;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
 // Solidez: prenda / su envolvente convexa (por piezas). Muy baja = recorte deshilachado
 let hullArea=0;
 parts.forEach((sz,id)=>{if(!keepPart[id])return;const lo=new Int32Array(h).fill(w),hi=new Int32Array(h).fill(-1);
  for(let i=0;i<n;i++)if(labels[i]===id){const x=i%w,y=(i-x)/w;if(x<lo[y])lo[y]=x;if(x>hi[y])hi[y]=x}
  const pts=[];for(let y=0;y<h;y++)if(hi[y]>=0)pts.push([lo[y],y],[hi[y]+1,y],[lo[y],y+1],[hi[y]+1,y+1]);
  pts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),L1=[],U=[];
  for(const p of pts){while(L1.length>1&&cr(L1[L1.length-2],L1[L1.length-1],p)<=0)L1.pop();L1.push(p)}
  for(const p of pts.slice().reverse()){while(U.length>1&&cr(U[U.length-2],U[U.length-1],p)<=0)U.pop();U.push(p)}
  const hull=L1.slice(0,-1).concat(U.slice(0,-1));let a2=0;for(let k=0;k<hull.length;k++){const p=hull[k],q=hull[(k+1)%hull.length];a2+=p[0]*q[1]-q[0]*p[1]}hullArea+=Math.abs(a2)/2});
 const keptOpen=parts.reduce((t,v,id)=>t+(keepPart[id]?v:0),0),solidity=hullArea?keptOpen/hullArea:0,holeFrac=holes/Math.max(1,fg+holes),kept=fg/Math.max(1,raw);
 // Contraste: parte de la prenda casi del color del fondo, y bordes «blandos» (prenda y fondo vecinos casi iguales)
 let nearC=0,bEdge=0,soft=0;
 for(let i=0;i<n;i++){if(!mask[i])continue;if(dBg(i)<tGlobal*1.6)nearC++;const x=i%w;
  for(const q of [x>0?i-1:-1,x<w-1?i+1:-1,i>=w?i-w:-1,i<n-w?i+w:-1])if(q>=0&&!mask[q]){bEdge++;if(dN(i,q)<tLocal*1.5)soft++;break}}
 const nearFrac=nearC/Math.max(1,fg),softFrac=soft/Math.max(1,bEdge);
 // Borde irregular (recorte «mordido»): longitud del borde frente al tamaño de la prenda
 const rough=bEdge/Math.sqrt(Math.max(1,fg));
 const frac=fg/n,edge=border.filter(i=>mask[i]).length/border.length,borderBg=border.filter(i=>bg[i]).length/border.length;
 if(stats)Object.assign(stats,{spread,noise,borderBg,edge,frac,chroma:Math.hypot(ba,bb),bl,solidity,holeFrac,kept,nearFrac,softFrac,tGlobal,tLocal,rough});
 // No se recorta si: casi nada o casi todo es prenda; la «prenda» toca mucho borde (llena la foto);
 // o el fondo no es liso (colores muy variados en el borde, como un cuarto desordenado)
 // Motivo (para explicar a la usuaria qué hacer): contraste, encuadre o fondo
 if(frac<.04){if(stats)stats.reason="contraste";return null}
 if(frac>.9||edge>.3){if(stats)stats.reason="encuadre";return null}
 if(spread>22||borderBg<.85){if(stats)stats.reason="fondo";return null}
 // Recorte dudoso (probado con fotos reales de ropa): se ha quedado con poca prenda tras limpiar,
 // la silueta es muy irregular o el borde está «mordido», o la prenda es casi del color del fondo y los bordes son blandos.
 // No se usa por defecto, pero se ofrece para que decida la usuaria.
 const doubtful=kept<.8||solidity<.68||rough>7||(softFrac>.5&&nearFrac>.9);
 // Recorte roto (se ha comido mucha prenda o queda deshilachado): el fondo blanco no se pone por defecto
 const broken=kept<.75||rough>11||softFrac>.85;
 // Borde suave: se encoge un poco (quita el halo del fondo) y se difumina
 // Con fondo de color fuerte (una tela roja) se encoge 1 px más, para que no quede un hilo de ese color
 if(Math.hypot(ba,bb)>25)mask=morph(mask,1);
 const alpha=new Float32Array(n);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!mask[i])continue;let sum=0,cnt=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;cnt++;sum+=mask[yy*w+xx]}
  alpha[i]=sum===cnt?1:Math.max(0,(sum-3)/(cnt-3))}
 // Color del fondo (para corregir el tono de la luz si el fondo es neutro)
 const rgb=[0,1,2].map(c=>quantile(border.filter(i=>bg[i]).map(i=>d[i*4+c]),.5));
 return {alpha,w,h,x0,y0,x1,y1,doubtful,broken,neutral:Math.hypot(ba,bb)<20&&bl>35,rgb};
}
/* Retoque de la foto (sin IA): luz, contraste suave, color algo más vivo y nitidez.
   curveLUT: tablas por canal con ganancia de color (gain), punto negro (lo) y estiramiento (scale), más una curva en S suave. */
const curveLUT=(gain,lo,scale)=>[0,1,2].map(c=>Uint8ClampedArray.from({length:256},(_,v)=>{let x=((v*gain[c]-lo)*scale+lo*.3)/255;x=Math.min(1,Math.max(0,x));x=x*.86+.14*x*x*(3-2*x);return Math.round(x*255)}));
function applyTone(p,lut,sat=1.08){
 for(let j=0;j<p.length;j+=4){if(p[j+3]===0)continue;const r=lut[0][p[j]],g=lut[1][p[j+1]],b=lut[2][p[j+2]],l=.299*r+.587*g+.114*b;p[j]=l+(r-l)*sat;p[j+1]=l+(g-l)*sat;p[j+2]=l+(b-l)*sat}
}
/* Enfoque suave (máscara de enfoque); el blanco puro del fondo no se toca */
function sharpen(ctx,w,h,amount=.45){
 const id=ctx.getImageData(0,0,w,h),p=id.data,s=Uint8ClampedArray.from(p),row=w*4;
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const j=(y*w+x)*4;if(s[j]>248&&s[j+1]>248&&s[j+2]>248)continue;
  for(let c=0;c<3;c++){const k=j+c,blur=(s[k-4]+s[k+4]+s[k-row]+s[k+row]+4*s[k])/8;p[k]=s[k]+amount*(s[k]-blur)}}
 ctx.putImageData(id,0,0);
}
/* Fondo blanco → {image, doubtful} o null. doubtful: puede que falte algún trozo de la prenda */
async function whiteBackground(src,info){ // info.reason: por qué no se pudo recortar
 try{
  const img=await loadImg(src),W=img.naturalWidth||img.width,H=img.naturalHeight||img.height;
  const k=Math.min(1,MASK_MAX/Math.max(W,H)),w=Math.max(1,Math.round(W*k)),h=Math.max(1,Math.round(H*k));
  const c=mkCanvas(w,h),cx=c.getContext("2d",{willReadFrequently:true});cx.drawImage(img,0,0,w,h);
  const small=cx.getImageData(0,0,w,h).data,st={},m=garmentMask(small,w,h,st);if(!m){if(info)info.reason=st.reason||"fondo";return null}
  // Recorte de la prenda con margen, a la resolución completa de la foto
  const s=W/w,pad=.04*Math.max(m.x1-m.x0,m.y1-m.y0);
  const fx0=Math.max(0,Math.floor((m.x0-pad)*s)),fy0=Math.max(0,Math.floor((m.y0-pad)*s)),fx1=Math.min(W,Math.ceil((m.x1+1+pad)*s)),fy1=Math.min(H,Math.ceil((m.y1+1+pad)*s));
  const cw=fx1-fx0,ch=fy1-fy0,fc=mkCanvas(cw,ch);
  const fcx=fc.getContext("2d",{willReadFrequently:true});fcx.drawImage(img,-fx0,-fy0);
  const id=fcx.getImageData(0,0,cw,ch),p=id.data,bgc=m.rgb;
  const a=(x,y)=>{x=Math.min(m.w-1,Math.max(0,x));y=Math.min(m.h-1,Math.max(0,y));return m.alpha[y*m.w+x]};
  for(let y=0;y<ch;y++){const my=(fy0+y+.5)/s-.5,yb=Math.floor(my),ty=my-yb;
   for(let x=0;x<cw;x++){const mx=(fx0+x+.5)/s-.5,xb=Math.floor(mx),tx=mx-xb,j=(y*cw+x)*4;
    const al=(a(xb,yb)*(1-tx)+a(xb+1,yb)*tx)*(1-ty)+(a(xb,yb+1)*(1-tx)+a(xb+1,yb+1)*tx)*ty;
    // Bordes sin halo: en los píxeles a medias se quita la parte del color del fondo
    if(al>.15&&al<.985)for(let q=0;q<3;q++)p[j+q]=(p[j+q]-(1-al)*bgc[q])/al;
    p[j+3]=Math.round(al*255)}}
  // Luz y color. Si el fondo es claro y casi neutro (sábana, pared), se toma como blanco: se quita el tono de la luz
  // (±12 %) y se aclara hasta un 30 %. Si no, solo se aclara (hasta un 20 %) cuando a la foto le faltan luces.
  const mean=(bgc[0]+bgc[1]+bgc[2])/3;let gain;
  if(m.neutral){const exp=Math.min(1.3,Math.max(1,236/Math.max(1,mean)));gain=bgc.map(v=>Math.min(1.12,Math.max(.88,mean/Math.max(1,v)))*exp)}
  else{const lum=[];for(let j=0;j<small.length;j+=8)lum.push(.299*small[j]+.587*small[j+1]+.114*small[j+2]);const hi=quantile(lum,.995);gain=Array(3).fill(hi<200?Math.min(1.2,Math.max(1,236/Math.max(1,hi))):1)}
  applyTone(p,curveLUT(gain,0,1));
  fcx.putImageData(id,0,0);
  // Centrada sobre un lienzo blanco de proporción fija (4:5), como una ficha de producto
  const out=mkCanvas(WHITE_W,WHITE_H),o=out.getContext("2d",{willReadFrequently:true});
  o.fillStyle="#fff";o.fillRect(0,0,WHITE_W,WHITE_H);o.imageSmoothingQuality="high";
  const sc=Math.min(WHITE_W*.86/cw,WHITE_H*.86/ch,2.2),dw=cw*sc,dh=ch*sc;
  o.drawImage(fc,(WHITE_W-dw)/2,(WHITE_H-dh)/2,dw,dh);
  sharpen(o,WHITE_W,WHITE_H);
  return {image:await toJpeg(out,.86),doubtful:!!m.doubtful,broken:!!m.broken};
 }catch(e){console.warn("WHITE_BG",e);return null}
}
/* Solo retoque, cuando no se puede quitar el fondo: niveles de luz (sin pasarse), curva suave, color y nitidez */
async function retouchOnly(src){
 try{
  const img=await loadImg(src),W=img.naturalWidth||img.width,H=img.naturalHeight||img.height;
  const c=mkCanvas(W,H),cx=c.getContext("2d",{willReadFrequently:true});cx.drawImage(img,0,0);
  const id=cx.getImageData(0,0,W,H),p=id.data,lum=[];
  for(let j=0;j<p.length;j+=28)lum.push(.299*p[j]+.587*p[j+1]+.114*p[j+2]);
  const lo=Math.min(30,quantile(lum,.005)),hi=quantile(lum,.995);
  // Foto oscura (nada pasa de gris medio): se aclara algo más, hasta un 38 %
  const scale=hi-lo>20?Math.min(hi>120?1.3:1.38,Math.max(1,(246-lo*.3)/(hi-lo))):1;
  applyTone(p,curveLUT([1,1,1],lo,scale));cx.putImageData(id,0,0);sharpen(cx,W,H);
  return await toJpeg(c,.86);
 }catch(e){console.warn("RETOUCH",e);return null}
}
/* Mejora completa: fondo blanco si se puede; si no, solo retoque. → {image, white} o null */
/* ¿La foto ya parece de catálogo? (fotos de tienda) Se usa tal cual, sin retocar, para no cambiar sus colores.
   Pide: borde casi todo blanco puro, fondo blanco conectado con el borde que rodea a la prenda, algo de prenda,
   y que lo de dentro no sea un rectángulo lleno (una captura con márgenes blancos y otra foto dentro). */
async function isCatalogPhoto(src){
 try{
  const img=await loadImg(src),W=img.naturalWidth||img.width,H=img.naturalHeight||img.height,k=Math.min(1,160/Math.max(W,H));
  const w=Math.max(8,Math.round(W*k)),h=Math.max(8,Math.round(H*k)),n=w*h,c=mkCanvas(w,h);
  const cx=c.getContext("2d",{willReadFrequently:true});cx.drawImage(img,0,0,w,h);const d=cx.getImageData(0,0,w,h).data;
  const white=new Uint8Array(n);for(let i=0;i<n;i++){const j=i*4,mn=Math.min(d[j],d[j+1],d[j+2]),mx=Math.max(d[j],d[j+1],d[j+2]);white[i]=mn>=236&&mx-mn<=14?1:0}
  const b=Math.max(2,Math.round(Math.min(w,h)*.04));let edge=0,edgeWhite=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<b||y<b||x>=w-b||y>=h-b){edge++;edgeWhite+=white[y*w+x]}
  if(edgeWhite/edge<.9)return false;
  // Fondo = blanco conectado con el borde; el resto es la prenda (aunque tenga partes blancas dentro)
  const bg=new Uint8Array(n),st=[];for(let x=0;x<w;x++)st.push(x,(h-1)*w+x);for(let y=0;y<h;y++)st.push(y*w,y*w+w-1);
  while(st.length){const i=st.pop();if(bg[i]||!white[i])continue;bg[i]=1;const x=i%w;if(x>0)st.push(i-1);if(x<w-1)st.push(i+1);if(i>=w)st.push(i-w);if(i<n-w)st.push(i+w)}
  let fg=0,x0=w,y0=h,x1=-1,y1=-1;for(let i=0;i<n;i++)if(!bg[i]){fg++;const x=i%w,y=(i-x)/w;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(fg/n<.05||fg/n>.8)return false;
  // Esquinas del recuadro de la prenda: si casi todas son «prenda», es un bloque rectangular (otra foto dentro)
  const corner=(cx0,cy0)=>{let f=0;for(let dy=0;dy<3;dy++)for(let dx=0;dx<3;dx++){const x=Math.min(x1,Math.max(x0,cx0+(cx0===x0?dx:-dx))),y=Math.min(y1,Math.max(y0,cy0+(cy0===y0?dy:-dy)));f+=bg[y*w+x]?0:1}return f>=5};
  return [corner(x0,y0),corner(x1,y0),corner(x0,y1),corner(x1,y1)].filter(Boolean).length<3;
 }catch{return false}
}
/* Mejora completa: si ya parece de catálogo se deja tal cual; si no, fondo blanco o solo retoque.
   → {image, white, asIs} o null */
async function enhancePhotoHere(src){ // → {image, white, asIs?, doubtful?, retouched?, doubtfulWhite?} o null

 if(await isCatalogPhoto(src))return {image:src,white:true,asIs:true};
 const info={},white=await whiteBackground(src,info);if(white&&!white.doubtful)return {image:white.image,white:true};
 // Recorte dudoso: por defecto también fondo blanco, como en una tienda online (decisión de Noelia, 09/10);
 // el retoque conservando el fondo se ofrece como alternativa (retouched) por si falta algún trozo.
 // Si el recorte está roto, por defecto solo retoque y el fondo blanco se ofrece aparte (doubtfulWhite).
 const tuned=await retouchOnly(src);
 if(white&&!white.broken)return {image:white.image,white:true,doubtful:true,retouched:tuned};
 return tuned?{image:tuned,white:false,doubtfulWhite:white?.image||null,reason:white?"roto":info.reason||"fondo"}:null;
}
/* Por qué no hubo fondo blanco y cómo conseguirlo en la próxima foto */
const PHOTO_TIPS={
 fondo:"El fondo tiene demasiadas cosas. Extiende la prenda sobre una superficie lisa: suelo, cama lisa o una toalla.",
 contraste:"La prenda se confunde con el fondo. Usa un fondo que contraste: oscuro para prendas claras y claro para las oscuras.",
 encuadre:"La prenda llena la foto o toca los bordes. Aléjate un poco y deja espacio alrededor.",
 roto:"Hay sombras o zonas del mismo color que el fondo. Prueba con más luz, sin flash directo, y un fondo que contraste."
};
/* R3: el retoque se hace en un Worker para no congelar la app (sobre todo con «Mejorar todas»). El Worker se
   construye con estas mismas funciones (no hay otro archivo que mantener). Si el navegador no lo permite
   (sin OffscreenCanvas, por ejemplo) o falla, se hace en la página como antes. */
const PHOTO_FNS=[labArrays,garmentMask,applyTone,sharpen,whiteBackground,retouchOnly,isCatalogPhoto,enhancePhotoHere,mkCanvas,toJpeg];
let photoWorker=null,photoWorkerOff=false,photoJobs=new Map(),photoSeq=0;
function photoWorkerSource(){
 return "const SRGB_LIN=Float32Array.from("+JSON.stringify(Array.from(SRGB_LIN))+");const MASK_MAX="+MASK_MAX+",WHITE_W="+WHITE_W+",WHITE_H="+WHITE_H+";"+
  "const quantile="+quantile+";const curveLUT="+curveLUT+";const loadImg=async s=>s;\n"+PHOTO_FNS.join("\n")+
  "\nconst JOBS={enhancePhoto:enhancePhotoHere,whiteBackground};"+
  "onmessage=async e=>{const {id,fn,bmp}=e.data;try{if(!new OffscreenCanvas(1,1).getContext(\"2d\"))throw new Error(\"NO_2D\");"+
  "const r=await JOBS[fn](bmp);if(r&&r.asIs)r.image=null;postMessage({id,r})}catch(err){postMessage({id,error:String(err&&err.message||err)})}finally{bmp.close&&bmp.close()}};";
}
function stopPhotoWorker(){photoWorkerOff=true;try{photoWorker?.terminate()}catch{}photoWorker=null;for(const j of photoJobs.values())j.reject(new Error("WORKER_OFF"));photoJobs.clear()}
function getPhotoWorker(){
 if(photoWorker||photoWorkerOff)return photoWorker;
 try{
  if(typeof Worker==="undefined"||typeof OffscreenCanvas==="undefined"||typeof createImageBitmap==="undefined")throw new Error("NO_WORKER");
  const url=URL.createObjectURL(new Blob([photoWorkerSource()],{type:"text/javascript"}));
  photoWorker=new Worker(url);URL.revokeObjectURL(url);
  photoWorker.onmessage=e=>{const j=photoJobs.get(e.data.id);if(!j)return;photoJobs.delete(e.data.id);clearTimeout(j.timer);e.data.error?j.reject(new Error(e.data.error)):j.resolve(e.data.r)};
  photoWorker.onerror=e=>{console.warn("PHOTO_WORKER",e.message);stopPhotoWorker()};
 }catch(e){console.warn("PHOTO_WORKER",e.message);photoWorkerOff=true;photoWorker=null}
 return photoWorker;
}
async function photoJob(fn,src,here){
 const w=getPhotoWorker();if(!w)return here(src);
 try{
  const bmp=await createImageBitmap(await loadImg(src)),id=++photoSeq;
  const r=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{photoJobs.delete(id);reject(new Error("WORKER_TIMEOUT"))},30000);
   photoJobs.set(id,{resolve,reject,timer});w.postMessage({id,fn,bmp},[bmp])});
  if(r?.asIs)r.image=src;
  return r;
 }catch(e){if(e.message==="INVALID_IMAGE")return null;console.warn("PHOTO_WORKER",e.message);stopPhotoWorker();return here(src)}
}
const enhancePhoto=src=>photoJob("enhancePhoto",src,enhancePhotoHere);
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
  // Lo que llega del servidor ya trae sus marcas: no se vuelve a marcar como cambio de este dispositivo
  if(!opts.noStamp)stampChanges(d,lastSavedData);
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
   - Las fotos se suben y descargan por /api/sync-image (descarga de 4 en 4); una foto que falla no bloquea el resto.
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
function resetSyncSession(){fetchedImgs.clear();syncGen++;clearTimeout(syncTimer);syncAgain=false}
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
/* Un elemento borrado (tomb) solo se descarta si el borrado es posterior a su última edición:
   así se puede volver a crear algo con el mismo id (por ejemplo, el plan de un día). */
const isDead=(x,deleted)=>!!deleted[x.id]&&String(deleted[x.id])>=String(x.updatedAt||"");
function mergeLists(local,remote,deleted){
 const out=new Map();
 for(const x of remote)if(x?.id&&!isDead(x,deleted))out.set(x.id,x);
 for(const x of local){if(!x?.id||isDead(x,deleted))continue;const r=out.get(x.id);if(!r||String(x.updatedAt||"")>=String(r.updatedAt||""))out.set(x.id,x)}
 const order=[...local.map(x=>x?.id),...remote.map(x=>x?.id)];
 return [...new Set(order)].filter(id=>out.has(id)).map(id=>out.get(id));
}
const newest=(a,b)=>{const o={...(a||{})};for(const [k,v] of Object.entries(b||{}))if(!o[k]||String(v)>String(o[k]))o[k]=v;return o};
/* Marca la fecha de cada preferencia y cada 👍/👎 que cambia, para fusionar por clave entre dispositivos */
function stampChanges(d,prev){
 const now=new Date().toISOString();if(!d.stamps||typeof d.stamps!=="object")d.stamps={};
 for(const [area,pre] of [["preferences","p:"],["feedback","f:"]]){const a=d[area]||{},b=prev?.[area]||{};
  for(const k of new Set([...Object.keys(a),...Object.keys(b)]))if(JSON.stringify(a[k])!==JSON.stringify(b[k]))d.stamps[pre+k]=now}
}
/* S6: las lápidas caducan a los 90 días. Si este dispositivo lleva más sin sincronizar (staleSince = su última
   sincronización), lo que ya existía entonces y no está en el servidor se dio por borrado en otro dispositivo:
   solo se conserva lo creado o editado aquí después. */
function mergeData(local,remote,staleSince=null){
 const deleted=newest(remote.deleted,local.deleted),cutoff=new Date(Date.now()-90*86400000).toISOString();
 for(const [id,at] of Object.entries(deleted))if(String(at)<cutoff)delete deleted[id];
 if(staleSince){local={...local};for(const key of ["garments","looks","wishlist","wearLog","trips","plans"]){const ids=new Set((remote[key]||[]).map(x=>x?.id));
  local[key]=(local[key]||[]).filter(x=>ids.has(x?.id)||String(x?.updatedAt||"")>String(staleSince))}}
 const m=normalizeData({...remote,...local,deleted});
 for(const key of ["garments","looks","wishlist","wearLog","trips","plans"])m[key]=mergeLists(local[key]||[],remote[key]||[],deleted);
 m.plans=onePlanPerDay(m.plans);
 // Preferencias y 👍/👎: por clave, gana el cambio más reciente (stamps), también si fue un borrado
 const ls=local.stamps||{},rs=remote.stamps||{},byKey=(area,pre)=>{const L=local[area]||{},R=remote[area]||{},out={};
  for(const k of new Set([...Object.keys(L),...Object.keys(R)])){const src=String(ls[pre+k]||"")>=String(rs[pre+k]||"")?L:R;if(Object.hasOwn(src,k))out[k]=src[k]}return out};
 m.feedback=byKey("feedback","f:");
 m.preferences={...emptyData().preferences,...byKey("preferences","p:")};
 m.stamps=newest(rs,ls);
 return m;
}
/* Cada foto lleva una versión (imageAt): cambia al sustituir la foto, así se sube y descarga de nuevo. */
const imgVer=g=>String(g.imageAt||"0");
function reuseLocalImages(data,local){
 const byId=new Map(local.garments.map(g=>[g.id,g]));
 for(const g of data.garments){if(validImage(g.image))continue;const l=byId.get(g.id);if(l&&validImage(l.image)&&imgVer(l)===imgVer(g))g.image=l.image}
}
/* S3: las fotos se descargan de 4 en 4 y cada una se guarda al llegar (fetchedImgs), así un reintento de la
   fusión o un fallo de red no obliga a bajarlas otra vez. Una foto que falla no bloquea el resto ni la subida del estado. */
const fetchedImgs=new Map(),fatalSync=e=>e?.message===SYNC_STALE||e?.message==="SESSION_EXPIRED";
async function inPool(items,n,fn){let i=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length)await fn(items[i++])}))}
async function downloadImages(data,serverImages,call,s,profile){
 const key=g=>profile+":"+g.id+"@"+imgVer(g);
 const missing=data.garments.filter(g=>!validImage(g.image)&&serverImages.has(g.id));
 for(const g of missing){const c=fetchedImgs.get(key(g));if(c){g.image=c;s.imgs[g.id]=imgVer(g)}}
 const rest=missing.filter(g=>!validImage(g.image));let failed=0;
 if(rest.length>3)toast("Descargando "+rest.length+" fotos de tu armario…");
 await inPool(rest,4,async g=>{
  try{const r=await call("/api/sync-image?id="+encodeURIComponent(g.id));
   if(r.status===200&&validImage(r.body.image)){g.image=r.body.image;fetchedImgs.set(key(g),g.image);s.imgs[g.id]=imgVer(g)}else failed++}
  catch(e){if(fatalSync(e))throw e;failed++}
 });
 return failed;
}
async function uploadImages(serverImages,call,s){
 let failed=0;
 for(const g of myGarments()){
  if(!validImage(g.image))continue;
  const v=imgVer(g),image=g.image,id=g.id;
  if(serverImages.has(id)&&s.imgs[id]===v)continue;
  if(s.imgs[id]==="rechazada:"+v)continue; // el servidor ya la rechazó (no válida o demasiado grande): no se reintenta hasta cambiarla
  try{
   const r=await call("/api/sync-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,image})});
   if(r.status===200){serverImages.add(id);s.imgs[id]=v}else{failed++;if(r.status===400||r.status===413)s.imgs[id]="rechazada:"+v}
  }catch(e){if(fatalSync(e))throw e;failed++}
 }
 const ids=new Set(myGarments().map(g=>g.id));for(const id of Object.keys(s.imgs))if(!ids.has(id))delete s.imgs[id];
 return failed;
}
let syncChangedView=false;
async function applyFromServer(data){
 // Preferencias propias de este dispositivo que no deben venir de otro.
 const local=appState.data.preferences,keep={aiUsage:local.aiUsage,installHintHidden:local.installHintHidden,lastBackupAt:local.lastBackupAt};
 data.preferences={...data.preferences,...Object.fromEntries(Object.entries(keep).filter(x=>x[1]!==undefined))};
 appState.data=data;syncChangedView=true;
 return saveState({fromSync:true,noStamp:true});
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
   const seqStart=editSeq;syncChangedView=false;let photoFail=0;
   // R4: si este dispositivo ya está al día, el servidor responde solo la versión y los ids de fotos (sin el armario)
   const g=await call("/api/sync"+(s.ever&&s.rev?"?since="+s.rev:""));
   if(g.status===503){s.status="off";s.error=g.body.error||"";return}
   if(g.status!==200)throw new Error(g.body.error||"SYNC_"+g.status);
   const serverRev=Number(g.body.rev)||0,serverData=g.body.data?normalizeData(g.body.data):null,serverImages=new Set(Array.isArray(g.body.images)?g.body.images:[]);
   const local=appState.data,localHasData=local.garments.length||local.looks.length||local.wishlist.length||local.wearLog.length||local.trips.length;
   let incoming=null,needPush=false;
   if(g.body.unchanged&&serverRev===s.rev)needPush=s.dirty;
   else if(!serverData)needPush=!!localHasData||s.dirty;
   else if(!s.ever){incoming=localHasData?mergeData(local,serverData):serverData;needPush=!!localHasData}  // primera vez en este dispositivo
   else if(serverRev!==s.rev){const stale=s.lastAt&&Date.now()-Date.parse(s.lastAt)>85*86400000?s.lastAt:null;
    incoming=s.dirty?mergeData(local,serverData,stale):serverData;needPush=s.dirty}
   else needPush=s.dirty;
   if(incoming){
    reuseLocalImages(incoming,local);
    photoFail=await downloadImages(incoming,serverImages,call,s,profile);
    if(editSeq!==seqStart)continue;  // hubo cambios mientras se descargaba: se vuelve a fusionar con ellos
    if(!alive())throw new Error(SYNC_STALE);
    await applyFromServer(incoming);
    for(const k of [...fetchedImgs.keys()])if(k.startsWith(profile+":"))fetchedImgs.delete(k);
   }
   s.ever=true;s.rev=serverRev;
   const pushSeq=editSeq;
   photoFail+=await uploadImages(serverImages,call,s);
   if(needPush){
    const p=await call("/api/sync",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({baseRev:serverRev,data:slimData(appState.data)})});
    if(p.status===409)continue;
    if(p.status!==200)throw new Error(p.body.error||"SYNC_PUT_"+p.status);
    s.rev=Number(p.body.rev)||serverRev+1;
   }
   // Solo queda al día si nadie editó durante la subida; si no, se repite enseguida.
   if(editSeq===pushSeq)s.dirty=false;else syncAgain=true;
   s.lastAt=new Date().toISOString();s.status="ok";s.error="";s.photoFail=photoFail;
   await saveSyncMeta(profile,s);
   if(photoFail&&alive())scheduleSync(60000); // las fotos que fallaron se reintentan; el resto ya está al día
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
 if(sync.lastAt){const m=Math.round((Date.now()-Date.parse(sync.lastAt))/60000);return "Sincronizado "+(m<1?"hace un momento":m<60?"hace "+plural(m,"minuto","minutos"):"hace "+plural(Math.round(m/60),"hora","horas"))+(sync.dirty?" · hay cambios pendientes":"")+(sync.photoFail?" · "+plural(sync.photoFail,"foto","fotos")+" pendiente"+(sync.photoFail>1?"s":"")+", lo reintentaré":"")+"."}
 return "Pendiente de la primera sincronización.";
}

/* ===================== 4. API y ahorro de tokens ===================== */
async function rawApi(path,options={}){
 const headers={...(options.headers||{})};if(appState.token)headers.Authorization=`Bearer ${appState.token}`;
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),20000);
 try{
  const r=await fetch(API_BASE+path,{...options,headers,signal:ctrl.signal});let body={};try{body=await r.json()}catch{}
  if(r.status===401&&path!=="/api/login"){showAuth();throw new Error("SESSION_EXPIRED")}
  if(r.status===429){toast(body.error||"Has llegado al límite de IA de hoy");throw new Error("AI_QUOTA")}
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
  cacheKey=await sha((body.mode||"")+(body.image||""));
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
 let out;try{out=await rawApi(path,{...options,body:JSON.stringify(body)})}
 catch(e){if(e.message==="AI_QUOTA"){usage[kind]=AI_LIMITS[kind];saveState({fromSync:true})}throw e} /* límite agotado en el servidor (p. ej., desde otro móvil): este también deja de intentarlo hoy (revisión de Codex, #199) */
 usage[kind]++;saveState({fromSync:true});
 if(kind==="analyze"){analyzeCache.set(cacheKey,structuredClone(out));if(analyzeCache.size>30)analyzeCache.delete(analyzeCache.keys().next().value);return out}
 if(Array.isArray(out?.looks))out.looks=out.looks.map(l=>({...l,ids:(Array.isArray(l.ids)?l.ids:[]).map(String).filter(id=>toLong.has(id)).map(id=>toLong.get(id))}));
 return out;
}
function mapAnalysis(d){
 const map={top:"Arriba",bottom:"Abajo",dress:"Vestidos",outerwear:"Capas",shoes:"Zapatos",bag:"Bolsos",accessory:"Accesorios",homewear:"Casa",underwear:"",swimwear:"Baño"};
 const cat=map[d.category]||d.category||map[d.type],st=d.style==="basic"?"casual":d.style;
 return {name:String(d.name||"").slice(0,80),garmentType:typeof d.garmentType==="string"?d.garmentType:"",category:CATEGORIES.includes(cat)?cat:"",color:d.color?(Array.isArray(d.color)?d.color.join(", "):String(d.color)).slice(0,60):"",style:STYLE_OK[st]?st:"",season:seasons[d.season]?d.season:"",notes:d.notes?String(d.notes).slice(0,500):"",...cleanAnalysis(d)};
}

/* ===================== 5. Sesión y navegación ===================== */
function resetBulk(){bulkQueue=[];bulkTotal=0} /* al salir o cambiar de perfil, la cola no pasa a otra persona (revisión de Codex, #177) */
function showAuth(){
 resetSyncSession();clearPhotoUrls();resetBulk();
 versionPick.clear();versionCache.clear(); /* una selección temporal nunca se traslada al siguiente perfil */
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
function selectProfile(id){appState.profile=PROFILES.find(p=>p.id===id);$$(".profile-option").forEach(x=>{const on=x.dataset.profile===id;x.classList.toggle("selected",on);x.setAttribute("aria-pressed",String(on))});setPasswordVisible(false);$("#password").value="";$("#authError").textContent="";$("#selectedProfileName").textContent=appState.profile.name;$("#selectedProfileAvatar").textContent=appState.profile.name.charAt(0);$("#passwordStep").classList.remove("hidden");$("#password").focus()}
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
 $("#auth").classList.add("hidden");$("#app").classList.remove("hidden");$("#profileName").textContent=appState.profile.name+" · Ajustes";
 appState.view="today";
 $$(".nav-btn").forEach(b=>{const active=b.dataset.view==="today";b.classList.toggle("active",active);if(active)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
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
  if(typeof check.token==="string"&&check.token){appState.token=check.token;try{localStorage.setItem("atelier-session",JSON.stringify({...s,token:check.token}))}catch{}} // renovación (B4)
  await enterApp();return true;
 }catch(e){
  // Sin conexión: se entra igualmente con los datos locales.
  if(appState.token&&appState.profile&&e.message!=="SESSION_INVALID"&&e.message!=="SESSION_EXPIRED"){try{await enterApp();return true}catch{}}
  try{localStorage.removeItem("atelier-session")}catch{}
  appState.profile=null;appState.token=null;return false;
 }
}
const NAV_PARENT={looks:"stylist",calendar:"wardrobe",insights:"wardrobe"};
function setView(v){
 appState.view=v;
 $$(".nav-btn").forEach(b=>{const active=b.dataset.view===v||b.dataset.view===NAV_PARENT[v];b.classList.toggle("active",active);if(active)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
 render();window.scrollTo?.(0,0);
}
function render(){
 const root=$("#content");if(!appState.profile)return;
 const views={today:renderToday,wardrobe:renderWardrobe,stylist:renderStylist,trips:renderTrips,looks:renderLooks,shopping:renderShopping,calendar:renderCalendar,settings:renderSettings};
 (views[appState.view]||renderWardrobe)(root);
 maybeAutoFill();
}

/* ===================== 6. Armario, prendas y looks ===================== */
/* Look como composición sobre blanco («flat lay»); las fotos con fondo mixto
   conservan la prenda completa en una cuadrícula editorial. */
function outfitBoard(pieces){
 const categoryOrder={Capas:0,Arriba:1,Vestidos:2,Abajo:3,Zapatos:4,Bolsos:5,Accesorios:6};
 // Ordenar ANTES de limitar a siete para no perder piezas esenciales.
 const sorted=pieces.filter(g=>validImage(g.image)).sort((a,b)=>(categoryOrder[a.category]??7)-(categoryOrder[b.category]??7));
 const items=sorted.slice(0,7);
 if(!items.length)return "";
 // Cada prenda en su propio recuadro (decisión de Noelia, 09/10), tengan o no fondo blanco.
  // El primer hueco del collage es el protagonista: priorizar prendas estructurales.
  // Los complementos van en espacios secundarios, independientemente del orden de selección.
  const visualPriority={Vestidos:0,Capas:1,Arriba:2,Abajo:3,Zapatos:4,Bolsos:5,Accesorios:6};
  // Evitar que una foto de una habitación ocupe el lugar protagonista.
  // Solo la foto protagonista debe tener preferencia por fondo blanco.
  // Las demás conservan el orden de vestirse, sin subir zapatos ni accesorios.
  // Un vestido manda siempre sobre el abrigo que lleva encima (revisión con fotos reales, 10/10/2026).
  const hero=items.find(g=>g.category==="Vestidos")||items.find(g=>g.bgWhite&&(visualPriority[g.category]??7)<=3)||items[0];
  const arranged=[hero,...items.filter(g=>g!==hero)];
  return '<div class="look-mixed-board" data-count="'+arranged.length+'" data-hero-category="'+(hero.category==="Vestidos"?"dress":"other")+'" role="group" aria-label="Prendas del conjunto">'+arranged.map(g=>'<div class="look-mixed-item" data-piece-kind="'+(g.category==="Accesorios"?"accessory":g.category==="Bolsos"?"bag":"garment")+'"><img src="'+photoUrl(g)+'" alt="'+fx(g.name||g.category||"Prenda")+'" loading="lazy"></div>').join("")+'</div>';
}
function thumbs(list,max=12){
 if(!list.length)return "";
 return '<div class="thumb-row">'+list.slice(0,max).map(g=>'<button class="thumb" data-thumb="'+fx(g.id)+'" title="'+fx(g.name)+'"'+(validImage(g.image)?' style="background-image:url('+photoUrl(g)+')"':'')+'><span>'+fx(g.name)+'</span></button>').join("")+(list.length>max?'<span class="muted thumb-more">+'+(list.length-max)+'</span>':'')+'</div>';
}
function garmentCard(g){const image=photoUrl(g);return `<article class="card" data-garment="${esc(g.id)}"><div class="card-img"${image?` style="background-image:url(${image})"`:""}></div><div class="card-body"><div class="card-title">${esc(g.name||"Sin nombre")}</div><div class="card-meta">${esc([g.category,g.color].filter(Boolean).join(" · "))}</div></div></article>`}
function lookCard(l){
 const gs=(l.garmentIds||[]).map(id=>myGarments().find(g=>g.id===id)).filter(Boolean);
 return '<article class="card" data-look="'+esc(l.id)+'"><div aria-hidden="true">'+outfitBoard(gs)+'</div><div class="card-body"><div class="card-title">'+esc(l.name)+'</div><div class="look-items">'+gs.map(g=>'<span class="look-chip">'+(validImage(g.image)?'<img class="look-chip-photo" src="'+photoUrl(g)+'" alt="" loading="lazy">':'<span class="look-chip-placeholder" aria-hidden="true">◇</span>')+'<span class="look-chip-name">'+esc(g.name||g.category||"Prenda")+'</span></span>').join("")+'</div></div></article>';
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
/* Ficha incompleta (las etiquetas deciden los looks): falta formalidad u ocasiones, falta un dato de abrigo o se contradicen estilo y formalidad */
function sheetGaps(g){const out=[];if(!g.formality)out.push("formalidad");if(!(Array.isArray(g.occasions)&&g.occasions.length))out.push("ocasiones");
 for(const f of EVIDENCE_FIELDS(g))if(f!=="color"&&f!=="formality"&&!g[f])out.push(META_NAME[f]||f);
 if(g.style&&g.formality in SHEET_STYLE&&SHEET_STYLE[g.formality]!==g.style&&!(g.formality==="formal"&&g.style==="party"))out.push("estilo y formalidad no cuadran");return out}
function renderWardrobe(root){
 const cats=[...new Set(myGarments().map(g=>g.category).filter(Boolean))].sort();
 const q=ui.search.toLocaleLowerCase("es");
 let gs=myGarments().filter(g=>(!q||[g.name,g.category,g.color,g.notes,g.style].join(" ").toLocaleLowerCase("es").includes(q))&&(!ui.category||g.category===ui.category)&&(!ui.season||g.season===ui.season)&&(!ui.onlyFavorites||g.favorite)&&(!ui.onlyForgotten||forgottenStatus(g).forgotten)&&(!ui.onlyIncomplete||sheetGaps(g).length));
 const sorters={least:(a,b)=>wornCount(a.id)-wornCount(b.id),most:(a,b)=>wornCount(b.id)-wornCount(a.id),name:(a,b)=>String(a.name).localeCompare(String(b.name),"es"),oldest:(a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")),recent:(a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||""))};
 gs.sort(sorters[ui.sort]||sorters.recent);
 const filters='<div class="filter-panel"><label class="field"><span>Buscar prendas</span><input id="wardrobeSearch" type="search" placeholder="Nombre, color, estilo…" value="'+fx(ui.search)+'"></label>'+
  '<details id="advancedFilters"><summary>Filtros y ordenación ▾</summary><div class="filter-grid">'+
  '<label class="field"><span>Categoría</span><select id="filterCategory">'+optionList([["","Todas"],...cats.map(c=>[c,c])],ui.category)+'</select></label>'+
  '<label class="field"><span>Temporada</span><select id="filterSeason">'+optionList([["","Todas"],...Object.entries(seasons)],ui.season)+'</select></label>'+
  '<label class="field"><span>Ordenar</span><select id="filterSort">'+optionList([["recent","Recientes"],["name","Nombre"],["least","Menos usadas"],["most","Más usadas"],["oldest","Más antiguas"]],ui.sort)+'</select></label>'+
  '</div><label class="switch-line"><input type="checkbox" id="onlyFavorites"'+(ui.onlyFavorites?' checked':'')+'> Solo favoritas</label>'+
  '<label class="switch-line"><input type="checkbox" id="onlyForgotten"'+(ui.onlyForgotten?' checked':'')+'> Solo prendas olvidadas</label>'+
  '<label class="switch-line"><input type="checkbox" id="onlyIncomplete"'+(ui.onlyIncomplete?' checked':'')+'> Solo fichas por completar</label>'+
  '<button class="secondary small" id="resetFilters">Limpiar filtros</button></details></div>';
 const cards=gs.map(g=>{const f=forgottenStatus(g),n=wornCount(g.id);return '<div class="garment-tile">'+garmentCard(g)+'<div class="tile-tools"><button class="chip-button" data-fav="'+fx(g.id)+'" aria-label="Favorito">'+(g.favorite?'♥':'♡')+'</button><button class="chip-button" data-wear="'+fx(g.id)+'" aria-label="Registrar uso">✓ Usada</button></div><div class="tile-hints">'+[n?fx(plural(n,"uso registrado","usos registrados")):"",f.forgotten?'✦ Olvidada':'',sheetGaps(g).length?'<span class="gap-hint" title="Falta: '+fx(sheetGaps(g).join(", "))+'">Ficha por completar</span>':''].filter(Boolean).join(" · ")+'</div></div>'}).join("");
 const incomplete=myGarments().filter(g=>sheetGaps(g).length).length;
 root.innerHTML=heroHtml("Mi armario","Toda tu ropa, aprovechada al máximo.")+safetyBanner()+
  (!myGarments().length?'':'<details class="wardrobe-summary"><summary>Resumen del armario · '+fx(myGarments().length)+' prendas</summary><div class="wardrobe-summary-body"><div class="stats">'+miniStat("prendas",myGarments().length)+miniStat("favoritas",myGarments().filter(g=>g.favorite).length)+miniStat("olvidadas",myGarments().filter(g=>forgottenStatus(g).forgotten).length)+miniStat("looks",myLooks().length)+'</div><p class="helper">'+fx(logs().length)+' usos registrados</p><button type="button" class="secondary small" id="wardrobeHistory">Calendario e historial</button><button type="button" class="secondary small" id="wardrobeForgotten">Prendas olvidadas</button></div></details>')+ /* armario vacío: sin contadores a cero ni filtros, directo a la bienvenida */
  (incomplete&&!ui.onlyIncomplete?'<div class="notice-card gaps-card"><div><p><strong>'+fx(plural(incomplete,"prenda tiene","prendas tienen"))+' la ficha por completar.</strong> Las etiquetas (sobre todo formalidad y ocasiones) deciden qué looks te propongo.</p></div><div class="notice-actions"><button class="chip-button" id="showIncomplete">Revisarlas</button>'+(sheetFill?'<span class="muted">Completando '+sheetFill.done+' de '+sheetFill.total+'…</span>':fillCandidates().length?(AI_LIMITS.analyze>aiUsage().analyze?'<button class="chip-button" id="fillSheets">✨ Completar con IA ('+Math.min(fillCandidates().length,AI_LIMITS.analyze-aiUsage().analyze)+')</button>':'<span class="muted">Mañana podrás completarlas con IA.</span>'):'')+'</div></div>':'')+
  '<div class="section-head"><h2>Prendas <span class="muted">('+gs.length+')</span></h2><span class="head-actions"><details class="wardrobe-add-menu"><summary class="primary">+ Añadir</summary><div class="wardrobe-add-choices"><button type="button" data-outfit-photo>Mi look</button><button type="button" id="addGarment">Una prenda</button></div></details></span></div>'+(myGarments().length?filters:'')+
  (gs.length?'<div class="grid">'+cards+'</div>':!myGarments().length?'<div class="empty welcome-empty"><h3>Tu armario está vacío</h3><p class="muted">Empieza por 8–10 prendas que te pongas mucho: un par de partes de arriba, de abajo, unos zapatos y una chaqueta. Desde la galería puedes elegir muchas fotos a la vez: se guardan solas.</p><button class="primary" id="emptyAdd">+ Añadir prendas</button></div>':'<div class="empty"><h3>No hay prendas con estos filtros</h3><p class="muted">Prueba otro filtro o añade una prenda.</p><button class="primary" id="emptyAdd">Añadir prenda</button></div>');
 $("#bannerBackup")?.addEventListener("click",downloadBackup);
 $("#bannerHide")?.addEventListener("click",()=>setPref("installHintHidden",true));
 $("#addGarment")?.addEventListener("click",()=>openGarment());bindOutfitPhoto(root);
 $("#emptyAdd")?.addEventListener("click",()=>openGarment());
 $("#wardrobeSearch")?.addEventListener("input",e=>{ui.search=e.target.value;const pos=e.target.selectionStart;renderWardrobe(root);const input=$("#wardrobeSearch");input.focus();input.setSelectionRange(pos,pos)});
 $("#showIncomplete")?.addEventListener("click",()=>{ui.onlyIncomplete=true;render()});
 $("#fillSheets")?.addEventListener("click",completeSheetsWithAI);
 for(const [id,key] of [["filterCategory","category"],["filterSeason","season"],["filterSort","sort"],["onlyFavorites","onlyFavorites"],["onlyForgotten","onlyForgotten"],["onlyIncomplete","onlyIncomplete"]])
  $("#"+id)?.addEventListener("change",e=>{ui[key]=e.target.type==="checkbox"?e.target.checked:e.target.value;renderWardrobe(root);const dt=$("#advancedFilters");if(dt)dt.open=true});
 $("#resetFilters")?.addEventListener("click",()=>{Object.assign(ui,{search:"",category:"",season:"",onlyFavorites:false,onlyForgotten:false,onlyIncomplete:false,sort:"recent"});render()});
 $$("[data-garment]",root).forEach(x=>x.addEventListener("click",()=>openGarment(x.dataset.garment)));
 $$("[data-fav]",root).forEach(b=>b.addEventListener("click",async()=>{const g=myGarments().find(x=>x.id===b.dataset.fav);if(g)await mutate(()=>{g.favorite=!g.favorite;g.updatedAt=new Date().toISOString()},"Favoritos actualizados")}));
 $$("[data-wear]",root).forEach(b=>b.addEventListener("click",()=>promptWear([b.dataset.wear],null)));
 $("#wardrobeHistory")?.addEventListener("click",()=>setView("calendar"));
 $("#wardrobeForgotten")?.addEventListener("click",()=>{ui.onlyForgotten=true;ui.search="";setView("wardrobe")});
}
let lastAnalysis=null,metaConfidence="";
/* Foto de la ficha abierta: la original y, si se ha podido, la versión mejorada (con fondo blanco o solo retocada).
   mode decide cuál se guarda; changed indica que la foto es nueva o ha cambiado. */
let sheetPhoto=null;
const sheetImage=()=>sheetPhoto?(sheetPhoto.mode==="alt"&&sheetPhoto.altWhite?sheetPhoto.altWhite:sheetPhoto.mode==="edited"&&sheetPhoto.edited?sheetPhoto.edited:sheetPhoto.original):null;
function renderPhotoControls(){
 const box=$("#photoControls");if(!box)return;
 const ph=sheetPhoto,preview=$("#garmentPreview"),img=sheetImage();
 $("#analyzeBtn")?.classList.toggle("hidden",!img); /* sin foto no hay nada que analizar (UX, 10/10/2026) */
 preview.src=img||"";preview.classList.toggle("hidden",!img);preview.classList.toggle("on-white",!!img&&(ph?.mode==="alt"||ph?.mode==="edited"&&!!ph.editedWhite));
 if(!ph||!img){box.innerHTML="";return}
 if(ph.busy){box.innerHTML='<p class="helper" role="status">Mejorando la foto…</p>';return}
 const keep='<p class="helper">Hemos mejorado la fotografía conservando el fondo.'+(ph.altWhite?' Para verla como en una tienda online, elige «Fondo blanco».':'')+'</p>'+(PHOTO_TIPS[ph.reason]?'<p class="helper photo-tip">'+fx(PHOTO_TIPS[ph.reason])+' <button type="button" class="link-button" data-photo-retake>Cambiar foto</button></p>':'');
 const note=ph.asIs&&ph.mode==="edited"?'<p class="helper">La foto ya tenía aspecto de catálogo: se usa tal cual, sin retocar.</p>'
  :ph.mode==="alt"?'<p class="helper">Revisa la prenda: puede que al quitar el fondo falte algún trozo. Si no te convence, elige '+(ph.edited?'«Mejorada» (conserva el fondo) u ':'')+'«Original».</p>'
  :ph.edited&&!ph.editedWhite&&ph.mode==="edited"?keep:'';
 // Versiones que se pueden elegir: mejorada (o con fondo blanco), fondo blanco dudoso y original
 // La persona decide: original siempre visible, incluso cuando el algoritmo considera que ya es catálogo.
 const modes=[...(ph.original?[["original","Original"]]:[]),...(ph.edited&&ph.edited!==ph.original?[["edited",ph.editedWhite?"Fondo blanco":"Mejorada"]]:[]),...(ph.altWhite?[["alt","Fondo blanco"]]:[])];
 const choices=modes.length>1?'<div class="seg-tabs photo-mode" role="group" aria-label="Elige la fotografía que quieres guardar">'+modes.map(([m,label])=>'<button type="button" class="seg-tab'+(ph.mode===m?' active':'')+'" data-photo-mode="'+m+'" aria-pressed="'+(ph.mode===m)+'">'+label+'</button>').join("")+'</div>':'';
 const tryWhite=ph.original&&!ph.altWhite&&!ph.editedWhite?'<button type="button" class="secondary wide" id="tryWhitePreview">Probar fondo blanco y comparar</button>':'';
 const improve=!ph.edited&&!ph.asIs?'<button type="button" class="secondary wide" id="makeWhite">✨ Mejorar foto</button>':'';
 box.innerHTML=(ph.draft&&!ph.changed?'<p class="notice-card">Esta foto es un recorte de la foto de un look. Para verla como en una tienda, cámbiala por una foto de la prenda extendida sobre una superficie lisa.</p>':'')+'<p class="helper">Compara los resultados y elige cuál guardar. Tu foto original siempre estará disponible.</p>'+choices+improve+tryWhite+(ph.failed?'<p class="helper">No he podido mejorar esta foto automáticamente.</p>':'')+note;
 $$("[data-photo-mode]",box).forEach(b=>b.addEventListener("click",()=>{ph.mode=b.dataset.photoMode;ph.changed=true;renderPhotoControls()}));
 $("#makeWhite",box)?.addEventListener("click",()=>makeSheetWhite());
 $("[data-photo-retake]",box)?.addEventListener("click",()=>($("#garmentCamera")||$("#garmentImage"))?.click());
 $("#tryWhitePreview",box)?.addEventListener("click",async()=>{
  if(ph.busy||!ph.original)return;
  ph.busy=true;renderPhotoControls();let done;ph.pending=new Promise(r=>done=r);
  try{
   const candidate=await photoJob("whiteBackground",ph.original,whiteBackground);
   if(sheetPhoto!==ph)return;
   if(candidate?.image){ph.altWhite=candidate.image;ph.mode="alt";ph.changed=true}
   else toast("No se pudo separar la prenda del fondo en esta foto");
  }catch(e){console.warn("WHITE_PREVIEW",e);toast("No se pudo generar la vista previa del fondo blanco")}
  finally{ph.busy=false;done();if(sheetPhoto===ph)renderPhotoControls()}
 });
}
async function makeSheetWhite(){
 const ph=sheetPhoto;if(!ph?.original||ph.busy)return ph?.pending;
 ph.busy=true;ph.failed=false;renderPhotoControls();
 // ph.pending: «Guardar» espera a que termine la mejora (el retoque va en un Worker y la app sigue respondiendo)
 let done;ph.pending=new Promise(r=>done=r);
 try{
 const res=await enhancePhoto(ph.original).catch(()=>null);
 if(sheetPhoto!==ph)return;
 ph.busy=false;
 if(res?.doubtful){ph.edited=res.retouched||null;ph.editedWhite=false;ph.asIs=false;ph.altWhite=res.image;ph.mode="alt";ph.changed=true}
 else if(res){ph.edited=res.image;ph.editedWhite=res.white;ph.asIs=!!res.asIs;ph.altWhite=res.doubtfulWhite||null;ph.reason=res.white?null:res.reason||null;ph.mode="edited";ph.changed=true}else ph.failed=true;
 renderPhotoControls();
 }finally{ph.busy=false;done()}
}
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
 $("#garmentImage")?.closest(".field")?.insertAdjacentHTML("beforeend",'<div id="photoControls"></div><label class="switch-line" id="autoWhiteOption"><input type="checkbox" id="autoWhite" checked> Mejorar la foto automáticamente (luz, color y fondo blanco)</label><label class="switch-line" id="autoAnalyzeOption"><input type="checkbox" id="autoAnalyze" checked> Analizar automáticamente al elegir la foto</label><p class="helper" id="autoAnalyzeStatus" role="status" aria-live="polite"></p>');
 const occasionField=$("#metadataDetails .occ-grid")?.closest(".field"),occasionSlot=$("#occasionSlot");
 if(occasionField&&occasionSlot){occasionSlot.append(occasionField);$$(`[name="meta-occasion"]`,occasionSlot).forEach(input=>input.addEventListener("change",updateOccasionSummary));updateOccasionSummary()}
 /* Formalidad junto al estilo (revisión general, 10/10/2026): es la etiqueta que más decide los looks; las dos se mantienen coherentes */
 const formalField=$("#meta-formality")?.closest(".field"),styleField=$("#garmentStyle")?.closest(".field");
 if(formalField&&styleField){formalField.classList.add("formality-main");styleField.after(formalField);
  const STYLE_TO_FORMAL={casual:"casual",smart:"smartcasual",party:"party",sport:"sport"};
  $("#meta-formality").addEventListener("change",e=>{const st=SHEET_STYLE[e.target.value];if(st)$("#garmentStyle").value=st});
  $("#garmentStyle").addEventListener("change",e=>{const f=$("#meta-formality");if(f.value&&SHEET_STYLE[f.value]!==e.target.value&&!(f.value==="formal"&&e.target.value==="party"))f.value=STYLE_TO_FORMAL[e.target.value]||""})}
 $("#autoAnalyze")?.addEventListener("change",e=>{if(appState.profile)setPref("autoAnalyze",e.target.checked,false)});
 $("#autoWhite")?.addEventListener("change",e=>{if(appState.profile)setPref("autoWhite",e.target.checked,false)});
 // La vista previa va justo encima de los controles de la foto
 const pv=$("#garmentPreview"),pc=$("#photoControls");if(pv&&pc)pc.before(pv);
}
function updateOccasionSummary(){
 const values=$$('[name="meta-occasion"]:checked').map(x=>occasions[x.value]||x.value);
 const el=$("#occasionSummary");if(el)el.textContent=values.length?values.slice(0,3).join(" · ")+(values.length>3?" +"+(values.length-3):""):"Sin ocasiones sugeridas · puedes elegirlas";
}
const OCCASION_ALIASES={travel:null,holiday:null,gym:"sport",running:"sport",yoga:"sport",tennis:"sport",hiking:"sport",pool:"beach",spa:"beach",sleep:"home",dinner:"party",night:"party",date:"party",wedding:"event",ceremony:"event",school:"daily",cold:"daily",rain:"daily"};
const OCCASION_BY_TYPE={"Pijama":["home"],"Camisón":["home"],"Bata":["home"],"Conjunto de estar en casa":["home"],"Zapatillas de casa":["home"],"Mallas deportivas":["sport"],"Pantalón deportivo":["sport"],"Camiseta técnica":["sport"],"Bañador":["beach"],"Bikini":["beach"],"Top de bikini":["beach"],"Braguita de bikini":["beach"],"Trikini":["beach"],"Short de baño":["beach"],"Pareos":["beach"],"Salida de baño":["beach"]};
const normalizeOccasions=xs=>[...new Set((Array.isArray(xs)?xs:[]).map(x=>Object.hasOwn(OCCASION_ALIASES,x)?OCCASION_ALIASES[x]:x).filter(x=>occasions[x]))];
const occasionDefaults=(category,type,ai)=>[...new Set([...(OCCASION_BY_TYPE[type]||({"Casa":["home"],"Baño":["beach"]}[category]||[])),...normalizeOccasions(ai)])];
function suggestOccasionsForSelection(){
 const category=$("#garmentCategory").value,type=$("#garmentType").value;
 const current=Array.from(document.querySelectorAll('[name="meta-occasion"]:checked'),x=>x.value);
 const selected=new Set(occasionDefaults(category,type,current));
 document.querySelectorAll('[name="meta-occasion"]').forEach(x=>{x.checked=selected.has(x.value)});
 updateOccasionSummary();
}
function populateMetadata(src){
 for(const def of META_FIELDS){const el=$("#meta-"+def[0]);if(el)el.value=metaValue(def,src?.[def[0]])}
 const occ=new Set(normalizeOccasions(src?.occasions));
 $$('[name="meta-occasion"]').forEach(x=>x.checked=occ.has(x.value));
 updateOccasionSummary();
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
const QUOTA_SHEET_MSG="Ya has usado los análisis de hoy. Pon categoría y color y guárdala: mañana la completas desde Armario con «Completar con IA».";
function setAnalyzeStatus(t){const s=$("#autoAnalyzeStatus");if(s)s.textContent=t}
const GARMENT_TYPES={
 Arriba:["Camiseta","Camisa","Blusa","Top","Crop top","Jersey","Sudadera","Polo","Body","Camiseta técnica","Otro"],
 Abajo:["Vaqueros","Pantalón","Leggings","Mallas deportivas","Shorts","Falda","Pantalón deportivo","Otro"],
 Vestidos:["Vestido corto","Vestido midi","Vestido largo","Mono corto","Mono largo","Enterizo","Peto","Otro"],
 Capas:["Blazer","Chaqueta","Cazadora","Abrigo","Gabardina","Chaleco","Cárdigan","Otro"],
 Zapatos:["Deportivas","Zapatos","Botas","Botines","Sandalias","Tacones","Mocasines","Bailarinas","Alpargatas","Zuecos","Zapatillas de casa","Otro"],
 Bolsos:["Bolso de mano","Bolso de hombro","Bandolera","Mochila","Bolso de fiesta","Otro"],
 Accesorios:["Cinturón","Gafas de sol","Gafas","Pañuelo","Bufanda","Guantes","Gorro","Sombrero","Collar","Pendientes","Pulsera","Anillo","Joyería","Reloj","Corbata","Pajarita","Diadema","Pinza de pelo","Coletero","Accesorio de pelo","Otro"],
 Casa:["Pijama","Camisón","Bata","Conjunto de estar en casa","Otro"],
 Baño:["Bañador","Bikini","Top de bikini","Braguita de bikini","Trikini","Short de baño","Pareos","Salida de baño","Otro"]
};
function syncGarmentCategory(resetType=false){
 const value=$("#garmentCategory").value;
 $$("[data-garment-category]").forEach(btn=>{const active=btn.dataset.garmentCategory===value;btn.classList.toggle("active",active);btn.setAttribute("aria-pressed",String(active))});
 const sel=$("#garmentType");if(!sel)return;
 const current=resetType?"":sel.value,values=GARMENT_TYPES[value]||[];
 sel.replaceChildren(new Option(value?"Seleccionar tipo (opcional)":"Primero elige una categoría",""),...values.map(v=>new Option(v,v)));
 sel.value=values.includes(current)?current:"";sel.disabled=!value;
}
function openGarment(id){
 const g=myGarments().find(x=>x.id===id);
 $("#garmentTitle").textContent=g?"Editar prenda":"Nueva prenda";$("#garmentId").value=g?.id||"";$("#garmentName").value=g?.name||"";$("#garmentCategory").value=g?.category||"";$("#garmentColor").value=g?.color||"";$("#garmentNotes").value=g?.notes||"";$("#garmentSeason").value=g?.season||"all";$("#garmentStyle").value=g?.style||"";$("#garmentPrice").value=g?.price??"";$("#garmentBought").value=g?.boughtAt||"";$("#garmentFavorite").checked=!!g?.favorite;$("#garmentImage").value="";$("#garmentCamera").value="";
 const edited=!!(g?.photoFx||g?.bgWhite);
 sheetPhoto=validImage(g?.image)?(edited?{original:null,edited:g.image,editedWhite:!!g.bgWhite,asIs:!!g.catalogPhoto,mode:"edited",changed:false}:{original:g.image,edited:null,mode:"original",changed:false}):null;
 if(sheetPhoto&&g.photoDraft)sheetPhoto.draft=true;
 if(sheetPhoto&&edited&&!g.catalogPhoto){const ph=sheetPhoto;dbGet(origKey(g.id)).then(o=>{if(sheetPhoto===ph&&validImage(o)){ph.original=o;renderPhotoControls()}}).catch(()=>{})}
 syncGarmentCategory();$("#garmentType").value=g?.type||"";
 $("#deleteGarment").classList.toggle("hidden",!g);
 let btn=$("#garmentAround");
 if(!btn){$("#garmentForm .actions")?.insertAdjacentHTML("beforebegin",'<button type="button" id="garmentAround" class="secondary wide">✦ Ver looks con esta prenda</button>');btn=$("#garmentAround");btn?.addEventListener("click",()=>{const gid=$("#garmentId").value;if(!gid)return;ui.aroundId=gid;ui.stylistTab="around";closeGarment();setView("stylist")})}
 btn?.classList.toggle("hidden",!g);
 renderGarmentPairs(g);
 buildMetadataSection();renderPhotoControls();populateMetadata(g);setAnalyzeStatus("");
 const details=$("#metadataDetails");if(details)details.open=false;
 const extra=$("#garmentExtra");if(extra)extra.open=!!g;
 const auto=$("#autoAnalyze");if(auto)auto.checked=appState.data.preferences.autoAnalyze!==false;
 const aw=$("#autoWhite");if(aw)aw.checked=appState.data.preferences.autoWhite!==false;
 lastAnalysis=null;$("#garmentSheet").classList.remove("hidden");
}
/* Completar fichas con IA en bloque (10/10/2026): tras una subida grande, o al día siguiente si se acabó el límite,
   un toque analiza las prendas con foto que tienen la ficha incompleta, hasta lo que quede del límite diario.
   Solo rellena lo que falta (nunca pisa lo que ya escribiste) y cada prenda se analiza una vez (aiFilledAt). */
let sheetFill=null;
const fillCandidates=()=>myGarments().filter(g=>sheetGaps(g).length&&validImage(g.image)&&!g.aiFilledAt);
const pendingAI=()=>myGarments().filter(g=>g.needsAI&&sheetGaps(g).length&&validImage(g.image)&&!g.aiFilledAt); /* subidas en bloque que se guardaron sin análisis (límite agotado) */
let autoFillTried="";
function maybeAutoFill(){ /* «Analizar automáticamente» activado: las fichas pendientes se completan solas una vez por sesión y día (sin pulsar nada) */
 const k=(appState.profile?.id||"")+"|"+dayISO();if(autoFillTried===k||sheetFill||appState.data.preferences.autoAnalyze===false||bulkTotal>1)return;
 if(!pendingAI().length||aiUsage().analyze>=AI_LIMITS.analyze)return;autoFillTried=k;setTimeout(()=>completeSheetsWithAI(true),1500)}
async function completeSheetsWithAI(quiet=false){
 if(sheetFill)return;const prof=appState.profile?.id,left=Math.max(0,AI_LIMITS.analyze-aiUsage().analyze),todo=(quiet?pendingAI():fillCandidates()).slice(0,left);
 if(!left)return quiet?null:toast("Has llegado al límite de "+AI_LIMITS.analyze+" análisis de hoy. Mañana podrás seguir.");
 if(!todo.length)return quiet?null:toast("No hay fichas que completar con foto");
 sheetFill={done:0,total:todo.length,ok:0};render();
 let fails=0;
 try{for(const g0 of todo){
  if(appState.profile?.id!==prof)break; /* cambio de perfil: se para */
  let a=null,d=null,err=false;
  try{const out=await api("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:g0.image})});const raw=out.garment||out.result||out;
   if(raw?.type!=="underwear"&&raw?.category!=="Interior"){d=mapAnalysis(raw);a=cleanAnalysis(d)}}
  catch(e){if(e.message==="AI_QUOTA")break;console.error("FILL",e);err=true}
  if(appState.profile?.id!==prof)break;
  if(err){sheetFill.done++;if(++fails>=2)break;render();continue} /* un fallo de red no marca la prenda: se podrá reintentar (revisión de Codex, #198); dos seguidos, se para */
  fails=0;
  const now=new Date().toISOString();
  await mutate(()=>{const g=myGarments().find(x=>x.id===g0.id);if(!g)return;
   if(a){for(const [k,v] of Object.entries(a))if(k!=="confidence"&&k!=="occasions"&&!g[k])g[k]=v;
    if(!g.category&&d.category)g.category=d.category;if(!g.color&&d.color)g.color=d.color;if(!g.season&&d.season)g.season=d.season;
    if(!(Array.isArray(g.occasions)&&g.occasions.length)){const o=occasionDefaults(g.category,g.type,a.occasions);if(o.length)g.occasions=o}
    if(!g.style&&SHEET_STYLE[g.formality])g.style=SHEET_STYLE[g.formality];sheetFill.ok++}
   g.aiFilledAt=now;delete g.needsAI;g.updatedAt=now});
  sheetFill.done++;render()}}
 finally{const f=sheetFill;sheetFill=null;render();if(f&&(f.ok||!quiet))toast(f.ok?plural(f.ok,"ficha completada","fichas completadas")+" con IA.":"No se pudo completar ninguna ficha")}
}
/* «Combina con» (#160): las relaciones de la prenda con el resto del armario, agrupadas por registro; sin IA */
const META_NAME=Object.fromEntries(META_FIELDS.map(f=>[f[0],f[1].replace(/ \(.*/,"").toLowerCase()]));
let pairsView={id:"",occ:null}; /* filtro de ocasión de «Combina con», por prenda */
function renderGarmentPairs(g){
 let box=$("#garmentPairs");
 if(!box){$("#garmentAround")?.insertAdjacentHTML("beforebegin",'<section id="garmentPairs" class="garment-pairs" aria-live="polite"></section>');box=$("#garmentPairs")}
 if(!box)return;
 box.classList.toggle("hidden",!g);if(!g){box.innerHTML="";return}
 if(pairsView.id!==g.id)pairsView={id:g.id,occ:null};
 const occs=REL_OCCS.filter(o=>occasionFits(g,o)),occ=occs.includes(pairsView.occ)?pairsView.occ:null,rel=relationsFor(g,REL_OK,occ);
 const missing=EVIDENCE_FIELDS(g).filter(f=>!g[f]&&f!=="color").map(f=>META_NAME[f]||f);
 const styleClash=g.style&&g.formality in SHEET_STYLE&&SHEET_STYLE[g.formality]!==g.style&&!(g.formality==="formal"&&g.style==="party"); /* etiquetas que se contradicen: el estilista usa la formalidad */
 const clothes=isClothes(g),wear=["Casa","Baño"].includes(g.category); /* pijama o bañador: look completo por sí mismo, no complemento (revisión de Codex, #185) */
 if(!clothes&&!wear){const ok=new Set(rel.map(x=>x.g.id)),bs=basesFor(g).filter(b=>b.every(x=>ok.has(x.id))&&(!occ||occasionFits(g,occ)&&b.every(x=>occasionFits(x,occ)))),q=b=>b.reduce((t,x)=>t+(relationOf(g,x)?.s??.6),0)/b.length;bs.sort((a,b)=>q(b)-q(a)); /* las bases que mejor le van, primero */
  const show=[],seenP=new Set();for(const pass of [0,1])for(const b of bs){if(show.length>=8)break;if(show.includes(b)||!pass&&b.some(x=>seenP.has(x.id)))continue;show.push(b);b.forEach(x=>seenP.add(x.id))} /* variadas: sin repetir prenda mientras se pueda */ /* zapatos, bolsos y complementos: con looks enteros (arriba + abajo, o vestido) */
  box.innerHTML='<h3>Completa estos looks</h3>'+(occs.length?'<div class="pair-occs" role="group" aria-label="Ocasión">'+[[null,"Todas"],...occs.map(o=>[o,occasions[o]||o])].map(([o,t])=>'<button type="button" class="chip-button'+(o===occ?' active':'')+'" aria-pressed="'+(o===occ)+'" data-pair-occ="'+(o||"")+'">'+fx(t)+'</button>').join("")+'</div>':'')+'<p class="muted pair-note">'+(occ?'Para «'+fx((occasions[occ]||occ).toLowerCase())+'»':'En general')+': '+(bs.length?plural(bs.length,"base de look","bases de look")+' de tu armario con las que va bien.':'todavía no hay ninguna base de look (arriba + abajo, o vestido) con la que vaya bien.')+'</p>'+'<div class="base-grid">'+show.map(b=>'<div class="base-card">'+thumbs(b,3)+'</div>').join("")+'</div>'+(bs.length>8?'<p class="muted">Y '+(bs.length-8)+' más.</p>':'')+(missing.length?'<p class="muted pair-note">Para afinar, completa en la ficha: '+fx(missing.join(", "))+'.</p>':'');
 }else{
 const groups=new Map();for(const x of wear?rel:rel.filter(x=>isClothes(x.g))){if(!groups.has(x.r.register))groups.set(x.r.register,[]);groups.get(x.r.register).push(x)}
 const catRank=x=>BIG.includes(x.category)?0:x.category==="Zapatos"?1:2; /* primero ropa, luego calzado y complementos */
 const order=["informal","arreglado","de fiesta","deportivo"],occText=xs=>{if(occ)return "";const c=new Map();for(const x of xs)for(const o of x.r.contexts)c.set(o,(c.get(o)||0)+1);return [...c].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([o])=>(occasions[o]||o).toLowerCase()).join(", ")};
 box.innerHTML='<h3>Combina con</h3>'+(occs.length?'<div class="pair-occs" role="group" aria-label="Ocasión">'+[[null,"Todas"],...occs.map(o=>[o,occasions[o]||o])].map(([o,t])=>'<button type="button" class="chip-button'+(o===occ?' active':'')+'" aria-pressed="'+(o===occ)+'" data-pair-occ="'+(o||"")+'">'+fx(t)+'</button>').join("")+'</div>':'')+'<p class="muted pair-note">'+(occ?'Para «'+fx((occasions[occ]||occ).toLowerCase())+'»':'En general')+', sin contar el tiempo de hoy: eso lo tiene en cuenta el estilista al proponer looks.</p>'+(groups.size?[...groups].sort((a,b)=>order.indexOf(a[0])-order.indexOf(b[0])).map(([reg,xs])=>'<div class="pair-group"><p class="muted"><strong>'+fx(reg[0].toUpperCase()+reg.slice(1))+'</strong> · '+xs.length+(xs.length===1?' prenda':' prendas')+(occText(xs)?' · '+fx(occText(xs)):'')+'</p>'+thumbs(xs.slice().sort((a,b)=>catRank(a.g)-catRank(b.g)||b.r.s-a.r.s).map(x=>x.g),10)+'</div>').join("")
  :'<p class="muted">Todavía no hay ropa en tu armario que combine bien con esta.</p>')+(missing.length?'<p class="muted pair-note">Para afinar, completa en la ficha: '+fx(missing.join(", "))+'.</p>':'');}
 box.insertAdjacentHTML("beforeend",(styleClash?'<p class="pair-note pair-warn">Revisa las etiquetas: el estilo es «'+fx(styleNames[g.style]||g.style)+'» pero la formalidad es «'+fx(metaLabel("formality",g.formality))+'». El estilista se guía por la formalidad.</p>':''));
 $$("[data-thumb]",box).forEach(b=>b.addEventListener("click",()=>openGarment(b.dataset.thumb)));
 $$("[data-pair-occ]",box).forEach(b=>b.addEventListener("click",()=>{pairsView.occ=b.dataset.pairOcc||null;renderGarmentPairs(g)}));
 /* Lo que has marcado con «Casi» sobre esta prenda, para poder deshacerlo */
 const fb=appState.data.feedback||{},nm=id=>myGarments().find(x=>x.id===id)?.name||"una prenda borrada";
 const marks=Object.keys(fb).filter(k=>fb[k]&&(k==="g:"+g.id||k.startsWith("o:"+g.id+"|")||k.startsWith("p:")&&k.slice(2).split("|").includes(g.id))).map(k=>[k,k.startsWith("g:")?"No te gusta esta prenda":k.startsWith("o:")?"No para «"+(occasions[k.split("|")[1]]||k.split("|")[1]).toLowerCase()+"»":"No combinar con "+nm(k.slice(2).split("|").find(x=>x!==g.id))]);
 if(marks.length){box.insertAdjacentHTML("beforeend",'<div class="pair-marks"><p class="muted pair-note">Lo que has marcado con «Casi»:</p>'+marks.map(([k,t])=>'<span class="look-chip">'+fx(t)+' <button type="button" class="link-button" data-unmark="'+fx(k)+'" aria-label="Quitar: '+fx(t)+'">Quitar</button></span>').join("")+'</div>');
  $$("[data-unmark]",box).forEach(b=>b.addEventListener("click",async()=>{const k=b.dataset.unmark;if(await mutate(()=>{delete appState.data.feedback[k]},"Quitado"))renderGarmentPairs(myGarments().find(x=>x.id===g.id))}))}
}
/* Subida en lote: cola de fotos que se van abriendo en la ficha, una a una */
let bulkQueue=[],bulkTotal=0,loadSheetFile=null;
function updateBulkTitle(){if(bulkTotal>1)$("#garmentTitle").textContent="Nueva prenda · "+(bulkTotal-bulkQueue.length)+" de "+bulkTotal}
/* Editar cualquier look (Noelia, 10/10/2026): la app aconseja y la persona perfecciona. Cambiar, quitar o añadir piezas con
   opciones que combinan; se guarda como look suyo («edited») y se aprende: sus parejas suman y lo que quitó resta un poco */
const EDIT_ADD=["Zapatos","Capas","Bolsos","Accesorios"];
function openLookEditor(ids,opts={}){
 const st={ids:[...new Set(ids)].filter(id=>myGarments().some(g=>g.id===id)),orig:[...ids],removed:new Set(opts.removed||[]),pick:null};if(!st.ids.length)return;
 const by=id=>myGarments().find(g=>g.id===id),ctx=()=>engineContext({occasion:opts.occasion??null});
 const candidates=(cat,without)=>{const rest=st.ids.filter(x=>x!==without).map(by).filter(Boolean),c=ctx(),before=new Set(lookIssues(rest,c)),notes=pieceNotes();
  return myGarments().filter(g=>g.category===cat&&!st.ids.includes(g.id)&&!notes.disliked.has(g.id)&&rest.every(r=>(relationOf(g,r,c)?.s??1)>=REL_WEAK)&&lookIssues([...rest,g],c).every(x=>before.has(x)))
   .map(g=>({g,s:scoreOutfit([...rest,g],c).score})).sort((a,b)=>b.s-a.s).slice(0,10)};
 const body=()=>{const gs=st.ids.map(by).filter(Boolean),c=ctx(),nuc=nucleusOf(gs),issues=lookIssues(gs,c),missing=EDIT_ADD.filter(cat=>!gs.some(g=>g.category===cat));
  let pickHtml="";if(st.pick){const [kind,val]=st.pick,cat=kind==="add"?val:by(val)?.category,opts2=candidates(cat,kind==="swap"?val:null);
   pickHtml='<div class="edit-pick"><p class="muted">'+(kind==="add"?"Añadir "+fx(cat.toLowerCase()):"Cambiar «"+fx(by(val)?.name||"")+"»")+': prendas que combinan con el resto</p>'+(opts2.length?'<div class="swap-options">'+opts2.map(o=>'<button type="button" class="edit-option" data-edit-use="'+fx(o.g.id)+'">'+(validImage(o.g.image)?'<img src="'+photoUrl(o.g)+'" alt="" loading="lazy">':'<span aria-hidden="true">◇</span>')+'<span>'+fx(o.g.name)+'</span></button>').join("")+'</div>':'<p class="muted">No hay otra prenda que combine con el resto.</p>')+'<button type="button" class="link-button" data-edit-cancel>Cancelar</button></div>'}
  return '<div class="section-head"><h2 id="editSheetTitle">Editar look</h2><button type="button" class="secondary" data-close-sheet>Cerrar</button></div>'+
   '<p class="muted">Cambia lo que quieras: se guardará como tu look y tendré en cuenta tu gusto.</p><div class="daily-board">'+outfitBoard(gs)+'</div>'+
   '<div class="edit-rows">'+gs.map(g=>'<div class="edit-row"><span>'+fx(g.name)+'</span><span class="edit-row-actions"><button type="button" class="chip-button" data-edit-swap="'+fx(g.id)+'">Cambiar</button>'+(nuc.includes(g)?'':'<button type="button" class="chip-button" data-edit-remove="'+fx(g.id)+'">Quitar</button>')+'</span></div>').join("")+'</div>'+
   (missing.length?'<div class="edit-add">'+missing.map(cat=>'<button type="button" class="chip-button" data-edit-add="'+cat+'">+ '+fx(cat)+'</button>').join("")+'</div>':'')+pickHtml+
   (issues.length?'<ul class="look-reasons">'+issues.map(w=>'<li class="warn">'+fx(w)+'</li>').join("")+'</ul>':'')+
   '<div class="actions"><button type="button" class="primary wide" id="editSave"'+(lookComplete(gs)?'':' disabled')+'>'+(opts.lookId?"Guardar cambios":"♡ Guardar como mi look")+'</button></div>'};
 const {el,close}=showSheet("editSheet",body());
 const redraw=()=>{$(".sheet",el).innerHTML=body();bind();$(".edit-pick",el)?.scrollIntoView({block:"nearest",behavior:"smooth"})};
 const bind=()=>{$$("[data-close-sheet]",el).forEach(b=>b.addEventListener("click",close));
  $$("[data-edit-swap]",el).forEach(b=>b.addEventListener("click",()=>{st.pick=["swap",b.dataset.editSwap];redraw()}));
  $$("[data-edit-add]",el).forEach(b=>b.addEventListener("click",()=>{st.pick=["add",b.dataset.editAdd];redraw()}));
  $$("[data-edit-remove]",el).forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.editRemove;st.ids=st.ids.filter(x=>x!==id);if(st.orig.includes(id))st.removed.add(id);redraw()}));
  $("[data-edit-cancel]",el)?.addEventListener("click",()=>{st.pick=null;redraw()});
  $$("[data-edit-use]",el).forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.editUse,[kind,val]=st.pick;if(kind==="swap"){st.ids=st.ids.map(x=>x===val?id:x);if(st.orig.includes(val))st.removed.add(val)}else st.ids.push(id);st.removed.delete(id);st.pick=null;redraw()}));
  $("#editSave",el)?.addEventListener("click",async()=>{const ids=[...st.ids],now=new Date().toISOString(),removed=[...st.removed].filter(x=>!ids.includes(x));
   if(!opts.lookId&&myLooks().some(x=>lookSig(x.garmentIds||[])===lookSig(ids)))return toast("Ese look ya está en Mis looks");
   const ok=await mutate(()=>{if(opts.lookId){const l=myLooks().find(x=>x.id===opts.lookId);if(l){l.garmentIds=ids;l.edited=true;l.removed=removed; /* el conjunto actual (ya incluye lo quitado antes y no lo que se ha vuelto a poner) (revisión de Codex, #183) */l.updatedAt=now}}
    else myLooks().unshift({id:uid(),name:(opts.name||"Mi look").slice(0,80),garmentIds:ids,occasion:opts.occasion||appState.data.preferences.occasion||"daily",ai:false,edited:true,removed,updatedAt:now})},opts.lookId?"Look actualizado":"Guardado en Mis looks como tu look");
   if(ok){close();opts.onSaved?.(ids)}});
 };bind();
}
function closeGarment(fromSave=false){fromSave=fromSave===true;$("#garmentSheet").classList.add("hidden");if(!fromSave&&bulkTotal>1){const left=bulkQueue.length+1;toast(plural(left,"foto se ha quedado","fotos se han quedado")+" sin añadir")} /* la que estaba abierta también (revisión de Codex, #177) */if(!fromSave){bulkQueue=[];bulkTotal=0;sheetPhoto=null}} /* cerrar anula el guardado automático pendiente (revisión de Codex, #207) */
async function saveGarment(e){
 e.preventDefault();
 const ph=sheetPhoto;
 if(ph?.busy){if(ph.saving)return;ph.saving=true;toast("Terminando de mejorar la foto…");try{await ph.pending}finally{ph.saving=false}if(sheetPhoto!==ph)return}
 const id=$("#garmentId").value||uid(),old=myGarments().find(x=>x.id===id);
 const image=sheetImage()||old?.image||"",changed=!!ph?.changed&&image!==old?.image,edited=!!ph&&(ph.mode==="edited"&&!!ph.edited||ph.mode==="alt"&&!!ph.altWhite);
 if(!validImage(image)&&!old?.hasImage)return toast("Añade una fotografía de la prenda antes de guardarla");
 if($("#garmentCategory").value==="Interior")return toast("La ropa interior no está admitida");
 const kept=Object.fromEntries(Object.entries(old||{}).filter(([k])=>!META_KEYS.has(k)));
 const g={...kept,...readMetadata(),id,name:$("#garmentName").value.trim()||"Sin nombre",category:$("#garmentCategory").value,type:$("#garmentType").value,color:$("#garmentColor").value.trim(),notes:$("#garmentNotes").value.trim(),season:$("#garmentSeason").value,style:$("#garmentStyle").value,price:$("#garmentPrice").value===""?null:Number($("#garmentPrice").value),boughtAt:$("#garmentBought").value,favorite:$("#garmentFavorite").checked,createdAt:old?.createdAt||new Date().toISOString(),image,updatedAt:new Date().toISOString()};
 if(!validImage(image)&&old?.hasImage)g.hasImage=true;
 if(!old&&bulkTotal>1&&!lastAnalysis)g.needsAI=1; /* se guardó sola sin análisis: «Completar con IA» la termina cuando haya análisis disponibles */
 if(changed)delete g.photoDraft; // ya no es el recorte de la foto de un look
 if(ph){g.bgWhite=edited&&(ph.mode==="alt"||!!ph.editedWhite);if(edited)g.photoFx=1;else delete g.photoFx;if(edited&&ph.asIs)g.catalogPhoto=1;else delete g.catalogPhoto}
 g.imageAt=changed?new Date().toISOString():old?.imageAt;if(!g.imageAt)delete g.imageAt;
 const i=myGarments().findIndex(x=>x.id===id);if(i>=0)myGarments()[i]=g;else myGarments().unshift(g);
 if(!await saveState())return;
 // La original se guarda solo en este móvil, para poder volver a ella; se toca solo si el guardado ha ido bien
 try{if(edited&&!ph.asIs&&validImage(ph.original))await dbSet(origKey(id),ph.original);else if(ph&&(!edited||ph.asIs))await dbBatch([],[origKey(id)])}catch(err){console.warn("ORIG",err)}
 const next=!old&&bulkQueue.length?bulkQueue.shift():null;
 closeGarment(true);render();toast(next?"Prenda guardada. Siguiente foto…":"Prenda guardada");
 if(next&&loadSheetFile){openGarment();updateBulkTitle();await loadSheetFile(next)}else if(!next&&bulkTotal>1&&!old){toast("Listo: "+plural(bulkTotal,"prenda añadida","prendas añadidas"));bulkTotal=0}
}
async function deleteGarment(){
 const id=$("#garmentId").value;if(!id||!confirm("¿Eliminar esta prenda?"))return;
 appState.data.garments=myGarments().filter(x=>x.id!==id);tomb(id);dbBatch([],[origKey(id)]).catch(()=>{});
 appState.data.looks=myLooks().map(l=>l.garmentIds.includes(id)?{...l,garmentIds:l.garmentIds.filter(x=>x!==id),updatedAt:new Date().toISOString()}:l);
 if(!await saveState())return;closeGarment();render();toast("Prenda eliminada");
}
async function analyzeGarment(){
 const ph=sheetPhoto,image=sheetImage();if(!image)return toast("Haz o elige una foto primero");
 const btn=$("#analyzeBtn");if(btn.disabled)return;btn.disabled=true;btn.textContent="Analizando…";setAnalyzeStatus("La IA está completando tu ficha…");
 try{
  const out=await api("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image})});
  if(sheetPhoto!==ph)return; // No aplicar un análisis antiguo a una foto nueva.
  const raw=out.garment||out.result||out;
  if(raw?.type==="underwear"||raw?.category==="Interior"){setAnalyzeStatus("La ropa interior no se añade a Atelier.");toast("Ropa interior no admitida");return "rejected"}
  const d=mapAnalysis(raw);lastAnalysis=cleanAnalysis(d);
  // Solo se rellena lo que la IA reconoce: no se borra lo que ya estaba escrito
  if(d.name||!$("#garmentName").value.trim())$("#garmentName").value=d.name||"Prenda sin identificar";if(d.category){$("#garmentCategory").value=d.category;syncGarmentCategory(true)}const typeOptions=GARMENT_TYPES[d.category]||[];const detected=[d.garmentType,d.subtype].find(t=>typeof t==="string"&&typeOptions.some(o=>o.toLocaleLowerCase("es")===t.trim().toLocaleLowerCase("es")));if(detected)$("#garmentType").value=typeOptions.find(t=>t.toLocaleLowerCase("es")===detected.trim().toLocaleLowerCase("es"));if(d.color)$("#garmentColor").value=d.color;
  if(d.style)$("#garmentStyle").value=d.style;if(d.season)$("#garmentSeason").value=d.season;if(d.notes&&!$("#garmentNotes").value.trim())$("#garmentNotes").value=d.notes;
  if(sheetPhoto===ph){
   const manual=Object.fromEntries(Object.entries(readMetadata()).filter(([k])=>META_FIELDS.find(x=>x[0]===k)?.[3]==="manual"));
   populateMetadata({...manual,...lastAnalysis,occasions:occasionDefaults(d.category,$("#garmentType").value,lastAnalysis?.occasions)});const details=$("#metadataDetails");if(details)details.open=true;
   const fv=$("#meta-formality")?.value,st=SHEET_STYLE[fv];if(st&&$("#garmentStyle").value!==st&&!(fv==="formal"&&$("#garmentStyle").value==="party"))$("#garmentStyle").value=st; /* estilo coherente con la formalidad que da la IA */
   const occOpen=$("#garmentOccasions");if(occOpen)occOpen.open=true;
   setAnalyzeStatus("Ficha completada. Revisa sobre todo la formalidad y las ocasiones: son lo que más cambia tus looks. Luego pulsa Confirmar y guardar.");
  }
  toast("Análisis completado");
 }catch(e){console.error("ANALYZE",e);setAnalyzeStatus(e.message==="AI_QUOTA"?QUOTA_SHEET_MSG:"No se pudo analizar. Puedes rellenar los datos a mano o reintentarlo.");if(e.message!=="AI_QUOTA")toast("No se pudo analizar la prenda")}
 finally{btn.disabled=false;btn.textContent="✨ Analizar foto con IA"}
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
 if(logs().some(l=>l.date===date&&lookSig(l.garmentIds||[])===lookSig(validIds)))return toast("Ese uso ya estaba registrado ese día");
 await mutate(()=>logs().unshift({id:uid(),date,garmentIds:validIds,lookId:lookId||null,updatedAt:new Date().toISOString()}),"Uso registrado");
}
function openLook(id){
 if(!id&&!stylistReady())return toast(stylistMissingText());
 const l=myLooks().find(x=>x.id===id);
 $("#lookTitle").textContent=l?"Editar look":"Nuevo look";$("#lookId").value=l?.id||"";$("#lookName").value=l?.name||"";$("#lookOccasion").replaceChildren(...Object.entries(occasions).map(([value,label])=>new Option(label,value)));$("#lookOccasion").value=l?.occasion||"daily";$("#lookFavorite").checked=!!l?.favorite;
 $("#lookGarments").innerHTML=myGarments().length?myGarments().map(g=>`<label class="field"><span><input type="checkbox" value="${esc(g.id)}" ${l?.garmentIds.includes(g.id)?"checked":""}> ${esc(g.name)}</span></label>`).join(""):`<p class="muted">Añade prendas antes de crear un look.</p>`;
 $("#deleteLook").classList.toggle("hidden",!l);$("#lookSheet").classList.remove("hidden");
}
function closeLook(){$("#lookSheet").classList.add("hidden")}
async function saveLook(e){
 e.preventDefault();
 const id=$("#lookId").value||uid(),garmentIds=$$("#lookGarments input:checked").map(x=>x.value);
 if(!garmentIds.length)return toast("Selecciona al menos una prenda");
 if(!lookComplete(garmentIds.map(id=>myGarments().find(g=>g.id===id))))return toast(BASE_MSG);
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
/* Paleta del look (regla de tres colores, #136 §3; Noelia: «las opciones me parecen bastante horribles», 09/10):
   los neutros cuentan cada uno (negro, blanco, beige…), los vivos por familia; los metales (dorado, plateado) no cuentan. */
const METAL=/dorad|platead|\boro\b|\bplata\b|gold|silver|metal/i;
const colorKey=g=>{if(METAL.test(g.color||""))return "";const c=colorInfo(g.color);return c.fam==="neutro"?c.word.replace(/a$/,"o"):c.fam==="estampado"?"multicolor":c.fam}; // un estampado cuenta por su color real (revisión de Codex, #157)
const paletteOf=gs=>new Set(gs.map(colorKey).filter(Boolean));
function colorInfo(text,pattern){
 if(pattern&&pattern!=="plain"&&pattern!=="unknown")return {fam:"estampado",word:"estampado-"+pattern};
 const key=String(text||"");if(colorCache.has(key))return colorCache.get(key);
 let info={fam:"",word:""};
 outer:for(const w of norm(text).split(/[^a-z]+/).filter(Boolean))for(const [fam,list] of COLOR_WORDS)if(list.includes(w)){info={fam,word:w};break outer}
 colorCache.set(key,info);return info;
}
const GOOD_PAIRS=new Set(["azul|rosa","azul|amarillo","azul|naranja","azul|rojo","azul|verde","verde|rosa","verde|morado","morado|amarillo","rojo|rosa","naranja|verde"]);
function colorsMatch(a,b){
 if(!a.fam||!b.fam)return true;
 if(a.fam==="neutro"||b.fam==="neutro")return true;
 if(a.fam==="estampado"&&b.fam==="estampado")return true; // sin veto de familias: puntuar evidencia concreta del conjunto
 if(a.fam==="estampado"||b.fam==="estampado")return true;
 if(a.fam===b.fam)return true;
 return GOOD_PAIRS.has([a.fam,b.fam].sort().join("|"));
}
const PAIRS={Arriba:["Abajo","Capas","Zapatos","Bolsos","Accesorios"],Abajo:["Arriba","Capas","Zapatos","Bolsos","Accesorios"],Vestidos:["Capas","Zapatos","Bolsos","Accesorios"],Capas:["Arriba","Abajo","Vestidos","Zapatos","Bolsos","Accesorios"],Zapatos:["Arriba","Abajo","Vestidos","Capas","Bolsos"],Bolsos:["Arriba","Abajo","Vestidos","Capas","Zapatos"],Accesorios:["Arriba","Abajo","Vestidos","Capas"]};
const CORE={Arriba:["Abajo"],Abajo:["Arriba"],Vestidos:["Zapatos","Capas"],Capas:["Arriba","Abajo","Vestidos"],Zapatos:["Abajo","Vestidos"],Bolsos:["Arriba","Abajo","Vestidos"],Accesorios:["Arriba","Abajo","Vestidos"]};
/* Estilos flexibles (#52): afinidad 0–1 entre estilos de prenda; puntúa, no descarta.
   Solo es imposible ropa de deporte con ropa de fiesta (afinidad < 0,3). Deportivas con americana = athleisure. */
const STYLE_AFF={casual:{casual:1,smart:.8,sport:.8,party:.5},smart:{smart:1,casual:.8,party:.8,sport:.55},party:{party:1,smart:.8,casual:.5,sport:.1},sport:{sport:1,casual:.8,smart:.55,party:.1}};
function styleAffinity(a,b){
 if(!a.style||!b.style)return .8;
 const v=STYLE_AFF[a.style]?.[b.style]??.6;
 // Calzado o capa deportivos con prendas arregladas: mezcla intencionada (deportivas + americana)
 if(v===.55&&[a,b].some(g=>g.style==="sport"&&["Zapatos","Capas","Bolsos","Accesorios"].includes(g.category)))return .8;
 return v;
}
const STYLE_OK=Object.fromEntries(Object.entries(STYLE_AFF).map(([k,m])=>[k,Object.keys(m).filter(x=>m[x]>=.3)]));
/* Combinan de verdad: reglas básicas (pairs) y relación de estilista ≥ 0,6 con el gusto del perfil. Lo usan «¿Lo compro?», Recomendaciones y Maletas (revisión general) */
let goesMemo={sig:null,ctx:null};const goesCtx=()=>{if(goesMemo.sig!==relCache.sig)goesMemo={sig:relCache.sig,ctx:engineContext({occasion:null})};return goesMemo.ctx}; /* con el gusto del perfil (revisión de Codex, #181) */
const goes=(a,b,ctx=goesCtx())=>pairs(a,b)&&(relationOf(a,b,ctx)?.s??1)>=REL_OK;
/* Ropa primero (Noelia, 10/10/2026): la ropa se relaciona con ropa; calzado, bolsos y complementos se miden contra bases de look completas
   (arriba + abajo, o un vestido), nunca contra una prenda suelta: unos pendientes van con un look, no con una camiseta */
const CLOTHES=["Arriba","Abajo","Vestidos","Capas"],isClothes=g=>CLOTHES.includes(g?.category);
let lbCache={k:"",v:[]};
function lookBases(gs=myGarments()){ensureRelations();const k=relCache.sig+"|"+gs.map(g=>g.id).join(",");if(lbCache.k===k)return lbCache.v; /* se calcula una vez por armario y fichas (revisión de Codex, #185) */
 const tops=gs.filter(g=>g.category==="Arriba"),bottoms=gs.filter(g=>g.category==="Abajo"),out=gs.filter(g=>g.category==="Vestidos").map(d=>[d]),combos=[];
 for(const t of tops)for(const b of bottoms)if(goes(t,b))combos.push([t,b]);
 const room=Math.max(0,400-out.length),step=combos.length>room?combos.length/room:1; /* como mucho 400, como outfitBases */
 for(let i=0;i<combos.length&&out.length<400;i+=step)out.push(combos[Math.floor(i)]);
 lbCache={k,v:out};return out}
/* Un complemento completa una base solo si hay una ocasión en la que se llevan todos: unas zapatillas de diario no van con un vestido de lentejuelas (revisión, 10/10/2026) */
const fitsOcc=(g,o)=>Array.isArray(g.occasions)&&g.occasions.length?g.occasions.includes(o):occasionFits(g,o), /* las ocasiones de la ficha mandan; sin ficha, se deducen (revisión de Codex, #191) */
 sharesOccasion=(c,b)=>REL_OCCS.some(o=>fitsOcc(c,o)&&b.every(x=>fitsOcc(x,o)));
const basesFor=(c,bs=lookBases())=>bs.filter(b=>b.every(x=>goes(c,x))&&sharesOccasion(c,b)); /* zapatos, bolsos y complementos se miden contra looks enteros, no prenda a prenda */
function pairs(a,b){
 if(a.id&&a.id===b.id)return false;
 if(a.category&&b.category&&!(PAIRS[a.category]||[]).includes(b.category))return false;
 if(!a.category&&!b.category)return false;
 if(styleAffinity(a,b)<.3)return false;
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
/* Un look está completo si tiene parte de arriba y de abajo, o una pieza entera (vestido o mono, categoría
   Vestidos). Para casa y playa también valen un conjunto de casa o de baño. Regla obligatoria (Noelia, 09/10). */
const BASE_MSG="Un look necesita parte de arriba y de abajo, o un vestido o mono";
function lookComplete(gs){
 const c=new Set(gs.filter(Boolean).map(g=>g.category));
 return c.has("Vestidos")||c.has("Casa")||c.has("Baño")||c.has("Arriba")&&c.has("Abajo");
}
/* ===== Cerebro estilista (#159, #160; principios de Noelia, 10/10/2026) =====
   Principio rector: Atelier no busca el conjunto con más prendas compatibles, sino la combinación más coherente,
   favorecedora y adecuada al contexto, usando solo las piezas que aporten valor.
   Nivel 1, relaciones: pairEvidence(a,b) son los HECHOS (reutiliza pairColor, styleAffinity, formalLevel, occasionFits…);
   contextualizePair(ev,ctx) los valora para la ocasión, el tiempo y el gusto del perfil (el feedback solo entra aquí).
   Nivel 2, conjunto: el núcleo (vestido o mono, o arriba+abajo) marca la dirección; cada pieza añadida necesita una función
   (proteger del frío, repetir un color, aportar estructura, equilibrar, contraste, punto de interés) y mejorar el conjunto. */
const REL_OCCS=["daily","work","party","event","formal","sport","beach"];
const REGISTER_OF=lv=>lv<.6?"deportivo":lv<1.5?"informal":lv<2.5?"arreglado":"de fiesta";
const REL_PAIRS=new Set(["Arriba|Abajo","Arriba|Capas","Arriba|Zapatos","Arriba|Bolsos","Arriba|Accesorios","Abajo|Capas","Abajo|Zapatos","Abajo|Bolsos","Abajo|Accesorios","Vestidos|Capas","Vestidos|Zapatos","Vestidos|Bolsos","Vestidos|Accesorios","Capas|Zapatos","Capas|Bolsos","Capas|Accesorios","Zapatos|Bolsos","Zapatos|Accesorios","Bolsos|Accesorios"]);
const relatedCats=(a,b)=>REL_PAIRS.has(a.category+"|"+b.category)||REL_PAIRS.has(b.category+"|"+a.category);
const STRUCTURED=/blazer|americana|chaqueta de traje|sastre|trench|gabardina|abrigo de pa[ñn]o/i;
/* Mezcla intencionada (coherencia no es uniformidad): zapatillas limpias con prendas arregladas, americana con vaquero */
function intentionalMix(a,b){
 for(const [x,y] of [[a,b],[b,a]]){
  if(isSneaker(x)&&x.formality!=="sport"&&!OUTDOOR.test(textOf(x))&&y.category!=="Zapatos"&&formalLevel(y)>=2) /* deportivas urbanas (no de running ni montaña) */return "zapatillas con prenda arreglada";
  if(x.category==="Capas"&&STRUCTURED.test(textOf(x))&&isDenimPiece(y))return "americana con vaquero";
 }
 return "";
}
const EVIDENCE_FIELDS=g=>["color",...(["Arriba","Vestidos","Capas"].includes(g.category)?["sleeve","thickness"]:[]),...(BIG.includes(g.category)?["warmth"]:[]),"formality"];
let relCache={sig:"",ev:new Map(),learn:new Map(),fast:new Map(),feat:new Map(),block:new Set()};
/* Huella por prenda de los datos que usan las relaciones (no basta el updatedAt máximo: una edición sincronizada puede traer una fecha anterior; revisión de ChatGPT, #164) */
const REL_FIELDS=["id","name","category","type","subtype","color","secondaryColor","pattern","fabric","fit","length","sleeve","neckline","thickness","warmth","formality","occasions","season","style","details","archived"];
const relPrint=g=>REL_FIELDS.map(k=>{const v=g[k];return v==null?"":Array.isArray(v)?v.join("+"):String(v)}).join("\u0001");
function relSig(){const d=appState.data||{};return (d.garments||[]).map(relPrint).join("\u0002")+"|"+JSON.stringify(d.feedback||{})+"|"+(d.looks||[]).map(l=>l.id+":"+(l.favorite?"f":"")+(l.inspired?"i":"")+(l.edited?"e"+(l.removed||[]).join("."):"")+(l.dislikeReason||"")+":"+(l.garmentIds||[]).join(".")).join(",") /* lo que enseña relaciones: favorito, inspiración, motivo y prendas (revisión de Codex, #164) */+"|"+(d.preferences?.workDress||"")}
/* Una vez por cálculo (rankOutfits, ficha): si el armario, el feedback o el código de vestir cambian, se rehace la caché */
function ensureRelations(){
 const sig=relSig();if(relCache.sig===sig)return;
 relCache={sig,ev:new Map(),learn:new Map(),fast:new Map(),feat:new Map(),block:pieceNotes().pairs};const fb=appState.data.feedback||{};
 for(const l of myLooks()){const v=fb[l.id]==="down"?(l.dislikeReason==="hoy"||l.dislikeReason==="color"?0:-1):l.edited?2:fb[l.id]==="up"||l.favorite||l.inspired?1:0;const ids=l.garmentIds||[]; /* editar es la señal más clara: cuenta doble */
  /* look editado: lo que quitó la persona resta un poco con lo que dejó */for(const r of (l.edited&&Array.isArray(l.removed)?l.removed:[]))for(const x of ids){const k=[r,x].sort().join("|");relCache.learn.set(k,(relCache.learn.get(k)||0)-2)}
  if(!v)continue;
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const k=[ids[i],ids[j]].sort().join("|");relCache.learn.set(k,(relCache.learn.get(k)||0)+v)}}
}
/* la formalidad de la ficha manda sobre el estilo (un vestido de fiesta etiquetado «casual» es de fiesta) */
const SHEET_STYLE={sport:"sport",casual:"casual",smartcasual:"smart",formal:"smart",party:"party"};
const sheetStyle=g=>g.formality in SHEET_STYLE&&g.style!==SHEET_STYLE[g.formality]?{...g,style:SHEET_STYLE[g.formality]}:g;
/* Rasgos de cada prenda que usan las relaciones: se calculan una vez por prenda, no por pareja (rendimiento, revisión de Codex #164) */
function relFeat(g){
 let f=relCache.feat.get(g);if(f)return f;const t=textOf(g);
 f={fl:formalLevel(g),heavy:warmthOf(g)>=2||g.thickness==="grueso",light:summerFootwear(g)||isShortBottom(g)||g.sleeve==="sin mangas",occ:REL_OCCS.filter(o=>occasionFits(g,o)),ss:sheetStyle(g),
  urban:isSneaker(g)&&g.formality!=="sport"&&!OUTDOOR.test(t),denimMain:isDenimPiece(g)&&["Arriba","Abajo","Vestidos"].includes(g.category),tailoredPrint:isPatterned(g)&&formalLevel(g)>=2&&["Arriba","Abajo","Vestidos"].includes(g.category),structured:g.category==="Capas"&&STRUCTURED.test(t),denim:isDenimPiece(g),declared:!g.formality&&Array.isArray(g.occasions)?g.occasions:[],
  missing:EVIDENCE_FIELDS(g).filter(k=>!g[k]).map(k=>(g.name||g.type||g.category)+": "+k)};
 relCache.feat.set(g,f);return f;
}
function pairEvidence(a,b){
 if(!a||!b||a.id===b.id||!relatedCats(a,b))return null;
 let ma=relCache.ev.get(a);if(ma?.has(b))return ma.get(b); /* por objeto: una copia de la prenda con otros datos no reutiliza la relación antigua */
 const pc=pairColor(a,b),fa=relFeat(a),fb=relFeat(b);
 const mix=fa.urban&&b.category!=="Zapatos"&&fb.fl>=2||fb.urban&&a.category!=="Zapatos"&&fa.fl>=2?"zapatillas con prenda arreglada":fa.structured&&fb.denim||fb.structured&&fa.denim?"americana con vaquero":"";
 const ev={ids:[a.id,b.id],color:pc.s,colorKind:pc.k||"",small:!BIG.includes(a.category)||!BIG.includes(b.category),style:styleAffinity(fa.ss,fb.ss),formalGap:Math.abs(fa.fl-fb.fl),
  register:REGISTER_OF((fa.fl+fb.fl)/2),seasonClash:!!(a.season&&b.season&&a.season!=="all"&&b.season!=="all"&&a.season!==b.season),
  thermalClash:fa.heavy&&fb.light||fb.heavy&&fa.light,patternUncertain:!!pc.uncertain,textureClash:fa.denimMain&&fb.tailoredPrint||fb.denimMain&&fa.tailoredPrint,occasions:fa.occ.filter(o=>fb.occ.includes(o)),mix,declared:fa.declared.concat(fb.declared),uncertain:fa.missing.concat(fb.missing)};
 if(!ma)relCache.ev.set(a,ma=new Map());ma.set(b,ev);let mb=relCache.ev.get(b);if(!mb)relCache.ev.set(b,mb=new Map());mb.set(a,ev);return ev;
}
function contextualizePair(ev,ctx){
 if(!ev)return null;
 const pk=ev.ids[0]<ev.ids[1]?ev.ids[0]+"|"+ev.ids[1]:ev.ids[1]+"|"+ev.ids[0];
 const color=ev.colorKind==="two-patterns"&&ctx?.likes?.has("pattern")&&ev.color>=.5?Math.min(.8,ev.color+.05):ev.colorKind==="opposite"&&ev.small?.75:ev.color;
 const style=ev.mix?Math.max(ev.style,.85):ev.style,formal=ev.mix?Math.max(1-ev.formalGap/3,.75):1-ev.formalGap/3; // mezcla intencionada: no resta
 /* la ficha manda: si a una le falta la formalidad pero está marcada para esta ocasión (y ambas valen), su estilo no resta */
 const sheet=ctx?.occasion&&ev.declared?.includes(ctx.occasion)&&ev.occasions.includes(ctx.occasion);
 let s=.35*color+.25*(sheet?Math.max(style,.75):style)+.2*(sheet?Math.max(formal,.75):formal)+.1*(ev.seasonClash?.2:1)+.1*(ev.thermalClash?.4:1);
 s=Math.min(s,Math.min(color,sheet?Math.max(style,.75):style,sheet?Math.max(formal,.75):formal)+.2); /* eslabón débil también dentro del par: un choque claro (dos estampados, deporte con fiesta) no lo compensan los demás aspectos */
 if(!ev.occasions.length)s*=.8;else if(ctx?.occasion&&!ev.occasions.includes(ctx.occasion))s*=.85;
 const n=relCache.learn.get(pk)||0;s+=Math.max(-.3,Math.min(.3,.1*n)); // lo aprendido del perfil
 /* El denim con un estampado de sastrería no es un veto: ambos pueden ser deliberados. Evaluar color, proporción, ocasión y el look global. */
 if(ev.patternUncertain)s=Math.min(s,.59); /* mezcla posible, pero sin escala/distribución/contraste no aprobarla como pareja fuerte */
 if(relCache.block.has(pk))s=Math.min(s,.3); /* «no pegan» dicho por la persona: pareja débil */
 const r={s:Math.max(0,Math.min(1,Math.round(s*100)/100)),register:ev.register,contexts:ev.occasions,mix:ev.mix,uncertain:ev.uncertain};
 return r; /* la caché vive en relationOf, por objeto */
}
/* acceso rápido por objeto (sin construir claves de texto): el motor pregunta cientos de miles de veces por las mismas parejas */
const learnOf=(a,b)=>{if(!a?.id||!b?.id)return 0;const n=relCache.learn.get(a.id<b.id?a.id+"|"+b.id:b.id+"|"+a.id)||0;return Math.max(-3,Math.min(3,n))}; /* señal aprendida del perfil para una pareja (votos, favoritos, looks editados) */
function relationOf(a,b,ctx){
 if(!a||!b)return null;const ck=(ctx?.occasion||"")+(ctx?.likes?.has("pattern")?"|p":"");
 let m=relCache.fast.get(ck);if(!m)relCache.fast.set(ck,m=new Map());
 let ma=m.get(a);if(!ma)m.set(a,ma=new Map());if(ma.has(b))return ma.get(b);
 const r=contextualizePair(pairEvidence(a,b),ctx);ma.set(b,r);let mb=m.get(b);if(!mb)m.set(b,mb=new Map());mb.set(a,r);return r;
}
const REL_OK=.6,REL_WEAK=.4;
/* La red vista desde una prenda: con qué combina, de mejor a peor (ficha «Combina con», Combinar prenda) */
/* con ocasión: la pareja se valora para esa ocasión y las dos prendas tienen que valer para ella */
const relationsFor=(g,min=REL_OK,occ=null)=>{ensureRelations();const ctx=occ?{occasion:occ}:undefined;return myGarments().map(x=>({g:x,r:relationOf(g,x,ctx)})).filter(x=>x.r&&x.r.s>=min&&(!occ||x.r.contexts.includes(occ))).sort((a,b)=>b.r.s-a.r.s)};
/* Núcleo del look: el vestido o mono, o la parte de arriba + la de abajo. Marca la dirección estética. */
const nucleusKey=gs=>lookSig(nucleusOf(gs).map(g=>g.id)); /* identifica el núcleo de un look: «Otro look» salta al siguiente núcleo */
const nucleusOf=gs=>{const d=gs.find(g=>g.category==="Vestidos");return d?[d]:gs.filter(g=>g.category==="Arriba"||g.category==="Abajo")};
function comboIdentity(gs,ctx){
 const rels=[];for(let i=0;i<gs.length;i++)for(let j=i+1;j<gs.length;j++){const r=relationOf(gs[i],gs[j],ctx);if(r)rels.push({a:gs[i],b:gs[j],r})}
 const lv=xs=>xs.reduce((t,g)=>t+formalLevel(g),0)/Math.max(1,xs.length),nuc=nucleusOf(gs),main=gs.filter(g=>BIG.includes(g.category)||g.category==="Zapatos");
 return {nucleus:REGISTER_OF(lv(nuc.length?nuc:gs)),register:REGISTER_OF(lv(main.length?main:gs)),contexts:REL_OCCS.filter(o=>gs.every(g=>occasionFits(g,o))),
  weakest:rels.reduce((m,x)=>!m||x.r.s<m.r.s?x:m,null),mean:rels.length?rels.reduce((t,x)=>t+x.r.s,0)/rels.length:1};
}
/* Qué aporta una pieza al look (sin ella → con ella). Sin función, no entra. Solo se dicen motivos con base en los datos. */
function pieceFunctions(x,look,ctx){
 const f=[],t=ctx.temp,nuc=nucleusOf(look),base=nuc.length?nuc:look,name=c=>c.toLowerCase();
 if(x.category==="Capas"){
  if(layerRule(t).need)f.push("protege del frío");
  else if(Number.isFinite(t)){const before=outfitClo(look)-cloTarget(t),after=outfitClo([...look,x])-cloTarget(t);if(before<-.15&&Math.abs(after)<Math.abs(before))f.push("abriga lo justo para "+t+" °C")}
  if(STRUCTURED.test(textOf(x))&&base.every(g=>!STRUCTURED.test(textOf(g))))f.push("aporta estructura");
  const lvBase=base.reduce((s,g)=>s+formalLevel(g),0)/Math.max(1,base.length);
  if(["work","event","formal"].includes(ctx.occasion)&&formalLevel(x)>lvBase+.4)f.push("eleva el conjunto");
 }
 const k=colorKey(x),echo=k&&!["negro","blanco","gris"].includes(k)&&look.find(g=>colorKey(g)===k&&g.category!==x.category);
 if(echo&&!BIG.includes(x.category))f.push("repite el "+name(x.color||k)+" de "+name(echo.type||echo.category));
 const allNeutral=base.every(g=>colorInfo(g.color,g.pattern).fam==="neutro"),xc=colorInfo(x.color,x.pattern);
 if(!BIG.includes(x.category)&&allNeutral&&xc.fam&&xc.fam!=="neutro"&&xc.fam!=="estampado")f.push("pone un punto de color");
 if(!BIG.includes(x.category)&&allNeutral&&(isPatterned(x)||METAL.test(x.color||"")))f.push("aporta un punto de interés");
 const vol=g=>({oversize:2,holgado:2,regular:1,recto:1,entallado:0,ajustado:0}[g.fit]);
 if(x.category==="Capas"&&vol(x)!=null&&base.length&&base.every(g=>vol(g)!=null)&&Math.abs(vol(x)-base.reduce((s,g)=>s+vol(g),0)/base.length)>=1)f.push("equilibra las proporciones");
 for(const g of look){const m=intentionalMix(x,g);if(m){f.push("contraste intencionado ("+m+")");break}}
 return f;
}
function outfitBases(gs){
 const tops=gs.filter(g=>g.category==="Arriba"),bottoms=gs.filter(g=>g.category==="Abajo"),bases=gs.filter(g=>g.category==="Vestidos").map(d=>[d]),combos=[];
 for(const t of tops)for(const b of bottoms)if(pairs(t,b)&&(relationOf(t,b)?.s??1)>=REL_OK)combos.push([t,b]); // núcleo: solo parejas que se llevan bien
 if(!combos.length)for(const t of tops)for(const b of bottoms)if(pairs(t,b))combos.push([t,b]); // armario muy pequeño: las aceptables
 // Como mucho 400 en total: los vestidos siempre entran y el resto se reparte a lo largo de todas las combinaciones
 const room=Math.max(0,400-bases.length),step=combos.length>room?combos.length/room:1;
 for(let i=0;i<combos.length&&bases.length<400;i+=step)bases.push(combos[Math.floor(i)]);
 return bases;
}

/* «Guardar el look que llevo»: una foto del look puesto → un solo análisis de IA (mode "outfit") devuelve cada
   prenda con su recuadro. Se recorta cada una de la foto, se buscan parecidas en el armario y la usuaria revisa:
   «Es mi …», «Prenda nueva» (con el recorte como foto provisional, photoDraft) o «No guardar». Después se guardan
   las prendas nuevas, el look (si está completo) y, si quiere, el uso de hoy. */
const OUTFIT_TYPES={top:"Arriba",bottom:"Abajo",dress:"Vestidos",outerwear:"Capas",shoes:"Zapatos",bag:"Bolsos",accessory:"Accesorios"};
async function cropBox(src,box){
 const img=await loadImg(src),W=img.naturalWidth||img.width,H=img.naturalHeight||img.height,[x,y,w,h]=box,m=5;
 const x0=Math.max(0,(x-m)/100*W),y0=Math.max(0,(y-m)/100*H),x1=Math.min(W,(x+w+m)/100*W),y1=Math.min(H,(y+h+m)/100*H);
 const cw=Math.max(8,Math.round(x1-x0)),ch=Math.max(8,Math.round(y1-y0)),c=mkCanvas(cw,ch);
 c.getContext("2d").drawImage(img,x0,y0,cw,ch,0,0,cw,ch);return toJpeg(c,IMAGE_QUALITY);
}
const outfitMatches=it=>myGarments().filter(g=>g.category===it.category&&(isDuplicate(it,g)||!!it.color&&norm(g.color)===norm(it.color))).slice(0,4);
function renderInspoSheet(d){
 let body;
 if(d.loading)body='<p class="muted" role="status" aria-live="polite">Buscando las prendas parecidas en tu armario…</p><button type="button" class="secondary wide" id="outfitCancel">Cancelar</button>';
 else if(d.preview)body=(d.error?'<p class="error" role="alert">'+fx(d.error)+'</p>':'')+
  '<p class="muted">Reconoceré cada prenda del look y buscaré las más parecidas de tu armario. La imagen no se guarda: solo tu versión del look.</p>'+
  '<div class="actions"><button type="button" class="secondary" id="outfitChange">Cambiar imagen</button><button type="button" class="primary" id="outfitAnalyze">'+(d.error?'Reintentar':'Recrear con mi armario')+' · 1 análisis</button></div>';
 else{const sel=outfitSelection(d),miss=d.items.filter(it=>it.choice==="missing");
  body='<p class="muted">Tu versión con lo que tienes. Cambia cualquier prenda si prefieres otra.</p>'+
  '<div class="outfit-items">'+d.items.map((it,i)=>'<div class="outfit-item"><img src="'+it.crop+'" alt=""><div class="outfit-item-body"><strong>'+fx(it.name||it.category)+'</strong><span class="muted">'+fx(it.category+(it.color?" · "+it.color:""))+'</span>'+
   '<select data-outfit-choice="'+i+'" aria-label="'+fx("Qué uso en lugar de «"+(it.name||it.category)+"»")+'">'+optionList([...it.matches.map(g=>[g.id,"Mi «"+g.name+"»"]),["missing","No tengo nada parecido"],["skip","No la necesito"]],it.choice)+'</select></div></div>').join("")+'</div>'+
  (sel.length?'<div class="inspo-result"><p class="helper">Tu look</p>'+outfitBoard(sel)+'</div>':'')+
  '<label class="field"><span>Nombre del look</span><input id="outfitName" maxlength="80" placeholder="Inspiración" value="'+fx(d.name)+'"></label>'+
  (miss.length?'<label class="switch-line"><input type="checkbox" id="inspoWish"'+(d.wish?' checked':'')+'> Añadir a la wishlist lo que me falta ('+fx(miss.map(it=>it.name||it.category).join(", "))+')</label>':'')+
  '<p class="helper" id="outfitWarn">'+fx(!sel.length?"No he encontrado nada parecido en tu armario."+(miss.length?" Puedes añadir las prendas a la wishlist.":""):lookComplete(sel)?"Se guardará tu versión del look con 👍: así aprendo lo que te gusta.":BASE_MSG+": no se guardará el look.")+'</p>'+
  '<button type="button" class="primary wide" id="outfitSave">Guardar</button>'}
 const {el,close}=showSheet("outfitSheet",'<div class="section-head"><h2 id="outfitSheetTitle">Recrear un look con mi armario</h2><button type="button" class="secondary" data-close-sheet>Cerrar</button></div>'+
  '<div class="outfit-review-layout"><div class="outfit-review-photo"><img class="outfit-photo" src="'+d.image+'" alt="Look de inspiración"><p class="outfit-photo-caption">Inspiración · no se guarda</p></div><div class="outfit-review-content">'+body+'</div></div>',()=>{if(outfitDraft===d)outfitDraft=null});
 $("#outfitAnalyze",el)?.addEventListener("click",analyzeOutfit);
 $("#outfitCancel",el)?.addEventListener("click",()=>{outfitDraft={token:{},image:d.image,preview:true,inspo:true};renderOutfitSheet()});
 $("#outfitChange",el)?.addEventListener("click",()=>{close();pickOutfitPhoto(true)});
 if(!d.items)return;
 $$("[data-outfit-choice]",el).forEach(x=>x.addEventListener("change",()=>{d.name=$("#outfitName",el).value;d.wish=$("#inspoWish",el)?.checked??d.wish;d.items[Number(x.dataset.outfitChoice)].choice=x.value;renderOutfitSheet()}));
 $("#outfitSave",el)?.addEventListener("click",async e=>{
  const btn=e.currentTarget;if(d.saving)return;d.saving=true;btn.disabled=true;
  d.name=$("#outfitName",el).value.trim();d.wish=$("#inspoWish",el)?.checked??false;
  const sel=outfitSelection(d),ids=[...new Set(sel.map(g=>g.id))],complete=ids.length&&lookComplete(sel),miss=d.wish?d.items.filter(it=>it.choice==="missing"):[],now=new Date().toISOString(),lookId=uid();
  if(!complete&&!miss.length){d.saving=false;btn.disabled=false;return toast(ids.length?BASE_MSG:"No hay nada que guardar")}
  const ok=await mutate(()=>{
   if(complete){myLooks().unshift({id:lookId,name:d.name||"Inspiración",garmentIds:ids,occasion:appState.data.preferences.occasion||"daily",favorite:false,ai:false,inspired:true,updatedAt:now});appState.data.feedback[lookId]="up"}
   for(const it of miss)appState.data.wishlist.unshift({id:uid(),name:it.name||it.garmentType||it.category,price:0,category:it.category,url:"",bought:false,addedAt:dayISO(),verdict:"Inspiración",updatedAt:now});
  });
  if(!ok){d.saving=false;btn.disabled=false;return}
  outfitDraft=null;close();
  toast("Guardado: "+[complete?"tu versión del look":"",miss.length?plural(miss.length,"prenda","prendas")+" en la wishlist":""].filter(Boolean).join(" y "));
 });
}
/* «Inspiración: recréalo con tu armario» (Noelia, 09/10): una captura de un look que te gusta (Pinterest, una influencer,
   una revista) → el mismo análisis «outfit» → para cada prenda, las más parecidas de tu armario por sus características.
   No se guarda ninguna imagen ni se crean prendas: la captura es de otra persona. Tu versión se guarda como look con 👍. */
function inspoScore(it,g){
 if(g.category!==it.category)return -1;
 const ci=colorInfo(it.color,it.pattern),cg=colorInfo(g.color,g.pattern),same=(a,b)=>a&&b&&norm(a)===norm(b);
 let s=same(it.color,g.color)?3:ci.fam&&ci.fam===cg.fam&&ci.fam!=="neutro"?1.5:ci.word&&ci.word===cg.word?2:0;
 if(it.garmentType&&(same(it.garmentType,g.type)||norm(textOf(g)).includes(norm(it.garmentType))))s+=2;
 if(it.pattern&&it.pattern===(g.pattern||"plain"))s+=1; // solo si el análisis dio el estampado (revisión de Codex, #151)
 for(const [k,w] of [["formality",1],["sleeve",.5],["length",.5],["style",.5]])if(it[k]&&g[k]&&it[k]===g[k])s+=w;
 return s;
}
const inspoMatches=it=>myGarments().map(g=>({g,s:inspoScore(it,g)})).filter(x=>x.s>=2).sort((a,b)=>b.s-a.s).slice(0,3).map(x=>x.g);
let outfitDraft=null;
function pickOutfitPhoto(inspo=false){
 const input=document.createElement("input");input.type="file";input.accept="image/*";
 input.addEventListener("change",()=>{const f=input.files?.[0];if(f)startOutfitPhoto(f,inspo===true)});input.click();
}
function bindOutfitPhoto(root){$$("[data-outfit-photo]",root).forEach(b=>b.addEventListener("click",()=>pickOutfitPhoto(false)));$$("[data-inspo-photo]",root).forEach(b=>b.addEventListener("click",()=>pickOutfitPhoto(true)))}
async function startOutfitPhoto(file,inspo=false){
 let image;try{image=await readImage(file)}catch(e){return toast(e.message==="IMAGE_TOO_LARGE"?"La imagen es demasiado grande":"No se pudo leer la foto")}
 if(!image)return;
 outfitDraft={token:{},image,preview:true,inspo};renderOutfitSheet(); // vista previa; con «Analizar automáticamente», se analiza sin otro toque (UX: lo mínimo posible)
 if(appState.data.preferences.autoAnalyze!==false&&aiUsage().analyze<AI_LIMITS.analyze)analyzeOutfit();
}
async function analyzeOutfit(){
 const d0=outfitDraft;if(!d0?.image||d0.loading)return;
 const token={},image=d0.image,inspo=!!d0.inspo;outfitDraft={token,image,loading:true,inspo};renderOutfitSheet();
 try{
  const out=await api("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image,mode:"outfit"})});
  if(outfitDraft?.token!==token)return;
  const items=[];
  for(const raw of Array.isArray(out.items)?out.items:[]){
   const category=OUTFIT_TYPES[raw.type];if(!category||!Array.isArray(raw.box))continue;
   const it={...mapAnalysis(raw),category,crop:await cropBox(image,raw.box).catch(()=>image)},matches=inspo?inspoMatches(it):outfitMatches(it);
   items.push({...it,matches,choice:matches[0]?.id||(inspo?"missing":"new")});
  }
  if(outfitDraft?.token!==token)return;
  outfitDraft=items.length?{token,image,items,name:"",wear:!inspo,inspo,wish:true} /* es el look que llevas: «me lo he puesto hoy» marcado de entrada */:{token,image,preview:true,inspo,error:"No he encontrado prendas en la foto. Prueba con una foto de cuerpo entero y con buena luz."};
 }catch(e){
  if(outfitDraft?.token!==token)return;
  if(e.message==="SESSION_EXPIRED"){outfitDraft=null;$$("#outfitSheet").forEach(x=>x.remove());return}
  outfitDraft={token,image,preview:true,inspo,error:e.message==="AI_QUOTA"?"Has llegado al límite de análisis de hoy.":"No he podido reconocer las prendas. Puedes reintentarlo."};
 }
 renderOutfitSheet();
}
function outfitSelection(d){
 return d.items.filter(it=>it.choice!=="skip"&&it.choice!=="missing").map(it=>it.choice==="new"?it:myGarments().find(g=>g.id===it.choice)).filter(Boolean);
}
function renderOutfitSheet(){
 const d=outfitDraft;if(!d)return;
 if(d.inspo)return renderInspoSheet(d);
 let body;
 if(d.loading)body='<p class="muted" role="status" aria-live="polite">Reconociendo las prendas…</p><button type="button" class="secondary wide" id="outfitCancel">Cancelar</button>';
 else if(d.preview)body=(d.error?'<p class="error" role="alert">'+fx(d.error)+'</p>':'')+
  '<p class="muted">Detectaré cada prenda y podrás revisarlas todas antes de guardar. Solo se guardan los recortes de las prendas que elijas; la foto completa no se guarda.</p>'+
  '<div class="actions"><button type="button" class="secondary" id="outfitChange">Cambiar foto</button><button type="button" class="primary" id="outfitAnalyze">'+(d.error?'Reintentar':'Analizar prendas')+' · 1 análisis</button></div>';
 else body='<p class="muted">Revisa cada prenda. Si ya está en tu armario, elígela; si es nueva, se guarda con su recorte de la foto y luego puedes cambiarlo por una foto de la prenda extendida.</p>'+
  '<div class="outfit-items">'+d.items.map((it,i)=>'<div class="outfit-item"><img src="'+it.crop+'" alt=""><div class="outfit-item-body"><strong>'+fx(it.name||it.category)+'</strong><span class="muted">'+fx(it.category+(it.color?" · "+it.color:""))+'</span>'+
   (it.choice==="new"?'<span class="badge-draft">Foto provisional</span>':'')+'<select data-outfit-choice="'+i+'" aria-label="'+fx("Qué hago con «"+(it.name||it.category)+"»")+'">'+optionList([...it.matches.map(g=>[g.id,"Es mi «"+g.name+"»"]),["new","Prenda nueva"],["skip","No guardar"]],it.choice)+'</select></div></div>').join("")+'</div>'+
  '<label class="field"><span>Nombre del look</span><input id="outfitName" maxlength="80" placeholder="Mi look" value="'+fx(d.name)+'"></label>'+
  '<label class="switch-line"><input type="checkbox" id="outfitWear"'+(d.wear?' checked':'')+'> Registrar que me lo he puesto hoy</label>'+
  '<p class="helper">Los recortes de las prendas nuevas se sincronizan entre tus dispositivos, como el resto de fotos.</p>'+
  '<p class="helper" id="outfitWarn"></p><button type="button" class="primary wide" id="outfitSave">Guardar</button>';
 const {el,close}=showSheet("outfitSheet",'<div class="section-head"><h2 id="outfitSheetTitle">Guardar el look que llevo</h2><button type="button" class="secondary" data-close-sheet>Cerrar</button></div>'+
  '<div class="outfit-review-layout"><div class="outfit-review-photo"><img class="outfit-photo" src="'+d.image+'" alt="Foto del look"><p class="outfit-photo-caption">Foto original · no se guarda</p></div><div class="outfit-review-content">'+body+'</div></div>',()=>{if(outfitDraft===d)outfitDraft=null});
 $("#outfitAnalyze",el)?.addEventListener("click",analyzeOutfit);
 $("#outfitCancel",el)?.addEventListener("click",()=>{outfitDraft={token:{},image:d.image,preview:true};renderOutfitSheet()});
 $("#outfitChange",el)?.addEventListener("click",()=>{close();pickOutfitPhoto()});
 if(!d.items)return;
 const warn=()=>{const sel=outfitSelection(d),w=$("#outfitWarn",el);if(w)w.textContent=!sel.length?"Elige al menos una prenda.":lookComplete(sel)?"Se guardará el look con "+plural(sel.length,"prenda","prendas")+".":BASE_MSG+": se guardarán las prendas, pero no el look."};
 $$("[data-outfit-choice]",el).forEach(x=>x.addEventListener("change",()=>{d.name=$("#outfitName",el).value;d.wear=$("#outfitWear",el).checked;d.items[Number(x.dataset.outfitChoice)].choice=x.value;renderOutfitSheet()}));warn();
 $("#outfitSave",el)?.addEventListener("click",async e=>{
  const btn=e.currentTarget;if(d.saving)return;d.saving=true;btn.disabled=true; // sin doble guardado
  d.name=$("#outfitName",el).value.trim();d.wear=$("#outfitWear",el).checked;
  const now=new Date().toISOString(),ids=[],news=[];
  for(const it of d.items){
   if(it.choice==="skip")continue;
   if(it.choice!=="new"){if(myGarments().some(g=>g.id===it.choice))ids.push(it.choice);continue}
   const id=uid();ids.push(id);
   news.push({...cleanAnalysis(it),id,name:it.name||it.garmentType||it.category,category:it.category,type:it.garmentType||"",color:it.color||"",style:it.style||"",season:it.season||"all",notes:"",favorite:false,createdAt:now,updatedAt:now,image:it.crop,imageAt:now,bgWhite:false,photoDraft:1});
  }
  const unique=[...new Set(ids)];if(!unique.length){d.saving=false;btn.disabled=false;return toast("Elige al menos una prenda")}
  const all=unique.map(id=>news.find(g=>g.id===id)||myGarments().find(g=>g.id===id)),complete=lookComplete(all),lookId=uid(),today=dayISO();
  const ok=await mutate(()=>{
   myGarments().unshift(...news);
   if(complete)myLooks().unshift({id:lookId,name:d.name||"Mi look",garmentIds:unique,occasion:appState.data.preferences.occasion||"daily",favorite:false,ai:false,fromPhoto:true,updatedAt:now});
   if(d.wear&&!logs().some(l=>l.date===today&&lookSig(l.garmentIds||[])===lookSig(unique)))logs().unshift({id:uid(),date:today,garmentIds:unique,lookId:complete?lookId:null,updatedAt:now});
  });
  if(!ok){d.saving=false;btn.disabled=false;return}
  outfitDraft=null;close();
  const parts=[news.length?plural(news.length,"prenda nueva","prendas nuevas"):"",complete?"el look":"",d.wear?"el uso de hoy":""].filter(Boolean);
  toast("Guardado: "+parts.join(", ").replace(/, ([^,]*)$/," y $1"));
 });
}

/* Disponibilidad mínima: existencia de base completa, no compatibilidad subjetiva
   de colores. Nunca esconder el acceso a fotografía de look. */
function stylistReady(){
 return lookComplete(myGarments());
}
function stylistMissingText(){
 const cats=new Set(myGarments().map(g=>g.category));
 if(cats.has("Arriba")&&!cats.has("Abajo"))return "Añade una parte de abajo o fotografía el look que llevas.";
 if(cats.has("Abajo")&&!cats.has("Arriba"))return "Añade una parte de arriba o fotografía el look que llevas.";
 return "Añade varias prendas combinables: partes de arriba y de abajo (o vestidos), calzado y alguna capa. También puedes fotografiar tu look.";
}
function stylistLocked(root){
 const saved=myLooks().length;
 stylistShell(root,"Tu estilista","Completa tu armario para empezar a crear combinaciones.",
 '<section class="stylist-locked" aria-labelledby="stylistLockedTitle">'+
 '<h2 id="stylistLockedTitle">Tu estilista estará listo pronto</h2>'+
 '<p>'+fx(stylistMissingText())+'</p>'+
 '<button type="button" class="primary" data-outfit-photo>Hacer foto de mi look</button>'+
 '<button type="button" class="secondary" id="stylistAddGarment">Añadir una prenda</button>'+
 (saved?'<button type="button" class="link-button" id="stylistSavedLooks">Ver looks guardados ('+saved+')</button>':'')+
 '</section>');
 bindOutfitPhoto(root);
 $("#stylistAddGarment")?.addEventListener("click",()=>openGarment());
 $("#stylistSavedLooks")?.addEventListener("click",()=>setView("looks"));
}
/* ===================== 7. Estilista ===================== */
const STYLIST_TABS=[["explore","Explorar"],["week","Mi semana"],["around","Combinar"],["looks","Mis looks",' id="openLooks"']];
function stylistShell(root,title,subtitle,body){
 root.innerHTML=heroHtml(title,subtitle)+((appState.view==="stylist"||appState.view==="looks")?tabsHtml("stylist",STYLIST_TABS,appState.view==="looks"?"looks":ui.stylistTab):"")+body;
 $$("[data-stylist-tab]",root).forEach(b=>b.addEventListener("click",()=>{const t=b.dataset.stylistTab;if(t==="looks")return setView("looks");ui.stylistTab=t;setView("stylist")}));
}
function renderStylist(root){
 if(ui.stylistTab==="today"||ui.stylistTab==="trips"||ui.stylistTab==="looks")ui.stylistTab="explore";
 if(!stylistReady())return stylistLocked(root);
 if(ui.stylistTab==="around")return renderAround(root);
 if(ui.stylistTab==="explore")return renderExplore(root);
 return renderWeek(root);
}
function renderToday(root){
 stylistShell(root,"Hoy",capFirst(new Intl.DateTimeFormat("es-ES",{weekday:"long",day:"numeric",month:"long"}).format(new Date())),dailyLookHtml()+plannedTodayHtml());
 bindDailyLook(root);
 bindPlanActions(root);
 $$("[data-open-week]",root).forEach(b=>b.addEventListener("click",()=>{ui.stylistTab="week";setView("stylist")}));
}
/* Los looks ya no se piden a la IA (decisión de Noelia, 10/10/2026): todos salen del motor. La IA queda solo para leer las fotos. */
/* Tus gustos: rasgos de los looks que te gustan (👍 o ♥) y de los que no (👎), calculado en el móvil, sin IA.
   Cada look se describe con rasgos (monocromático, con estampados, con color, vestido, estilo…) y se compara
   cuántas veces gusta un rasgo con lo que gustan los looks en general. Solo se muestra con datos suficientes. */
const TASTE_LABELS={mono:"looks monocromáticos (un solo color)",neutral:"looks solo en neutros",color:"looks con color",multicolor:"looks con varios colores",pattern:"looks con estampados",plain:"looks lisos, sin estampados",dress:"looks con vestido o mono",layer:"looks con una capa encima",denim:"looks con doble vaquero",vividmono:"looks tono sobre tono en color vivo"};
function lookTraits(l,resolved){
 const gs=resolved||(()=>{const byId=new Map(myGarments().map(g=>[g.id,g]));return (l.garmentIds||[]).map(id=>byId.get(id)).filter(Boolean)})(),t=new Set();
 const main=gs.filter(g=>["Arriba","Abajo","Vestidos","Capas"].includes(g.category));
 const tones=main.map(g=>{const c=colorInfo(g.color,g.pattern);return c.fam==="neutro"?"n:"+c.word.replace(/a$/,"o"):c.fam}).filter(Boolean);
 const fams=new Set(main.map(g=>colorInfo(g.color,g.pattern).fam).filter(f=>f&&f!=="neutro"&&f!=="estampado"));
 if(tones.length>=2&&new Set(tones).size===1)t.add("mono");
 if(t.has("mono")&&!tones[0].startsWith("n:"))t.add("vividmono"); // tono sobre tono en color vivo: gusto distinto de «todo negro» (revisión de ChatGPT, #139)
 if(tones.length>=2&&tones.every(x=>x.startsWith("n:"))&&!t.has("mono"))t.add("neutral");
 if(fams.size>=1)t.add("color");if(fams.size>=2)t.add("multicolor");
 for(const f of fams)t.add("fam:"+f);
 if(gs.some(g=>(g.pattern&&g.pattern!=="plain")||colorInfo(g.color).fam==="estampado"))t.add("pattern");else if(gs.length)t.add("plain");
 if(gs.some(g=>g.category==="Vestidos"))t.add("dress");if(gs.some(g=>g.category==="Capas"))t.add("layer");
 if(main.filter(isDenimPiece).length>=2)t.add("denim");
 const st=gs.map(g=>g.style).filter(Boolean),top=st.sort((a,b)=>st.filter(x=>x===b).length-st.filter(x=>x===a).length)[0];
 if(top&&st.filter(x=>x===top).length*2>st.length)t.add("style:"+top);
 return t;
}
const tasteLabel=k=>TASTE_LABELS[k]||(k.startsWith("fam:")?"looks con "+k.slice(4):k.startsWith("style:")?"looks de estilo "+(styleNames[k.slice(6)]||k.slice(6)):k);
const DISLIKE_WHY={color:"Colores",formal:"Muy arreglado",informal:"Muy informal",hoy:"Hoy no"};
/* «Casi» (cata n.º 4): una prenda del look no cuadra. Se guarda en feedback (se fusiona por clave entre dispositivos):
   g:<prenda> = no me gusta la prenda · o:<prenda>|<ocasión> = no es para esa ocasión o sobra · p:<a>|<b> = no pegan juntas */
const ALMOST_WHY=[["pega","No pega con el resto"],["color","El color"],["ocasion","No es para esta ocasión"],["sobra","Sobra"],["prenda","No me gusta la prenda"]];
const pairKey=(a,b)=>a<b?a+"|"+b:b+"|"+a;
function pieceNotes(){const fb=appState.data.feedback||{},n={disliked:new Set(),offOcc:new Set(),pairs:new Set()};
 for(const [k,v] of Object.entries(fb)){if(!v)continue;if(k.startsWith("g:"))n.disliked.add(k.slice(2));else if(k.startsWith("o:"))n.offOcc.add(k.slice(2));else if(k.startsWith("p:"))n.pairs.add(k.slice(2))}
 return n}
function saveAlmost(gsLook,offIds,why,occasion){
 const fb=appState.data.feedback,w=new Set(why),off=new Set(offIds);
 for(const id of off){
  if(w.has("prenda"))fb["g:"+id]="no";
  if((w.has("ocasion")||w.has("sobra"))&&occasion)fb["o:"+id+"|"+occasion]="no";
  if(w.has("pega")||w.has("color")||!w.size)for(const g of gsLook)if(g.id!==id&&relatedCats(g,{category:myGarments().find(x=>x.id===id)?.category}))fb["p:"+pairKey(id,g.id)]="no"; /* también entre dos prendas marcadas (revisión de Codex, #169) */
 }
}
/* ¿Guardaría algo? Una sola prenda con «no pega» no tiene pareja que aprender */
const almostLearns=(gsLook,offIds,why)=>{const w=new Set(why);return offIds.length>0&&(w.has("prenda")||w.has("ocasion")||w.has("sobra")||gsLook.length>1)};
const COLOR_TRAIT=/^(mono|neutral|color|multicolor|fam:)/;
/* Sesgo de formalidad aprendido de los 👎 con motivo: >0 prefiere más informal, <0 más arreglado (−1…1) */
function formalityBias(){const fb=appState.data.feedback||{},ls=myLooks().filter(l=>fb[l.id]==="down"&&(l.dislikeReason==="formal"||l.dislikeReason==="informal")) /* solo 👎 vigentes (revisión de Codex, #143) */,f=ls.filter(l=>l.dislikeReason==="formal").length;return ls.length?(f-(ls.length-f))/Math.max(3,ls.length):0}
function tasteProfile(){
 const fb=appState.data.feedback||{},looks=myLooks().filter(l=>(l.garmentIds||[]).length>=2);
 // Motivo del 👎 (#136 §22): «hoy» no enseña nada; «color» solo cuenta para rasgos de color; «formal»/«informal» solo para el estilo
 const vote=l=>fb[l.id]==="down"?(l.dislikeReason==="hoy"?0:-1):fb[l.id]==="up"||l.favorite?1:0;
 const counts=(l,k)=>!(fb[l.id]==="down"&&l.dislikeReason)||(l.dislikeReason==="color"?COLOR_TRAIT.test(k):k.startsWith("style:"));
 const N=looks.length,U=looks.filter(l=>vote(l)>0).length,D=looks.filter(l=>vote(l)<0).length,stats=new Map();
 const byId=new Map(myGarments().map(g=>[g.id,g]));
 for(const l of looks){const v=vote(l);for(const k of lookTraits(l,(l.garmentIds||[]).map(id=>byId.get(id)).filter(Boolean))){if(v<0&&!counts(l,k))continue;const s=stats.get(k)||{n:0,u:0,d:0};s.n++;if(v>0)s.u++;if(v<0)s.d++;stats.set(k,s)} /* un 👎 por otro motivo no es muestra de este rasgo (revisión de Codex, #143) */}
 const enough=N>=5&&U+D>=4,likes=[],dislikes=[];
 if(enough)for(const [k,s] of stats){
  const lift=s.u/s.n-U/N,drop=s.d/s.n-D/N;
  if(s.u>=3&&lift>=.2)likes.push({k,s,w:lift});
  else if((s.d>=2&&drop>=.2)||(s.n>=4&&s.u===0&&U>=3))dislikes.push({k,s,w:Math.max(drop,U/N)});
 }
 const top=a=>a.sort((x,y)=>y.w-x.w).slice(0,3);
 return {enough,N,U,D,likes:top(likes),dislikes:top(dislikes)};
}
function tasteCardHtml(){
 const t=tasteProfile();
 const line=(x,good)=>'<li>'+fx(tasteLabel(x.k))+' <span class="muted">('+(good?x.s.u+' de '+x.s.n+' te gustan':x.s.d?x.s.d+' de '+x.s.n+' no te gustan':'0 de '+x.s.n+' con 👍')+')</span></li>';
 const body=!t.enough?'<p class="muted">Da 👍 o 👎 a unos cuantos looks (o márcalos con ♥) y aquí verás hacia dónde tienden tus gustos.</p>'
  :!t.likes.length&&!t.dislikes.length?'<p class="muted">Todavía no se ve una tendencia clara en tus valoraciones.</p>'
  :(t.likes.length?'<p><strong>Te suelen gustar</strong></p><ul class="taste-list">'+t.likes.map(x=>line(x,true)).join("")+'</ul>':'')+
   (t.dislikes.length?'<p><strong>Te gustan menos</strong></p><ul class="taste-list">'+t.dislikes.map(x=>line(x,false)).join("")+'</ul>':'');
 return '<details class="feature-card taste-card"'+(t.enough?' open':'')+'><summary><strong>Tus gustos</strong> <span class="muted">· según '+plural(t.U+t.D,"valoración","valoraciones")+'</span></summary>'+body+'<p class="helper">Se calcula en tu móvil con tus 👍, 👎 y favoritos; sin IA.</p></details>';
}
/* Cambiar una prenda de un look: alternativas de la misma categoría que combinan con el resto del look,
   ordenadas en el móvil (sin IA) por color, estilo, temporada, favoritas, prendas olvidadas y tus gustos. */
const SWAP_NAMES={Arriba:"parte de arriba",Abajo:"parte de abajo",Vestidos:"vestido",Capas:"capa",Zapatos:"zapatos",Bolsos:"bolso",Accesorios:"accesorio"};
const lookSig=ids=>ids.slice().sort().join("|");
function swapOptions(l,oldId,max=6){
 const byId=new Map(myGarments().map(g=>[g.id,g])),gs=(l.garmentIds||[]).map(id=>byId.get(id)).filter(Boolean),old=byId.get(oldId);
 if(!old)return [];
 // Motor común: misma categoría, compatible con el resto y puntuado como look completo (fecha del plan si la hay)
 const rest=gs.filter(g=>g.id!==oldId),fb=appState.data.feedback||{},saved=new Map(myLooks().map(x=>[lookSig(x.garmentIds||[]),x]));
 const ctx=engineContext({occasion:l.occasion in occasions?l.occasion:null,date:validDay(l.date)?l.date:undefined}); // con la ocasión del look (revisión de Codex, #133)
 ensureRelations();const before=new Set(lookIssues(gs,ctx).filter(x=>!x.startsWith((old.name||old.type||old.category)+":"))),notes=pieceNotes(),weakest=g=>Math.min(1,...rest.map(r=>relationOf(g,r,ctx)?.s??1));
 /* cerebro de estilista también aquí (revisión general): la nueva prenda combina con todas, cumple tiempo y ocasión y respeta lo marcado con «Casi» */
 const ok=g=>rest.every(r=>(!related(g,r)||stylesOk(g,r))&&(pairColor(g,r).s>=.45||!BIG.includes(g.category)||!BIG.includes(r.category)))&&!notes.disliked.has(g.id)&&!ctx.offOcc.has(g.id)&&lookIssues([...rest,g],ctx).every(x=>before.has(x)); /* ningún problema nuevo, tampoco de todo el look (revisión de Codex, #180) */
 const pool=myGarments().filter(g=>g.id!==oldId&&g.category===old.category&&!rest.some(r=>r.id===g.id)&&ok(g)),good=pool.filter(g=>weakest(g)>=REL_OK);
 return (good.length>=2?good:pool.filter(g=>weakest(g)>=REL_WEAK)).map(g=>{
  const look=[...rest,g],ids=look.map(x=>x.id),ex=saved.get(lookSig(ids)),r=scoreOutfit(look,ctx),why=[...r.reasons];
  if(g.favorite)why.push("Es de tus favoritas");
  return {g,ids,sc:r.score-(notInSeason(g)?15:0),why:[...new Set(why)].slice(0,2),exists:ex||null,disliked:!!ex&&fb[ex.id]==="down"};
 }).filter(o=>!o.disliked).sort((a,b)=>b.sc-a.sc).slice(0,max);
}
let swapState=null;
function openSwap(lookId,kind="look"){swapState={lookId,kind,garmentId:null};renderSwap();$("#swapSheet")?.classList.remove("hidden");$("#swapSheet [data-swap-pick]")?.focus()}
function closeSwap(){swapState=null;$("#swapSheet")?.classList.add("hidden")}
function renderSwap(){
 let el=$("#swapSheet");
 if(!el){document.body.insertAdjacentHTML("beforeend",'<div id="swapSheet" class="overlay hidden"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="swapTitle"><div id="swapBody"></div></section></div>');el=$("#swapSheet");
  el.addEventListener("click",e=>{if(e.target===el)closeSwap()});el.addEventListener("keydown",e=>{if(e.key==="Escape")closeSwap()})}
 const isPlan=swapState?.kind==="plan",l=(isPlan?myPlans():myLooks()).find(x=>x.id===swapState?.lookId);if(!l)return closeSwap();
 const gs=(l.garmentIds||[]).map(id=>myGarments().find(g=>g.id===id)).filter(Boolean),cur=gs.find(g=>g.id===swapState.garmentId);
 const opts=cur?swapOptions(l,cur.id):[];
 $("#swapBody").innerHTML='<div class="section-head"><h2 id="swapTitle">Cambiar una prenda</h2><button type="button" class="secondary" id="closeSwap">Cerrar</button></div>'+
  '<p class="muted">'+fx(l.name)+'. El resto del look se queda igual.</p>'+outfitBoard(gs)+
  '<div class="swap-picks" role="group" aria-label="Prenda que quieres cambiar">'+gs.map(g=>'<button type="button" class="chip-button'+(cur?.id===g.id?' on':'')+'" data-swap-pick="'+fx(g.id)+'" aria-pressed="'+(cur?.id===g.id)+'">Cambiar '+fx(SWAP_NAMES[g.category]||g.name)+'</button>').join("")+'</div>'+
  (!cur?'<p class="helper">Elige qué prenda quieres cambiar.</p>'
   :opts.length?'<div class="swap-list">'+opts.map((o,i)=>'<div class="swap-option"><div class="thumb"'+(validImage(o.g.image)?' style="background-image:url('+photoUrl(o.g)+')"':'')+'></div><div class="swap-text"><strong>'+fx(o.g.name)+'</strong>'+o.why.map(w=>'<span class="muted">'+fx(w)+'</span>').join("")+(o.exists&&!isPlan?'<span class="muted">Ya tienes este look guardado</span>':'')+'</div><div class="swap-actions">'+
     (isPlan?'<button type="button" class="primary" data-swap-use="'+i+'" data-swap-mode="plan">Usar este día</button>':o.exists?'':'<button type="button" class="primary" data-swap-use="'+i+'" data-swap-mode="new">Guardar como look nuevo</button><button type="button" class="secondary" data-swap-use="'+i+'" data-swap-mode="replace">Cambiar en este look</button>')+'</div></div>').join("")+'</div>'
   :'<p class="muted">No tienes otra prenda de '+fx(SWAP_NAMES[cur.category]||"esta categoría")+' que combine con el resto del look. Mira «Recomendaciones» en Compras.</p>');
 $("#closeSwap").addEventListener("click",closeSwap);
 $$("[data-swap-pick]",el).forEach(b=>b.addEventListener("click",()=>{swapState.garmentId=b.dataset.swapPick;renderSwap();$('#swapSheet [data-swap-pick][aria-pressed="true"]')?.focus()}));
 $$("[data-swap-use]",el).forEach(b=>b.addEventListener("click",()=>applySwap(l,opts[Number(b.dataset.swapUse)],b.dataset.swapMode)));
}
async function applySwap(l,o,mode){
 if(!o)return;const now=new Date().toISOString();
 // En un día planificado solo cambia ese plan (es una copia): el look guardado no se toca
 if(mode==="plan"){const ok=await mutate(()=>{l.garmentIds=o.ids;l.updatedAt=now},"Prenda cambiada para el "+fmtDay(l.date));if(ok)closeSwap();return}
 // «Cambiar en este look» crea el look con un id nuevo y borra el anterior (tomb): así sus 👍/👎 no pasan a otra combinación
 const nl={...l,id:uid(),garmentIds:o.ids,ai:false,updatedAt:now};
 if(mode==="new"){nl.name=(l.name+" · con "+o.g.name).slice(0,80);nl.favorite=false}
 const ok=await mutate(()=>{const looks=myLooks();if(mode==="replace"){const i=looks.findIndex(x=>x.id===l.id);if(i>=0){looks.splice(i,1,nl);tomb(l.id)}}else looks.unshift(nl)},mode==="new"?"Look nuevo guardado":"Look actualizado");
 if(ok)closeSwap();
}
function renderLooks(root){
 if(!stylistReady()&&!myLooks().length)return stylistLocked(root);
 let looks=myLooks();
 if(ui.lookFilter==="favorites")looks=looks.filter(l=>l.favorite);
 if(ui.lookFilter==="ai")looks=looks.filter(l=>l.ai);
 const fb=appState.data.feedback;
 stylistShell(root,"Mis looks","Tus combinaciones guardadas: las que creas tú y las que guardas del estilista.",
  '<div class="section-head"><h2>Conjuntos ('+looks.length+')</h2><span class="head-actions"><button class="secondary" data-inspo-photo aria-label="Recrear con mi armario un look que me inspira">✨ Inspiración</button><button class="secondary" data-outfit-photo aria-label="Guardar el look que llevo con una foto">📸 Foto</button><button class="primary" id="newLook">+ Crear</button></span></div>'+
  '<div class="filter-tabs">'+[["all","Todos"],["favorites","Favoritos ♡"],...(myLooks().some(l=>l.ai)?[["ai","Sugeridos por IA"]]:[])].map(([k,t])=>'<button class="chip-button'+(ui.lookFilter===k?' on':'')+'" data-look-filter="'+k+'">'+t+'</button>').join("")+'</div>'+
  '<details class="looks-tools"><summary>Más opciones para mis looks</summary><div class="looks-tools-body">'+tasteCardHtml()+'</div></details>'+
  (looks.length?'<div class="grid">'+looks.map(l=>'<div class="look-tile">'+lookCard(l)+(()=>{const m=(l.garmentIds||[]).map(id=>myGarments().find(g=>g.id===id)).filter(Boolean),k="look:"+l.id,c=engineContext({occasion:l.occasion||null}),pk=pickedLook(k,m,c);
    return versionsRow(k,m,c)+(pk!==m?'<div class="version-preview">'+outfitBoard(pk)+'<button class="chip-button" data-save-version="'+fx(l.id)+'">♡ Guardar esta versión</button></div>':'')})()+
   '<details class="look-secondary-actions"><summary>Más acciones del look</summary><div class="tile-tools"><button class="chip-button" data-look-fav="'+fx(l.id)+'" aria-label="'+(l.favorite?'Quitar de favoritos':'Añadir a favoritos')+'" aria-pressed="'+!!l.favorite+'">'+(l.favorite?'♥':'♡')+'</button><button class="chip-button" data-look-wear="'+fx(l.id)+'">✓ Llevado</button><button class="chip-button" data-look-edit="'+fx(l.id)+'">✎ Editar</button></div></details>'+
   '<div class="look-votes"><button class="chip-button'+(fb[l.id]==="up"?' on':'')+'" data-feedback="'+fx(l.id)+'" data-vote="up" aria-label="Me gusta" aria-pressed="'+(fb[l.id]==="up")+'">👍</button><button class="chip-button'+(fb[l.id]==="down"?' on':'')+'" data-feedback="'+fx(l.id)+'" data-vote="down" aria-label="No me gusta" aria-pressed="'+(fb[l.id]==="down")+'">👎</button><button class="chip-button" data-look-almost="'+fx(l.id)+'" aria-label="Casi: algo no me cuadra">Casi</button></div>'+
   (fb[l.id]==="down"?'<div class="dislike-why" role="group" aria-label="Por qué no te gusta (opcional)"><span>¿Por qué?</span>'+Object.entries(DISLIKE_WHY).map(([k,t])=>'<button class="chip-button small'+(l.dislikeReason===k?' on':'')+'" data-why="'+fx(l.id)+'" data-reason="'+k+'" aria-pressed="'+(l.dislikeReason===k)+'">'+t+'</button>').join("")+'</div>':'')+ 
   '<div class="tile-hints">'+(l.edited?"Tuyo":l.ai?"IA":"Manual")+(lookComplete((l.garmentIds||[]).map(id=>myGarments().find(g=>g.id===id)))?'':' · <span title="'+BASE_MSG+'">Incompleto: falta arriba, abajo o vestido</span>')+'</div></div>').join("")+'</div>':'<div class="empty">Todavía no tienes looks para este filtro.</div>'));
 $("#newLook")?.addEventListener("click",()=>openLook());bindOutfitPhoto(root);
 $$("[data-look-filter]",root).forEach(b=>b.addEventListener("click",()=>{ui.lookFilter=b.dataset.lookFilter;render()}));
 $$("[data-look]",root).forEach(b=>b.addEventListener("click",()=>openLook(b.dataset.look)));
 $$("[data-look-fav]",root).forEach(b=>b.addEventListener("click",async()=>{const l=myLooks().find(l=>l.id===b.dataset.lookFav);if(l)await mutate(()=>{l.favorite=!l.favorite;l.updatedAt=new Date().toISOString()},"Look actualizado")}));
 $$("[data-look-edit]",root).forEach(b=>b.addEventListener("click",()=>{const l=myLooks().find(x=>x.id===b.dataset.lookEdit);if(l)openLookEditor(l.garmentIds||[],{lookId:l.id,occasion:l.occasion||null,removed:l.removed})}));
 bindVersions(root);
 $$("[data-save-version]",root).forEach(b=>b.addEventListener("click",async()=>{const l=myLooks().find(x=>x.id===b.dataset.saveVersion);if(!l)return;const k="look:"+l.id,m=(l.garmentIds||[]).map(id=>myGarments().find(g=>g.id===id)).filter(Boolean),c=engineContext({occasion:l.occasion||null}),v=pickedVersion(k,m,c);if(!v)return;
  if(myLooks().some(x=>lookSig(x.garmentIds||[])===lookSig(v.ids)))return toast("Esa versión ya está guardada");
  await mutate(()=>myLooks().unshift({id:uid(),name:(l.name+" · "+v.label.toLowerCase()).slice(0,80),garmentIds:[...v.ids],occasion:l.occasion||appState.data.preferences.occasion||"daily",ai:false,updatedAt:new Date().toISOString()}),"Versión guardada en Mis looks")}));
 $$("[data-look-almost]",root).forEach(b=>b.addEventListener("click",()=>{const l=myLooks().find(x=>x.id===b.dataset.lookAlmost);if(l)openAlmost(l.garmentIds||[],l.occasion||appState.data.preferences.occasion||"daily")}));
 $$("[data-look-wear]",root).forEach(b=>b.addEventListener("click",()=>{const l=myLooks().find(l=>l.id===b.dataset.lookWear);if(l)promptWear(l.garmentIds,l.id)}));
 $$("[data-feedback]",root).forEach(b=>b.addEventListener("click",async()=>{const id=b.dataset.feedback,l=myLooks().find(x=>x.id===id);await mutate(()=>{if(fb[id]===b.dataset.vote)delete fb[id];else fb[id]=b.dataset.vote;if(l&&fb[id]!=="down"&&l.dislikeReason){delete l.dislikeReason;l.updatedAt=new Date().toISOString()}},"Preferencia guardada")}));
 $$("[data-why]",root).forEach(b=>b.addEventListener("click",async()=>{const l=myLooks().find(x=>x.id===b.dataset.why);if(!l)return;await mutate(()=>{if(l.dislikeReason===b.dataset.reason)delete l.dislikeReason;else l.dislikeReason=b.dataset.reason;l.updatedAt=new Date().toISOString()},b.dataset.reason==="hoy"?"Entendido: no lo tendré en cuenta para tus gustos":"Gracias: lo tendré en cuenta")}));
}
/* Complementos en las propuestas: calzado y bolso se pueden quitar (preferencia por perfil).
   En «Estar en casa» y «Playa y piscina» el calzado no se añade nunca. */
const NO_SHOES_OCCASIONS=new Set(["home"]);
function lookExtras(){const occasion=appState.data.preferences.occasion||"daily";return {shoes:!NO_SHOES_OCCASIONS.has(occasion),bag:occasion!=="home"}}
function extrasTogglesHtml(){return ""}
function bindExtrasToggles(){}
/* ===================== Motor de estilismo (un solo motor para Hoy, Mi semana, Combinar prenda y Cambiar prenda) =====================
   Sin IA. Especificación: docs/atelier/STYLING_ENGINE_SPEC.md. Pasos:
   1) contexto (fecha, ocasión, temperatura) → 2) prendas que encajan (ocasión y temporada) → 3) bases (arriba+abajo, vestido,
   baño o ropa de casa) → 4) se completan con calzado, capa según el tiempo, bolso y un complemento → 5) puntuación 0–100
   (color 25 · silueta 25 · estilo 20 · contexto 20 · personal 10) con motivos → 6) selección variada (conjunto completo).
   Los pesos y umbrales son una hipótesis inicial [I] que se ajusta con looks reales. */
/* «¿Cómo quieres vestirte hoy?» (contrato con el selector de la interfaz, #52): preferences.dressStyle ∈ claves de DRESS_TARGET o null.
   Afinidad de cada estilo de prenda con ese objetivo; solo puntúa. */
const DRESS_TARGET={elegante:{party:1,smart:.9,casual:.4,sport:0},arreglada:{smart:1,casual:.7,party:.7,sport:.4},informal:{casual:1,sport:.8,smart:.7,party:.3},deporte:{sport:1,casual:.6,smart:.2,party:0},comoda:{casual:1,sport:.9,smart:.4,party:.1}};
const DRESS_LABEL={elegante:"Elegante",arreglada:"Arreglada",informal:"Informal",deporte:"Deporte",comoda:"Cómoda"};
const SEASON3=m=>m>=5&&m<=8?"warm":m===11||m<=1?"cold":"mid";          // jun–sep cálida, dic–feb fría, resto media
const SEASON_TEMP={warm:27,mid:19,cold:11};                              // para fechas sin tiempo real
function tempFor(date){if(!date||date===dayISO())return currentTemperature();const w=appState.data?.preferences?.weatherWeek?.[date];return Number.isFinite(w)?w:SEASON_TEMP[SEASON3(Number(date.slice(5,7))-1)]} /* previsión de la semana si la hay (Open-Meteo), si no la media de la temporada */
const seasonFits=(g,s)=>!g.season||g.season==="all"||s==="mid"||g.season===s;
/* Perfil de prenda (petición de Noelia, 09/10): el motor decide con las características de la ficha (formalidad,
   manga, grosor, tejido, largo, ocasiones), que rellena el análisis y puede corregir la usuaria. El nombre solo se usa
   cuando falta el dato. */
const textOf=g=>[g.type,g.subtype,g.name,g.details].filter(Boolean).join(" ");
const FORMAL_LEVEL={sport:0,casual:1,smartcasual:2,formal:3,party:3};
const formalLevel=g=>g.formality in FORMAL_LEVEL?FORMAL_LEVEL[g.formality]:({sport:0,casual:1,smart:2,party:3}[g.style]??1);
// Uso deportivo o de montaña (una mochila de trekking, unas zapatillas de running), por formalidad o, si falta, por el nombre
const OUTDOOR=/monta[ñn]a|trekking|hiking|senderismo|running|gimnasio|\bgym\b|camping|north face|quechua/i;
const isOutdoor=g=>g.formality==="sport"||(!g.formality&&(g.style==="sport"||OUTDOOR.test(textOf(g))));
/* Abrigo térmico de 0 (muy fresco) a 6 (muy abrigado), o null si no se sabe: manga o largo + grosor + tejido */
/* Prenda vaquera: la ficha (tejido) manda; sin dato, el color «Vaquero» o el nombre (revisión de Codex, #134) */
const isDenimPiece=g=>g.fabric&&g.fabric!=="unknown"?g.fabric==="denim":g.color==="Vaquero"||/vaquer|denim|chambray|\bjeans?\b/i.test(textOf(g));
/* Prenda de abajo corta: la ficha (largo) manda; sin dato, el nombre («mini», «minifalda», «shorts»…) (prueba de degradación, #128) */
const SHORT_BOTTOM=/\bshorts?\b|bermuda|minifalda|\bmini\b|mini ?skirt|micro ?falda/i;
const isShortBottom=g=>g.category==="Abajo"&&(g.length&&g.length!=="na"?g.length==="cropped":SHORT_BOTTOM.test(textOf(g)));
function thermal(g){
 const txt=textOf(g);let t=null;
 if(["Arriba","Vestidos"].includes(g.category)){
  t={"sin mangas":0,"corta":1,"tres cuartos":2,"larga":3}[g.sleeve]??null;
  if(t===null&&/tirantes|sin mangas|sleeveless|tank|palabra de honor/i.test(txt))t=0;
  if(t===null&&/jersey|su[eé]ter|sweater|sudadera|manga larga|long sleeve|cuello alto|turtleneck/i.test(txt))t=3;
 }else if(g.category==="Abajo"){
  t={cropped:0,regular:2,midi:2,long:3}[g.length]??null;
  if(t===null&&SHORT_BOTTOM.test(txt))t=0;
 }
 if(t===null)return null;
 t+={ligero:0,medio:1,grueso:2}[g.thickness]??(/jersey|su[eé]ter|sweater|punto grueso|chunky/i.test(txt)?2:1);
 if(["wool","knit"].includes(g.fabric)||/lana|wool|cashmere|cachemir/i.test(txt))t+=1;
 if(g.fabric==="linen"||/lino|linen/i.test(txt))t-=1;
 return Math.max(0,t);
}
/* ¿Va con esta temperatura? Manga larga y gruesa no con calor; shorts y minifaldas no con frío */
/* Con frío (<12 °C) nadie se pone un top sin mangas, corto o de hombros al aire, aunque lleve abrigo (Noelia, 09/10).
   Regla dura salvo en fiesta, evento o formal (vestido de noche con abrigo). La ficha manda; sin dato, el nombre. */
const COLD_TOP_TEXT=/tirantes|sin mangas|sleeveless|\btank\b|palabra de honor|strapless|halter|off.?shoulder|hombros al aire|bandeau|bustier|cors[eé]/i;
function coldExposed(g,temp,occ){
 if(!Number.isFinite(temp)||temp>=12||!["Arriba","Vestidos"].includes(g.category))return false;
 if(g.category==="Vestidos"&&["party","event","formal"].includes(occ))return false; // vestido de noche con abrigo, sí; un top suelto, no (revisión de Codex, #157)
 const txt=textOf(g),sleeveless=g.sleeve&&g.sleeve!=="no aplica"?g.sleeve==="sin mangas":COLD_TOP_TEXT.test(txt);
 return sleeveless||g.category==="Arriba"&&(g.length&&g.length!=="na"?g.length==="cropped":/\bcrop/i.test(txt))||/off.?shoulder|hombros al aire/i.test(txt);
}
/* Prenda de arriba sin manga indicada y con nombre genérico («Top», «Body»): con frío no se sabe si abriga; se evita si hay otras */
const uncertainColdTop=(g,temp)=>temp<12&&g.category==="Arriba"&&!(g.sleeve&&g.sleeve!=="no aplica")&&/\btop\b|\bbody\b|camiseta de tirantes/i.test(textOf(g));
function thermalOk(g,temp){
 const t=thermal(g);if(t===null)return true;
 if(["Arriba","Vestidos"].includes(g.category))return !(temp>=24&&t>=5)&&!(temp>=28&&t>=4);
 if(g.category==="Abajo")return !(temp<14&&t<=1)&&!(temp>=28&&t>=5);
 return true;
}
/* Aislamiento térmico (clo) por prenda, aproximado a las tablas ISO 9920 / ASHRAE 55 (camiseta 0,08; camisa larga 0,25;
   pantalón 0,15–0,24; abrigo 0,36–0,48). Usa manga, largo, grosor y tejido de la ficha; sin datos, el tipo o el nombre. */
function cloOf(g){
 const txt=textOf(g),fab=g.fabric||"";
 const th=({ligero:-1,medio:0,grueso:1}[g.thickness]??(/grueso|chunky|borrego|sherpa|forrad|acolchad/i.test(txt)?1:/\bfin[oa]\b|liger|gasa|chiffon/i.test(txt)?-1:0)) // el tejido se suma siempre (revisión de Codex, #127)
  +(["wool"].includes(fab)||/\blana\b|wool|cashmere|cachemir/i.test(txt)?.5:0)-(fab==="linen"||/\blino\b|linen/i.test(txt)?.5:0);
 const w=(lo,mid,hi)=>th<0?mid+(lo-mid)*Math.min(1,-th):mid+(hi-mid)*Math.min(1,th);
 const SLEEVELESS=/tirantes|sin mangas|sleeveless|\btank\b|palabra de honor|strapless|halter/i;
 if(g.category==="Arriba"){
  const s=g.sleeve&&g.sleeve!=="no aplica"?g.sleeve:SLEEVELESS.test(txt)?"sin mangas":/jersey|su[eé]ter|sweater|sudadera|hoodie|manga larga|long sleeve|cuello alto|turtleneck|camisa|blusa|shirt/i.test(txt)?"larga":"corta";
  const knit=fab==="knit"||/jersey|su[eé]ter|sweater|sudadera|hoodie|c[aá]rdigan|punto/i.test(txt);
  return s==="sin mangas"?w(.05,.08,.12):s==="corta"?w(.08,.14,.19):s==="tres cuartos"?w(.17,.21,.26):knit?w(.25,.3,.37):w(.2,.25,.34);
 }
 if(g.category==="Abajo"){
  if(g.length&&g.length!=="na"?g.length==="cropped":SHORT_BOTTOM.test(txt))return .07;
  if(/falda|skirt/i.test(txt))return g.length==="long"||/larga|maxi/i.test(txt)?w(.17,.22,.28):g.length==="midi"||/midi/i.test(txt)?w(.14,.18,.23):w(.11,.14,.2);
  return w(.15,.2,.25)+(fab==="denim"||/vaquer|jean/i.test(txt)?.02:0);
 }
 if(g.category==="Vestidos"){
  const s=g.sleeve&&g.sleeve!=="no aplica"?g.sleeve:SLEEVELESS.test(txt)?"sin mangas":/manga larga|long sleeve/i.test(txt)?"larga":"corta";
  const base={"sin mangas":.2,"corta":.26,"tres cuartos":.3,"larga":.33}[s]??.26;
  return Math.max(.12,w(base-.06,base,base+.12)+(g.length==="long"||/largo|maxi|\blong\b/i.test(txt)?.05:g.length==="cropped"||/corto|mini/i.test(txt)?-.04:0)+(/\bmono\b|jumpsuit/i.test(txt)?.03:0));
 }
 if(g.category==="Capas"){
  if(/chaleco|\bvest\b|gilet/i.test(txt))return w(.1,.13,.2);
  if(/plum[ií]fero|plumas|puffer|\bdown\b|parka/i.test(txt))return w(.5,.6,.7);
  if(/gabardina|trench|chubasquero|impermeable|cortavientos/i.test(txt))return w(.3,.36,.42);
  if(/abrigo|\bcoat\b|trenca|pea ?coat/i.test(txt))return w(.38,.46,.55);
  if(/c[aá]rdigan|cardigan|rebeca|kimono|sobrecamisa|overshirt/i.test(txt))return w(.18,.24,.32);
  if(/blazer|americana|chaqueta|jacket|cazadora|bomber|cuero|leather|vaquera|denim/i.test(txt))return w(.25,.32,.4);
  return {bajo:.24,medio:.34,alto:.5}[g.warmth]??w(.25,.33,.45);
 }
 if(g.category==="Zapatos")return /sandal|chancl|flip.?flop|alpargat|slides?/i.test(txt)?.01:/bot[ií]n|botines|ankle boot/i.test(txt)?.06:/\bbotas?\b|\bboots?\b/i.test(txt)?.1:.03;
 if(g.category==="Accesorios")return /bufanda|scarf|fular|pashmina|foulard/i.test(txt)?.05:/gorro|beanie/i.test(txt)?.03:/guantes|gloves/i.test(txt)?.02:0;
 return 0;
}
/* Un complemento con un color nuevo cuando el look ya tiene tres colores: mejor otro que repita un color o sea neutro */
const newColorOverflow=(x,l,ctx)=>{const k=colorKey(x),pal=paletteOf(l);return !!k&&!pal.has(k)&&pal.size>=(ctx?.likes?.has("multicolor")?4:3)}; // gusto multicolor: hasta cuatro (revisión de Codex, #157)
/* Abrigo del look completo (suma de prendas + ropa interior, ISO 9920) y lo que pide la temperatura exterior:
   1,35 clo a 5 °C → 0,3 clo a 28 °C (calibrado con looks de calle típicos: abrigo+jersey+pantalón+botas ≈ 1,1–1,2 a 8 °C;
   camisa+vaqueros+chaqueta ≈ 0,85 a 17 °C; camiseta+shorts ≈ 0,2–0,3 a 28 °C) */
const outfitClo=gs=>.04+gs.reduce((t,g)=>t+cloOf(g),0);
const cloTarget=temp=>Math.max(.3,Math.min(1.6,1.35-(temp-5)*.045));
/* Ocasión: si la prenda tiene ocasiones, manda eso; si no, su estilo. Casa y Baño solo en su ocasión. */
/* Trabajo y eventos: fuera shorts, chanclas, sandalias planas, zuecos, gorras y gorros (evaluación visual #99) */
const WORK_NO=/\bshorts?\b|chancl|sandalia|zueco|gorra|gorro|beanie|crop top|ch[aá]ndal|mallas|pantal[oó]n deportivo|camiseta t[eé]cnica|\brot[oa]s?\b|lavad[oa]s? (al )?[aá]cido|desgastad|deshilachad|distress|ripped|acid.?wash|destroyed|sudadera|hoodie|sweatshirt|bustier|cors[eé]|corset/i; // rotos o lavado ácido: no para el trabajo (evaluación Polyvore)
/* Código de vestir del trabajo (Ajustes, por perfil): «arreglado» (por defecto), «formal» (traje, entrevista) o «informal» (oficina creativa).
   Es una convención, no una norma universal (auditoría de reglas, #128 y #136 §6 y §33). */
const WORK_DRESS={arreglado:"Arreglado",formal:"Formal (traje, entrevista)",informal:"Informal (oficina creativa)"};
const workDress=()=>WORK_DRESS[appState?.data?.preferences?.workDress]?appState.data.preferences.workDress:"arreglado";
const WORK_NO_INFORMAL=new RegExp(WORK_NO.source.replace(/\|sudadera\|hoodie\|sweatshirt/,""),"i"); // en oficina informal, sudaderas sí
const OCC_STYLES={daily:["casual","smart","sport"],work:["smart","casual"],sport:["sport"],beach:["casual","sport"],home:null,event:["smart","party"],party:["party","smart"],formal:["smart","party"]};
function occasionFits(g,occ){
 if(!occ)return !["Casa","Baño"].includes(g.category);
 if(g.category==="Casa")return occ==="home";
 if(g.category==="Baño")return occ==="beach";
 if(occ==="home")return ["Zapatos"].includes(g.category)?/casa|zapatilla/i.test(g.type||g.name||""):false;
 const occs=Array.isArray(g.occasions)?g.occasions.filter(o=>o in occasions):[];
 if(occs.includes(occ))return true; // lo que indica la ficha (análisis o la usuaria) manda sobre el nombre
 const formal=formalLevel(g),wd=workDress();
 if(occ==="work"&&wd==="formal")return occasionFits(g,"formal"); // código de vestir del perfil: formal = como un evento formal
 if(["work","formal","event"].includes(occ)){
  // Con formalidad arreglada o formal, vale aunque el nombre diga «sandalia» o «mochila»; informal, se mira el tipo; deporte o fiesta, no
  if(occ==="work"&&["smartcasual","formal"].includes(g.formality))return true;
  if(occ==="work"&&g.formality==="party"&&!occs.length&&smartFallbackShoes(g))return true; // salones o tacones lisos de «fiesta»: también de trabajo (banco A/B, #128); sandalias y brillos, no
  if(occ!=="work"&&g.formality)return formal>=2&&g.formality!=="sport";
  if(g.formality&&!["casual"].includes(g.formality))return false;
  if((occ==="work"&&wd==="informal"?WORK_NO_INFORMAL:WORK_NO).test(textOf(g))||isShortBottom(g)||occ==="work"&&isBackpack(g)&&!(wd==="informal"&&!isOutdoor(g)))return false; // P1/P8 (#99); mochila informal, no (revisión de Codex, #112)
 }
 if(occ==="party"&&g.formality&&formal<2)return false;
 if(!["daily","sport","beach"].includes(occ)&&isOutdoor(g)&&g.category!=="Zapatos")return false; // Q3 (#108): mochila de montaña, ropa técnica
 if(g.category==="Bolsos"&&!["daily","sport"].includes(occ)&&!(occ==="work"&&wd==="informal")&&!g.formality&&g.style!=="smart"&&BACKPACK.test(textOf(g)))return false; // mochila sin más datos: solo diario
 // Gorros, gorras, boinas y sombreros solo en diario o playa; vale también para las sugerencias con IA (revisión de Codex, #100)
 if(g.category==="Accesorios"&&!["daily","beach"].includes(occ)&&HEADWEAR.test([g.type,g.subtype,g.name].filter(Boolean).join(" ")))return false;
 if(occs.length)return occs.includes(occ)||(occ==="daily"&&!occs.every(o=>["sport","home","beach","formal","party","event"].includes(o)));
 if(g.category==="Zapatos"&&g.style==="sport"&&["daily","work"].includes(occ))return true;
 if(g.formality){ // con formalidad conocida, decide ella (no el estilo)
  if(occ==="sport")return g.formality==="sport";
  if(["party","event","formal"].includes(occ))return formal>=2;
  if(occ==="beach")return formal<=1;
  if(occ==="daily")return g.formality!=="party";
 }
 const ok=OCC_STYLES[occ];return !g.style||!ok||ok.includes(g.style);
}
/* Compatibilidad dura: relación de categorías y estilos compatibles. El color ya no descarta: puntúa (spec §4). */
const related=(a,b)=>(PAIRS[a.category]||[]).includes(b.category)||(PAIRS[b.category]||[]).includes(a.category);
const stylesOk=(a,b)=>styleAffinity(a,b)>=.3;
/* Color: rueda de familias. Mismo tono 1 · neutro 0,9 · vecinos 0,8 · a dos pasos 0,6 · opuestos 0,45 (solo bien como acento). */
const WHEEL=["rojo","naranja","amarillo","verde","azul","morado","rosa"];
/* Los estampados no son una familia cromática única. La mezcla se deja incierta
   cuando no hay datos y se distingue por señales observables, nunca por etiquetas
   como «rayas+flores siempre bien/mal». Campos optativos, sin inferirlos de la nada. */
function patternPairEvidence(a,b){
 const fa=a.materialAttributes||{},fb=b.materialAttributes||{};
 const tokens=g=>[g.color,g.secondaryColor,...(Array.isArray(g.materialAttributes?.patternColors)?g.materialAttributes.patternColors:[])]
   .filter(x=>typeof x==="string"&&x.trim()).map(norm).filter(x=>!["multicolor","vaquero","unknown"].includes(x));
 const ca=new Set(tokens(a)),cb=new Set(tokens(b)),shared=[...ca].some(x=>cb.has(x));
 const scaleA=fa.patternScale||a.patternScale,scaleB=fb.patternScale||b.patternScale;
 const coverageA=fa.patternPlacement||a.patternPlacement,coverageB=fb.patternPlacement||b.patternPlacement;
 const contrastA=fa.patternContrast||a.patternContrast,contrastB=fb.patternContrast||b.patternContrast;
 let score=.56; // neutral con incertidumbre, nunca «aprobación» por pertenecer a una familia
 if(shared)score+=.08;
 if(scaleA&&scaleB&&scaleA!==scaleB)score+=.08;
 if(coverageA==="localized"||coverageB==="localized")score+=.06;
 const bothBold=contrastA==="high"&&contrastB==="high"&&coverageA==="allover"&&coverageB==="allover";
 if(bothBold&&!shared)score-=.13;
 if(bothBold&&scaleA&&scaleA===scaleB)score-=.06;
 return {s:Math.max(.35,Math.min(.8,Math.round(score*100)/100)),k:"two-patterns",
  uncertain:!(scaleA&&scaleB&&coverageA&&coverageB&&contrastA&&contrastB)};
}
function pairColor(a,b){
 const ca=colorInfo(a.color,a.pattern),cb=colorInfo(b.color,b.pattern);
 if(!ca.fam||!cb.fam)return {s:.75};
 if(ca.fam==="estampado"&&cb.fam==="estampado")return patternPairEvidence(a,b);
 if(ca.fam==="estampado"||cb.fam==="estampado")return {s:.8};
 if(ca.fam==="neutro"||cb.fam==="neutro")return {s:.9,k:ca.fam===cb.fam?"neutral":"neutral-base"};
 if(ca.fam===cb.fam)return {s:1,k:"tonal:"+ca.fam};
 const i=WHEEL.indexOf(ca.fam),j=WHEEL.indexOf(cb.fam),d=Math.min(Math.abs(i-j),WHEEL.length-Math.abs(i-j));
 return d===1?{s:.8,k:"analog"}:d===2?{s:.6}:{s:.45,k:"opposite"};
}
const BIG=["Arriba","Abajo","Vestidos","Capas","Casa","Baño"];
const warmthOf=g=>({bajo:0,medio:1,alto:2}[g.warmth]??(g.thickness==="ligero"?0:g.thickness==="grueso"?2:/abrigo|plumas|parka/i.test(g.type||g.subtype||g.name||"")?2:1));
/* Capa según la temperatura: < 15 °C hace falta y mejor de abrigo; 15–19 °C ligera o media; 20–23 °C solo ligera; ≥ 24 °C ninguna */
function layerRule(temp){return temp<15?{need:true,max:2,prefer:"warm"}:temp<20?{need:false,max:1,prefer:"mid"}:temp<24?{need:false,max:0,prefer:"light"}:{need:false,max:-1}}
/* Puntuación de un look completo → {score 0–100, reasons[], warnings[]} */
/* Jerarquía visual conservadora: señales observables, no equivalencias automáticas.
   Si los metadatos son incompletos, devolvemos desconocido; dos focos pueden ser intencionales. */
function visualFocusEvidence(gs){
 const strength=g=>{
  if(g.patternContrast==="high"&&g.patternPlacement==="allover")return 2;
  if(g.surfaceSheen==="shiny"&&g.patternContrast==="high")return 2;
  if(g.surfaceSheen==="shiny"||g.patternContrast==="high"&&g.patternPlacement==="localized")return 1;
  return 0;
 };
 const core=gs.filter(g=>BIG.includes(g.category)),optional=gs.filter(g=>["Accesorios","Bolsos"].includes(g.category));
 const coreStrong=core.filter(g=>strength(g)===2),optionalStrong=optional.filter(g=>strength(g)===2);
 return {coreStrong:coreStrong.map(g=>g.id),optionalStrong:optionalStrong.map(g=>g.id),
  optionalCompetition:coreStrong.length>=2&&optionalStrong.length>0,
  known:gs.some(g=>g.patternContrast||g.surfaceSheen)};
}
/* Los estampados no implican competencia solo por contarlos. Esta señal
   exige contraste alto y cobertura completa declarados en las prendas principales. */
function focalCompetition(gs,ctx){
 const foci=gs.filter(g=>BIG.includes(g.category)&&g.pattern&&g.pattern!=="plain"&&g.pattern!=="unknown"
  &&(g.patternContrast||g.materialAttributes?.patternContrast)==="high"
  &&(g.patternPlacement||g.materialAttributes?.patternPlacement)==="allover");
 return {knownFoci:foci.length,scoreAdjustment:foci.length>=3&&!ctx.likes?.has("pattern")&&!ctx.likes?.has("multicolor")?-3:0};
}
function scoreOutfit(gs,ctx){
 const reasons=[],warnings=[],big=gs.filter(g=>BIG.includes(g.category));
 // Color (25): el conjunto principal manda. Bolsos y accesorios no deben
 // tapar una incompatibilidad evidente entre camiseta, pantalón o vestido.
 let baseTotal=0,baseN=0,extrasTotal=0,extrasWeight=0,kinds=[];
 for(let i=0;i<gs.length;i++)for(let j=i+1;j<gs.length;j++){
  const r=pairColor(gs[i],gs[j]),aBig=BIG.includes(gs[i].category),bBig=BIG.includes(gs[j].category),bothBig=aBig&&bBig;
  if(bothBig){baseTotal+=r.s;baseN++} // No fingir compatibilidad: el gusto no anula evidencia cromática desfavorable
  else {const weight=aBig||bBig?1:.35;extrasTotal+=r.s*weight;extrasWeight+=weight}
  if(r.k)kinds.push(r.k+(bothBig?"":"~"));
 }
 const baseColor=baseN?baseTotal/baseN:.75,accessoryColor=extrasWeight?extrasTotal/extrasWeight:baseColor;
 // Una buena relación entre complementos puede acompañar la base, nunca maquillar
 // el choque entre dos prendas principales. Solo puede restar hasta un 15 %.
 const color=baseN?Math.min(baseColor,.85*baseColor+.15*accessoryColor):accessoryColor,patterns=gs.filter(g=>colorInfo(g.color,g.pattern).fam==="estampado").length;
 const pal=paletteOf(gs),extraColors=Math.max(0,pal.size-(ctx.likes?.has("multicolor")?4:3));let colorAdj=-.1*extraColors;
 const mainKeys=new Set(big.map(colorKey).filter(k=>k&&!["negro","blanco","gris"].includes(k))),echo=gs.find(g=>!BIG.includes(g.category)&&mainKeys.has(colorKey(g)));
 if(echo&&!extraColors)colorAdj+=.05; // el bolso o el calzado repite un color del look: ritmo
 const tonal=kinds.find(k=>k.startsWith("tonal:")&&!k.endsWith("~"));
 if(tonal)reasons.push("Tono sobre tono en "+tonal.slice(6).replace(/~$/,"")+"s");
 else if(kinds.includes("opposite~"))reasons.push("Un toque de color en contraste");
 else if(big.length&&big.every(g=>colorInfo(g.color,g.pattern).fam==="neutro"))reasons.push("Neutros que combinan entre sí");
 else if(patterns===1&&kinds.some(k=>k.startsWith("neutral-base")))reasons.push("El estampado protagonista, con básicos neutros");
 // No aprobar complementos invasivos solo porque repiten color: cuando YA existen
 // al menos dos focos visuales documentados en la ropa, un tercer foco opcional
 // puede saturar el look. Penalización moderada, nunca prohibición universal.
 const visualFocus=visualFocusEvidence(gs);
 if(visualFocus.optionalCompetition&&!ctx.likes?.has("pattern")&&!ctx.likes?.has("multicolor")){colorAdj-=.06;warnings.push("Valora si el complemento compite con los protagonistas del look");}
 // Silueta (25): equilibrio de volúmenes cuando se conoce el corte
 const vol=g=>({oversize:2,holgado:2,regular:1,recto:1,entallado:0,ajustado:0}[g.fit]);
 const top=gs.find(g=>g.category==="Arriba"),bottom=gs.find(g=>g.category==="Abajo");let sil=.75; // Q1 (#108): sin corte conocido, igual que un vestido
 if(top&&bottom&&vol(top)!=null&&vol(bottom)!=null){const a=vol(top),b=vol(bottom);sil=Math.abs(a-b)===2?1:Math.abs(a-b)===1?.88:a===1?.8:a===b&&a!==1?(a===2&&ctx.dress==="comoda"?.86:.78):.6;if(Math.abs(a-b)===2)reasons.push("Volúmenes equilibrados: amplio con ajustado")}
 else if(gs.some(g=>g.category==="Vestidos"))sil=.75;
 // Estilo (20): coherencia de estilo; una pieza de otro nivel puede ser intencionada (F03)
 const styled=gs.filter(g=>g.style).map(sheetStyle),aff=[]; /* la formalidad de la ficha manda sobre el estilo (camisa vaquera «smart» con formalidad informal = informal) */
 const declared=g=>ctx.occasion&&!g.formality&&Array.isArray(g.occasions)&&g.occasions.includes(ctx.occasion); /* la ficha manda: sin formalidad en la ficha pero marcada para esta ocasión, su estilo no resta */
 for(let i=0;i<styled.length;i++)for(let j=i+1;j<styled.length;j++){const x=styled[i],y=styled[j],v=styleAffinity(x,y);aff.push((declared(x)||declared(y))&&occasionFits(x,ctx.occasion)&&occasionFits(y,ctx.occasion)?Math.max(v,.85):v)}
 let style=aff.length?aff.reduce((a,b)=>a+b,0)/aff.length:.75;
 const target=DRESS_TARGET[ctx.dress]||(ctx.occasion==="work"?{arreglado:{smart:1,party:.6,casual:.55,sport:.25},formal:{smart:1,party:.7,casual:.3,sport:0},informal:{casual:1,smart:.9,sport:.6,party:.4}}[workDress()]:null);
 if(target&&styled.length){const fit=styled.reduce((t,g)=>t+(target[g.style]??.5),0)/styled.length;style=.5*style+.5*fit;
  if(ctx.dress==="comoda"&&gs.some(g=>["holgado","oversize"].includes(g.fit)||["knit","cotton"].includes(g.fabric)))style=Math.min(1,style+.1);
  if(fit>=.85&&ctx.dress)reasons.push("Encaja con tu estilo de hoy: "+DRESS_LABEL[ctx.dress].toLowerCase());else if(fit>=.85)reasons.push("Arreglado para el trabajo")}
 // Detalles de estilista (banco A/B, #128): doble vaquero sin contraste y prendas llamativas en el trabajo restan un poco
 // La ficha manda: el nombre solo cuenta si falta el dato (revisión de Codex, #134)
 /* Doble denim es un estilo posible; evaluar lavados/acabados, proporciones y contexto, no penalizarlo por defecto. */
 // Animal print y pelo sí valen para la oficina (votos de Noelia, #128); brillos de noche, no
 const isLoud=g=>/lentejuel|sequin|purpurina|glitter|strass|rhinestone/i.test(textOf(g));
 if(ctx.occasion==="work"){const loud=gs.filter(isLoud).length;if(loud)style-=Math.min(.3,.15*loud)}
 const mix=new Set(styled.map(g=>g.style));
 if(mix.has("sport")&&mix.has("smart"))reasons.push("Las deportivas le dan un aire informal y actual");
 else if(mix.size===2&&styled.length>=3)reasons.push("Mezcla un toque de otro estilo");
 // Compatibilidad física estimada: solo cuando el corte y grosor están declarados.
 // No vetar capas ceñidas o volúmenes oversize de manera universal.
 const tightOuter=gs.find(g=>g.category==="Capas"&&["entallado","ajustado"].includes(g.fit));
 const bulkyUnder=tightOuter&&gs.find(g=>g!==tightOuter&&["Arriba","Vestidos"].includes(g.category)
   &&g.thickness==="grueso"&&["oversize","holgado"].includes(g.fit));
 if(bulkyUnder){
  style=Math.max(0,style-.12);warnings.push("La capa ajustada puede limitar el volumen de la prenda gruesa");
 }
 // Contexto (20): ocasión, capa adecuada al tiempo y look completo
 const rule=layerRule(ctx.temp),layer=gs.find(g=>g.category==="Capas");let context=.8;
 if(rule.need&&!layer){context-=.4;warnings.push(myGarments().some(g=>g.category==="Capas")?"Hace frío y no hay abrigo que combine":"Hace frío: añade un abrigo a tu armario")} /* el aviso dice qué hacer (revisión general, 10/10/2026) */
 if(layer&&rule.need)reasons.push("Abrigo para "+ctx.temp+" °C");else if(layer&&rule.max>=0)reasons.push("Capa ligera para "+ctx.temp+" °C");
 // Abrigo del conjunto (clo) frente a lo que pide la temperatura: penaliza de forma gradual quedarse corto o pasarse (en casa o en bañador, no)
 if(Number.isFinite(ctx.temp)&&big.length&&ctx.occasion!=="home"&&!gs.some(g=>["Casa","Baño"].includes(g.category))){const d=outfitClo(gs)-cloTarget(ctx.temp),tol=["party","event","formal"].includes(ctx.occasion)?.45:.3;
  if(d<-tol){context-=Math.min(.45,(-d-tol)*1.2);if(d<-tol-.12){if(rule.need)context-=.25; /* con frío de verdad (< 15 °C), quedarse corto es un fallo de función, no de gusto: pesa más que un detalle de estilo */if(!warnings.some(w=>/frío/i.test(w)))warnings.push("Puede que pases frío con "+ctx.temp+" °C")}}
  else if(d>tol+.05){context-=Math.min(.3,(d-tol-.05));if(d>tol+.2)warnings.push("Quizá demasiado abrigo para "+ctx.temp+" °C")}}
 if(ctx.extras.shoes&&!gs.some(g=>g.category==="Zapatos")){context-=.25;warnings.push(myGarments().some(g=>g.category==="Zapatos")?"No hay calzado que combine":"Añade calzado a tu armario para completar el look")}
 if(ctx.occasion&&gs.every(g=>occasionFits(g,ctx.occasion)))context+=.2;
 // Con frío, un top sin mangas, de hombros al aire o corto bajo el abrigo no es lo natural (banco A/B, #128)
 if(Number.isFinite(ctx.temp)&&ctx.temp<12&&ctx.occasion!=="home"&&gs.some(g=>g.category==="Arriba"&&((g.sleeve&&g.sleeve!=="no aplica"?g.sleeve==="sin mangas":/tirantes|sin mangas|sleeveless|\btank\b/i.test(textOf(g)))||(g.length&&g.length!=="na"?g.length==="cropped":/\bcrop/i.test(textOf(g)))||/off.?shoulder|hombros al aire|palabra de honor|strapless/i.test(textOf(g)))))context-=.25;
 // Nivel 2: el conjunto como unidad. El eslabón más débil hunde el look aunque el resto encaje
 const ident=comboIdentity(gs,ctx);
 if(ident.weakest&&ident.weakest.r.s<REL_WEAK){context-=.25;warnings.push((ident.weakest.a.name||ident.weakest.a.type)+" y "+(ident.weakest.b.name||ident.weakest.b.type)+" no se llevan bien")}
 else if(ident.weakest&&ident.weakest.r.s>=.72&&gs.length>=3)reasons.push("Todas las prendas se llevan bien entre sí");
 if(!ctx.lite){const nuc=nucleusOf(gs);for(const x of gs.filter(g=>!nuc.includes(g)&&g.category!=="Zapatos").slice(0,3)){const fs=pieceFunctions(x,gs.filter(g=>g!==x),ctx);if(fs.length)reasons.push(capFirst(x.type||x.category)+": "+fs[0])}}
 const issues=lookIssues(gs,ctx);if(issues.length){context-=Math.min(.6,.3*issues.length);warnings.push(...issues.slice(0,2))}
 // Personal (10): favoritas, olvidadas, usado hace poco, Tus gustos
 let personal=.5;const fav=gs.filter(g=>g.favorite).length,forg=gs.filter(g=>ctx.forgotten.has(g.id));
 {let ln=0;for(let i=0;i<gs.length;i++)for(let j=i+1;j<gs.length;j++)ln+=learnOf(gs[i],gs[j]);personal+=Math.max(-.3,Math.min(.3,ln*.05))} /* parejas aprendidas del perfil */
 personal+=Math.min(.3,fav*.1)+Math.min(.3,forg.length*.15)-gs.reduce((t,g)=>t+(ctx.avoid.has(g.id)?(BIG.includes(g.category)?.45:.1):0),0);
 if(forg.length)reasons.push("Rescata «"+forg[0].name+"», que hace tiempo que no te pones");
 if(ctx.formalBias){const lv=gs.reduce((t,g)=>t+formalLevel(g),0)/gs.length;personal-=.3*ctx.formalBias*(lv-1.5)/1.5} // 👎 «muy arreglado/informal»
 const traits=lookTraits(null,gs);for(const k of traits){if(ctx.likes.has(k)){personal+=.25;reasons.push("Va con tus gustos: "+tasteLabel(k))}if(ctx.dislikes.has(k))personal-=.25}
 const clamp=v=>Math.max(0,Math.min(1,v));
 // Lo usado hace poco resta aparte (hasta 15 puntos), para que «distinto cada día» pese de verdad
 const recent=Math.min(1,personal<0?-personal:0);
 const score=Math.round(25*clamp(color+colorAdj)+25*clamp(sil)+20*clamp(style)+20*clamp(context)+10*clamp(personal)-15*recent+focalCompetition(gs,ctx).scoreAdjustment-(ctx.likes?.has("vividmono")?0:12)*vividColorRepeat(gs)); // gusto: solo si te gusta el tono sobre tono en color vivo (no basta con «monocromático»)
 return {score,reasons:[...new Set(reasons)].slice(0,3),warnings};
}
/* Contexto común (se calcula una vez por llamada: usos, olvidadas y gustos) */
function engineContext(o={}){
 const p=appState.data.preferences,date=o.date||dayISO(),occasion=o.occasion===undefined?(p.occasion||"daily"):o.occasion,taste=tasteProfile(),dress=o.dress===undefined?(DRESS_TARGET[p.dressStyle]?p.dressStyle:null):o.dress;
 const temp=o.temp??tempFor(date),season=SEASON3(Number(date.slice(5,7))-1),worn=new Map();
 for(const l of logs())for(const id of l.garmentIds||[])worn.set(id,(worn.get(id)||0)+1);
 const notes=pieceNotes();
 return {date,occasion,dress,temp,season,extras:o.extras||lookExtras(),avoid:new Set([...(o.avoid||[]),...notes.disliked]) /* «no me gusta la prenda»: se propone mucho menos */,offOcc:new Set([...notes.offOcc].filter(k=>k.endsWith("|"+occasion)).map(k=>k.slice(0,k.lastIndexOf("|")))),worn,
  forgotten:new Set(myGarments().filter(g=>forgottenStatus(g).forgotten).map(g=>g.id)),likes:new Set(taste.likes.map(x=>x.k)),dislikes:new Set(taste.dislikes.map(x=>x.k)),formalBias:formalityBias()};
}
/* Completa una base: calzado, capa (regla de temperatura), bolso y un complemento, si combinan con todo.
   used: veces que ya sale cada prenda en las propuestas elegidas (para variar complementos, D2). */
function summerFootwear(g){return g.category==="Zapatos"&&/chancl|flip.?flop|sandali?as?|slides?/.test([g.name,g.type,g.subtype].filter(Boolean).join(" ").toLowerCase())}
function winterHat(g){return g.category==="Accesorios"&&/gorro|beanie|pasamonta|balaclava|wool hat/.test([g.name,g.type,g.subtype].filter(Boolean).join(" ").toLowerCase())}
const BACKPACK=/mochila|backpack/i;
const isSneaker=g=>g.category==="Zapatos"&&(g.style==="sport"||/deportiv|sneaker|trainer|running|tenis|zapatilla(?!s? de casa)/i.test([g.type,g.subtype,g.name].filter(Boolean).join(" ")));
const isBackpack=g=>g.category==="Bolsos"&&BACKPACK.test([g.type,g.name].filter(Boolean).join(" "));
const HEADWEAR=/gorr|boina|sombrero|beanie|pamela|\bcap\b/i;
function headwearMakesSense(g,ctx){
 if(!["daily","beach",null,undefined].includes(ctx.occasion))return false;
 if(winterHat(g))return ctx.temp<12;
 return ctx.temp>=24&&/sombrero|pamela|gorra/i.test([g.type,g.subtype,g.name].filter(Boolean).join(" "));
}
function weatherCompatible(g,look,ctx){
 if(summerFootwear(g)&&(ctx.temp<19||look.some(winterHat)))return false;
 if(winterHat(g)&&(ctx.temp>=12||look.some(summerFootwear)))return false; // P6 (#99): solo con frío
 return true;
}
/* Context checks used by the local outfit engine, not accessory-style policy. */
function heavyKnitInHeat(g,temp){
 if(thermal(g)!==null&&(g.sleeve||g.thickness||g.length||g.fabric))return !thermalOk(g,temp); // con datos de la ficha
 const label=[g.name,g.type,g.subtype].filter(Boolean).join(" ").toLowerCase();
 return temp>=24&&g.category==="Arriba"&&/jersey|suéter|sueter|sweater|pul[oó]ver|wool jumper/.test(label)&&
  !/camiseta|manga corta|jersey fino|ligero|lightweight/.test(label);
}
function insufficientColdLayer(g,temp){
 if(temp>=12||g.category!=="Capas")return false;
 return /chaleco|vest|gilet/.test([g.name,g.type,g.subtype].filter(Boolean).join(" ").toLowerCase());
}
function smartFallbackShoes(g){
 if(g.category!=="Zapatos")return false;
 const text=[g.name,g.type,g.subtype].filter(Boolean).join(" ").toLowerCase();
 return /mocas[ií]n|loafer|bailarina|flat|sal[oó]n|oxford|blucher|bot[ií]n|ankle boot|tac[oó]n|tacones|pumps?\b|heels?\b/.test(text)&&
  !/chancl|sandal|zueco|clog|deportiv|sneaker|purpurina|glitter|strass|rhinestone|lentejuel|sequin/.test(text);
}
/* Botas y botines con calor (≥ 26 °C): solo si no hay otro calzado (evaluación Polyvore: botines a 28 °C con vestido sin mangas) */
const closedBoot=g=>g.category==="Zapatos"&&/\bbot(a|as|ines?|[ií]n)\b|\bboots?\b/i.test(textOf(g))&&!/sandal|peep.?toe|open.?toe/i.test(textOf(g));
const bootInHeat=(g,temp)=>temp>=26&&closedBoot(g);
/* Estampado: la ficha manda; sin dato, el color o el nombre (camuflaje, leopardo, rayas…) (prueba de degradación) */
const PATTERN_TEXT=/camufla|\bcamo\b|leopard|cebra|zebra|serpiente|snake|animal print|estampad|\bprint\b|rayas|stripe|cuadros|plaid|tartan|check|flores|floral|lunares|polka|\bdots\b|paisley|cachemir/i;
const isPatterned=g=>g.pattern&&g.pattern!=="unknown"?g.pattern!=="plain":colorInfo(g.color).fam==="estampado"||PATTERN_TEXT.test(textOf(g));
/* Calzado de reserva de todo el armario: si la ficha indica ocasiones, mandan (revisión de Codex, #117) */
const fallbackOccOk=(g,occ)=>!(Array.isArray(g.occasions)&&g.occasions.length)||occasionFits(g,occ);
/* Contexto de bolsos y abrigos (evaluación Polyvore v88/v92) */
const hasSkirtOrDress=gs=>gs.some(g=>g.category==="Vestidos"||g.category==="Abajo"&&/falda|skirt/i.test(textOf(g)));
const outdoorPack=g=>isBackpack(g)&&isOutdoor(g); // mochila de montaña o técnica: no con vestido ni falda
/* Restricciones que rankOutfits aplica al generar, también para puntuar looks hechos a mano, de la IA o de «Cambiar prenda» (#128) */
function lookIssues(gs,ctx){
 const out=[],t=ctx.temp,nm=g=>g.name||g.type||g.category,occ=ctx.occasion;
 for(const g of gs){
  if(occ&&!occasionFits(g,occ))out.push(nm(g)+": no es para «"+(occasions[occ]||occ).toLowerCase()+"»");
  else if(coldExposed(g,t,occ))out.push(nm(g)+": sin mangas o corto para "+t+" °C");
  else if(Number.isFinite(t)&&(!thermalOk(g,t)||heavyKnitInHeat(g,t)))out.push(nm(g)+(t>=20?": demasiado abrigo para ":": poco abrigo para ")+t+" °C");
  else if(Number.isFinite(t)&&bootInHeat(g,t))out.push(nm(g)+": botas con "+t+" °C");
  else if(Number.isFinite(t)&&!weatherCompatible(g,gs.filter(x=>x!==g),ctx))out.push(nm(g)+": no va con "+t+" °C");
  else if(g.category==="Accesorios"&&HEADWEAR.test([g.type,g.subtype,g.name].filter(Boolean).join(" "))&&!headwearMakesSense(g,ctx))out.push(nm(g)+": sin motivo (ni sol ni frío)");
  if(outdoorPack(g)&&hasSkirtOrDress(gs))out.push("Mochila de montaña con vestido o falda");
 }
 /* Los accesorios estampados no son un fallo por sí mismos: evaluar relación y aportación real al look. */
 return out;
}
const PUFFER=/plum[ií]fero|plumas|anorak|acolchad|puffer|quilted|parka|cortavientos|softshell|forro polar|fleece/i;
const casualCoat=g=>g.category==="Capas"&&PUFFER.test(textOf(g))&&formalLevel(g)<2; // en el trabajo, mejor abrigo de paño, gabardina o blazer
function vividColorRepeat(gs){
 const count=new Map();
 for(const g of gs){
  const info=colorInfo(g.color,g.pattern);
  if(!info.fam||info.fam==="neutro"||info.fam==="estampado")continue;
  count.set(info.fam,(count.get(info.fam)||0)+1);
 }
 return [...count.values()].reduce((n,v)=>n+Math.max(0,v-2),0);
}
function completeOutfitGreedy(base,pool,ctx,used=new Map(),firstPick=null){
 const l=[...base],rule=layerRule(ctx.temp),home=ctx.occasion==="home",beach=ctx.occasion==="beach";
 const fits=x=>!l.includes(x)&&!(l.some(g=>isBackpack(g)&&(isOutdoor(g)||formalLevel(g)<2))&&formalLevel(x)>=2)&&!heavyKnitInHeat(x,ctx.temp)&&!insufficientColdLayer(x,ctx.temp)&&weatherCompatible(x,l,ctx)&&l.every(p=>!related(x,p)||stylesOk(x,p))&&l.every(p=>pairColor(x,p).s>=.45||!BIG.includes(p.category)||!BIG.includes(x.category)||ctx.likes?.has("pattern")&&pairColor(x,p).k==="two-patterns")&&!(["Bolsos","Accesorios"].includes(x.category)&&newColorOverflow(x,l,ctx))&&l.every(p=>(relationOf(x,p,ctx)?.s??1)>=REL_WEAK); // ninguna pareja débil (calzado incluido: mejor sin calzado que uno que no combina)
 const relMean=x=>{const rs=l.map(p=>relationOf(x,p,ctx)?.s).filter(v=>v!=null);return rs.length?rs.reduce((a,b)=>a+b,0)/rs.length:.6};
 let pm=new Map();const pref=x=>pm.has(x)?pm.get(x):pm.set(x,prefRaw(x)).get(x); /* memo por categoría: el orden compara muchas veces */
 const prefRaw=x=>(relMean(x)-.6)+l.reduce((t,p)=>t+learnOf(x,p)*.4,0)+ /* lo que la persona ha elegido o editado (looks guardados) */(x.favorite?.5:0)+(["Bolsos","Accesorios","Zapatos"].includes(x.category)&&colorKey(x)&&paletteOf(l).has(colorKey(x))?.6:0)+ /* repetir un color del look: ritmo (regla de tres colores) */1/(1+(ctx.worn.get(x.id)||0))+(ctx.forgotten.has(x.id)?.5:0)-(ctx.avoid.has(x.id)?2:0)-(used.get(x.id)||0)*1.5+
  l.reduce((t,p)=>t+pairColor(x,p).s,0)/Math.max(1,l.length);
 const plan=[ctx.extras.shoes&&!home&&!beach?"Zapatos":beach&&ctx.extras.shoes?"Zapatos":null,!home&&rule.max>=0?"Capas":null,ctx.extras.bag&&!home?"Bolsos":null,!home?"Accesorios":null];
 for(const cat of plan){
  if(!cat||l.some(x=>x.category===cat))continue;
  pm=new Map();
  let c=(ctx.byCat?.get(cat)||pool.filter(x=>x.category===cat)).filter(fits);
  if(cat==="Capas"){c=c.filter(x=>warmthOf(x)<=rule.max&&!insufficientColdLayer(x,ctx.temp));if(rule.prefer==="warm")c.sort((a,b)=>warmthOf(b)-warmthOf(a)||pref(b)-pref(a));else c.sort((a,b)=>pref(b)-pref(a));
   if(["work","event","formal","party"].includes(ctx.occasion)){const dressy=c.filter(x=>!casualCoat(x)&&(rule.prefer!=="warm"||warmthOf(x)>=warmthOf(c[0]||x)));if(dressy.length)c=[...dressy,...c.filter(x=>!dressy.includes(x))]}}
  else if(cat==="Zapatos"&&["party","event","formal"].includes(ctx.occasion)){
   const formal=c.filter(x=>formalLevel(x)>=2); // por formalidad de la ficha, no solo por estilo (revisión de Codex, #112)
   if(!formal.length)c=(ctx.allShoes||[]).filter(x=>smartFallbackShoes(x)&&fallbackOccOk(x,ctx.occasion)).filter(fits);
   c.sort((a,b)=>(Number(formalLevel(b)>=2)-Number(formalLevel(a)>=2))*2+pref(b)-pref(a));
  }
  else if(cat==="Zapatos"&&ctx.occasion==="work"){ // Q2 (#108): deportivas solo si no hay otro calzado (por tipo o nombre, no solo por estilo)
   const ok=x=>(workDress()==="informal"||!isSneaker(x))&&!bootInHeat(x,ctx.temp); // oficina informal: deportivas como cualquier otro calzado
   // Sin calzado de trabajo adecuado: salones o tacones lisos del armario antes que deportivas; botines con calor, lo último
   if(!c.some(ok))c=[...c,...(ctx.allShoes||[]).filter(x=>!c.includes(x)&&smartFallbackShoes(x)&&ok(x)&&fallbackOccOk(x,ctx.occasion)).filter(fits)];
   const tier=x=>ok(x)?0:isSneaker(x)&&!bootInHeat(x,ctx.temp)?1:2;
   c.sort((a,b)=>tier(a)-tier(b)||pref(b)-pref(a))}
  else c.sort((a,b)=>pref(b)-pref(a));
  if(cat==="Zapatos"&&c.some(x=>!bootInHeat(x,ctx.temp)))c=c.filter(x=>!bootInHeat(x,ctx.temp));
  if(cat==="Zapatos"&&c.some(x=>!newColorOverflow(x,l,ctx)))c=c.filter(x=>!newColorOverflow(x,l,ctx)); // calzado: sin cuarto color si hay alternativa
  if(cat==="Bolsos"&&l.some(p=>formalLevel(p)>=2))c=c.filter(x=>!isBackpack(x)||formalLevel(x)>=2&&!isOutdoor(x)); // Q3 (#108): mochila de vestir sí
  if(cat==="Bolsos"&&hasSkirtOrDress(l))c=c.filter(x=>!outdoorPack(x)); // sin bolso antes que mochila de montaña con vestido
  if(cat==="Bolsos"&&ctx.occasion!=="sport")c=c.filter(x=>!outdoorPack(x)); // mochila de montaña solo en deporte (cata n.º 4: «sobra» en looks de ciudad)
  if(cat==="Bolsos"&&["party","event","formal"].includes(ctx.occasion)){const lv=x=>Array.isArray(x.occasions)&&x.occasions.includes(ctx.occasion)?3:formalLevel(x),top=Math.max(0,...c.map(lv));if(top>=2)c=c.filter(x=>lv(x)>=top)} // fiesta: el bolso más arreglado que haya (de fiesta antes que de diario)
  if(cat==="Zapatos"&&beach)c=c.filter(x=>/sandal|chancl|alpargat|zueco/i.test([x.type,x.name,x.subtype].filter(Boolean).join(" ")));
  if(cat==="Zapatos"){const ok=c.filter(x=>l.every(p=>(relationOf(x,p,ctx)?.s??1)>=REL_OK));if(ok.length)c=ok} // calzado que combina con todo el look si lo hay, después de los filtros funcionales como la playa (revisión de Codex, #210; tacones de fiesta con camisa vaquera, no)
  // P3/P4 (#99): un gorro o sombrero solo con motivo (frío o sol de verano en diario/playa); otros complementos, si suman
  if(cat==="Accesorios")c=c.filter(x=>!HEADWEAR.test([x.type,x.subtype,x.name].filter(Boolean).join(" "))||headwearMakesSense(x,ctx));
  const optional=cat==="Bolsos"||cat==="Accesorios"||cat==="Capas"&&!rule.need;
  if(optional&&ctx.lite)continue; // candidatos: sin piezas opcionales (rendimiento); se deciden al completar los looks elegidos
  if(optional){ // expandLook: ¿el conjunto es mejor con esta prenda que sin ella? Necesita una función y subir la nota
   /* función práctica (el bolso si se pide en Ajustes; la capa si sin ella hay aviso de frío): entra si combina con todo y apenas resta; si no, tiene que sumar */
   const r0=scoreOutfit(l,ctx),s0=r0.score,cold=cat==="Capas"&&r0.warnings.some(w=>/frío/.test(w)),practical=cat==="Bolsos"||cold,best=c.slice(0,4).filter(x=>(practical||pieceFunctions(x,l,ctx).length)&&l.every(p=>(relationOf(x,p,ctx)?.s??1)>=REL_OK))
    .map(x=>({x,s:scoreOutfit([...l,x],ctx).score,u:used.get(x.id)||0})).sort((a,b)=>b.s-1.5*b.u-(a.s-1.5*a.u))[0]; /* variar bolso y complementos entre las propuestas (revisión general) */
   if(best&&best.s>=s0+(practical?-3:1))l.push(best.x); /* bolso: una pieza más diluye la media; se admite si apenas resta */
   continue;
  }
  const pick=cat==="Zapatos"&&firstPick?c.find(x=>x===firstPick):c[0];
  if(pick)l.push(pick);
 }
 return l;
}
/* La elección voraz puede dejar el look a medias (unos zapatos que impiden la única capa que combina, #35):
   se prueban las 3 mejores opciones de calzado y se queda la más completa (a igualdad, la primera) */
function completeOutfit(base,pool,ctx,used=new Map()){
 const first=completeOutfitGreedy(base,pool,ctx,used);
 if(!ctx.extras.shoes||base.some(g=>g.category==="Zapatos"))return first;
 const shoes=pool.filter(x=>x.category==="Zapatos"&&!base.includes(x)).slice(0,12);
 const need=layerRule(ctx.temp).need,coldWithout=l=>scoreOutfit(l.filter(g=>g.category!=="Capas"),ctx).warnings.some(w=>/frío/.test(w));
 const core=l=>l.filter(g=>!["Bolsos","Accesorios"].includes(g.category)&&(g.category!=="Capas"||need||coldWithout(l))).length; /* completo = calzado y capa si hace falta (frío o aviso de frío sin ella); lo opcional no gana por sumar piezas (revisión de Codex, #168) */
 let best=first;
 for(const z of shoes.filter(z=>!first.includes(z)).slice(0,2)){const alt=completeOutfitGreedy(base,pool,ctx,used,z);if(core(alt)>core(best)&&alt.includes(z))best=alt}
 return best;
}
/* rankOutfits(opciones) → [{garments, ids, score, reasons, warnings}]
   opciones: date, occasion (null = sin filtro), temp, required (id que debe estar), pool (prendas candidatas),
   avoid (ids usados hace poco), extras, max, seen (firmas ya vistas). */
function rankOutfits(o={}){
 ensureRelations();const ctx=engineContext(o),max=o.max||3;
 let pool=(o.pool||myGarments()).filter(g=>seasonFits(g,ctx.season)||g.id===o.required);
 ctx.allShoes=pool.filter(g=>g.category==="Zapatos");
 const byOcc=pool.filter(g=>occasionFits(g,ctx.occasion)&&!ctx.offOcc.has(g.id)||g.id===o.required); /* «no es para esta ocasión» o «sobra», dicho en «Casi» */
 const warn=[];if(ctx.occasion)pool=byOcc;
 const req=o.required?(o.pool||myGarments()).find(g=>g.id===o.required):null; /* también una prenda que aún no tienes («¿Lo compro?») */
 /* mochila de montaña obligatoria: solo looks de deporte; en «Combinar prenda» (sin ocasión) se prueban primero (revisión de Codex, #169) */
 if(req&&outdoorPack(req)&&ctx.occasion!=="sport"){if(ctx.occasion)return [];if(!o.sportTried){const r=rankOutfits({...o,occasion:"sport",sportTried:true});if(r.length)return r}}
 const tops=pool.filter(g=>g.category==="Arriba"),bottoms=pool.filter(g=>g.category==="Abajo");
 let bases=[];
 if(req&&req.category==="Arriba")bases=bottoms.filter(b=>stylesOk(req,b)).map(b=>[req,b]);
 else if(req&&req.category==="Abajo")bases=tops.filter(t=>stylesOk(t,req)).map(t=>[t,req]);
 else if(req&&["Vestidos","Casa","Baño"].includes(req.category))bases=[[req]];
 else{
  if(ctx.occasion==="home")bases=pool.filter(g=>g.category==="Casa").map(g=>[g]);
  if(ctx.occasion==="beach")bases=pool.filter(g=>g.category==="Baño").map(g=>[g]);
  bases=[...bases,...outfitBases(pool.filter(g=>!["Casa","Baño"].includes(g.category)))];
  if(req)bases=bases.filter(b=>b.every(p=>!related(req,p)||stylesOk(req,p))&&(!isBackpack(req)||!isOutdoor(req)&&formalLevel(req)>=2||b.every(p=>formalLevel(p)<2))).map(b=>[...b,req]); // mochila elegida: sin prendas smart ni party (revisión de Codex, #111)
  if(req&&outdoorPack(req)&&bases.some(b=>!hasSkirtOrDress(b)))bases=bases.filter(b=>!hasSkirtOrDress(b)); // mochila de montaña: con pantalón
 }
 bases=bases.filter(b=>b.length&&!b.some(g=>heavyKnitInHeat(g,ctx.temp)||!thermalOk(g,ctx.temp)||coldExposed(g,ctx.temp,ctx.occasion)&&g.id!==o.required)&&b.every((x,i)=>b.every((y,j)=>i===j||!related(x,y)||stylesOk(x,y))));
 /* Núcleo que combina de verdad (Noelia: «los looks tienen que llevar cosas que combinen 100 %»): cada pareja de la base con relación ≥ 0,6,
    con el gusto del perfil. Antes una pareja floja (camisa vaquera + pantalón de cuadros, 0,45) podía salir primera si el resto del look puntuaba bien */
 {const strong=bases.filter(b=>b.every((x,i)=>b.every((y,j)=>j<=i||(relationOf(x,y,ctx)?.s??1)>=REL_OK)));if(strong.length)bases=strong}
 if(bases.some(b=>!b.some(g=>uncertainColdTop(g,ctx.temp))))bases=bases.filter(b=>!b.some(g=>uncertainColdTop(g,ctx.temp)&&g.id!==o.required)); // sin dato de manga y con frío: solo si no hay otra cosa
  // Puntuación y selección variada: valor = puntuación − solapamiento con las ya elegidas (prendas principales pesan más)
 // R2: las bases se completan con la versión rápida; la búsqueda de calzado alternativo (completeOutfit) solo para las elegidas
 ctx.byCat=new Map();for(const g of pool){if(!ctx.byCat.has(g.category))ctx.byCat.set(g.category,[]);ctx.byCat.get(g.category).push(g)}
 ctx.lite=true;const used=new Map(),cands=bases.map(b=>{const gs=completeOutfitGreedy(b,pool,ctx);return {gs,...scoreOutfit(gs,ctx)}});
 ctx.lite=false;const seen=new Set(o.seen||[]),skipN=new Set(o.skipNuclei||[]),out=[],picked=new Set();
 const hasTopBottom=cands.some(c=>c.gs.some(g=>g.category==="Arriba")&&c.gs.some(g=>g.category==="Abajo"));
 const overlap=(a,b)=>a.gs.reduce((t,g)=>t+(b.gs.includes(g)?(BIG.includes(g.category)&&g.category!=="Capas"?1:.35):0),0);
 const sig=c=>c.gs.map(g=>g.id).sort().join("|");
 while(out.length<max){
  let best=null,bv=-1e9;
  // Q1 (#108): variedad de bases; si ya hay un vestido elegido y existen looks de arriba+abajo, el siguiente vestido cuesta más
  const dressOut=out.filter(x=>x.gs.some(g=>g.category==="Vestidos")).length;
  const eligible=cands.filter(c=>!picked.has(c)&&!seen.has(sig(c))&&!(skipN.size&&skipN.has(nucleusKey(c.gs))));
  // Una pareja nueva de camiseta+pantalón no es realmente distinta si
  // reutiliza una de esas dos prendas. Preferir menos piezas principales
  // repetidas, siempre dentro de un margen razonable de calidad.
  const principal=c=>new Set(c.gs.filter(g=>["Arriba","Abajo","Vestidos","Casa","Baño"].includes(g.category)).map(g=>g.id));
  const usedPrincipal=new Set(out.flatMap(c=>[...principal(c)]));
  // En «Combina una prenda» esta pieza debe repetirse en todos los looks:
  // no contarla como falta de diversidad al seleccionar las alternativas.
  const reuse=c=>[...principal(c)].filter(id=>id!==o.required&&usedPrincipal.has(id)).length;
  const strongest=eligible.reduce((v,c)=>Math.max(v,c.score),-Infinity);
  const quality=eligible.filter(c=>c.score>=strongest-12);
  const leastReuse=quality.length?Math.min(...quality.map(reuse)):Infinity;
  const diverse=out.length?quality.filter(c=>reuse(c)===leastReuse):[];
  const options=diverse.length?diverse:eligible;
  for(const c of options){const v=c.score-out.reduce((t,x)=>t+overlap(c,x)*14,0)-(dressOut&&hasTopBottom&&c.gs.some(g=>g.category==="Vestidos")?12*dressOut:0);if(v>bv){bv=v;best=c}}
  if(!best)break;picked.add(best);
  // Variedad de complementos (D2): se vuelve a completar la base teniendo en cuenta lo ya elegido
  const base=best.gs.filter(g=>!["Zapatos","Capas","Bolsos","Accesorios"].includes(g.category)||g.id===o.required);
  const gs=completeOutfit(base,pool,ctx,used),sc=scoreOutfit(gs,ctx);
  for(const g of gs)if(!BIG.includes(g.category)||g.category==="Capas")used.set(g.id,(used.get(g.id)||0)+1);
  const r={gs,score:sc.score,reasons:sc.reasons,warnings:[...warn,...sc.warnings]};seen.add(sig(r));out.push(r);
 }
 /* Orden en pantalla (Noelia, 10/10/2026): todos combinan; primero los más completos, siempre que estén cerca del mejor en calidad */
 const top=Math.max(...out.map(r=>r.score)),near=r=>r.score>=top-12?0:1;
 out.sort((a,b)=>near(a)-near(b)||completeness(b.gs)-completeness(a.gs)||b.score-a.score);
 return out.map(r=>({garments:r.gs,ids:r.gs.map(g=>g.id),score:r.score,reasons:r.reasons,warnings:r.warnings}));
}
/* Lo completo que está un look: la base cuenta como una (arriba + abajo o vestido) y suma calzado, capa, bolso y complementos; desempata el número de piezas */
const completeness=gs=>1+["Zapatos","Capas","Bolsos","Accesorios"].filter(c=>gs.some(g=>g.category===c)).length+gs.length/100;
/* Combinar una prenda: looks calculados en el móvil, sin IA */
function looksAround(g,max=8,occasion=null){
 // «¿con qué me pongo esta prenda?», para cualquier ocasión o una concreta (Noelia, 10/10/2026). Cada look lleva sus motivos (l.reasons)
 return rankOutfits({required:g.id,max,occasion}).map(r=>Object.assign(r.garments,{reasons:r.reasons,warnings:r.warnings}));
}
/* Explorar looks por ocasión (idea de Noelia, 10/10/2026): varias propuestas, cada una con un núcleo distinto y sus versiones. Sin IA. */
/* Qué le falta al armario para montar un look de una ocasión (UX, 10/10/2026): mejor «te falta una parte de abajo» que «revisa las etiquetas» */
function missingFor(occ){const fit=g=>!occ||occasionFits(g,occ),n=c=>myGarments().filter(g=>g.category===c&&fit(g)).length,o=occ?" para «"+(occasions[occ]||occ).toLowerCase()+"»":"";
 if(n("Vestidos")||occ==="home"&&n("Casa")||occ==="beach"&&n("Baño"))return ""; /* el bañador o el pijama ya son un look entero (revisión de Codex, #205) */
 if(occ==="home")return "Todavía no tienes ropa de casa (pijama, chándal o ropa cómoda de estar por casa).";
 const t=n("Arriba"),b=n("Abajo");
 return !t&&!b?"Todavía no tienes prendas"+o+": añade una parte de arriba y una de abajo, o un vestido.":!b?"Te falta una parte de abajo"+o+" (pantalón, falda, vaquero…) o un vestido.":!t?"Te falta una parte de arriba"+o+" (camiseta, blusa, jersey…) o un vestido.":""}
const occsWithLooks=(skip,max=3,so={})=>EXPLORE_OCCS.filter(o=>o!==skip&&rankOutfits({occasion:o,max:1,...so}).length).slice(0,max); /* misma temporada que lo mostrado (revisión de Codex, #205) */
const EXPLORE_OCCS=["daily","work","party","event","formal","sport","beach","home"];
function renderExplore(root){
 const p=appState.data.preferences,avail=EXPLORE_OCCS.filter(o=>myGarments().some(g=>occasionFits(g,o)&&["Arriba","Abajo","Vestidos","Casa","Baño"].includes(g.category)));
 const occ=avail.includes(ui.exploreOcc)?ui.exploreOcc:avail.includes(p.occasion)?p.occasion:avail[0];
 /* la temporada elegida en «Hoy › Más opciones» manda; si es «Todo el año», hoy y su tiempo (revisión de Codex, #182) */
 const y=dayISO().slice(0,4),sd=p.season==="warm"?y+"-07-15":p.season==="cold"?y+"-01-15":null,so=sd?{date:sd,temp:SEASON_TEMP[p.season]}:{};
 const ctx=engineContext({occasion:occ,...so}),looks=occ?rankOutfits({occasion:occ,max:6,...so}):[],key=i=>"explore:"+occ+":"+i,shown=looks.map((l,i)=>pickedLook(key(i),l.garments,ctx));
 const body='<div class="explore-occs" role="group" aria-label="Ocasión">'+avail.map(o=>'<button type="button" class="chip-button'+(o===occ?' on':'')+'" aria-pressed="'+(o===occ)+'" data-explore-occ="'+o+'">'+fx(occasions[o]||o)+'</button>').join("")+'</div>'+
  '<p class="muted explore-note">'+fx(sd?seasons[p.season]+" ("+SEASON_TEMP[p.season]+" °C)":currentTemperature()+" °C")+' · cada propuesta usa una prenda principal distinta; debajo tienes sus versiones.</p>'+
  (looks.length?'<div class="grid">'+looks.map((l,i)=>{const gs=shown[i];return '<div class="look-tile"><article class="card">'+outfitBoard(gs)+'<div class="card-body"><div class="look-items">'+gs.map(x=>'<span class="look-chip">'+fx(x.name)+'</span>').join("")+'</div>'+(gs===l.garments&&l.reasons?.length?'<ul class="look-reasons">'+l.reasons.slice(0,2).map(r=>'<li>'+fx(r)+'</li>').join("")+'</ul>':'')+(gs===l.garments&&l.warnings?.length?'<ul class="look-reasons">'+l.warnings.map(w=>'<li class="warn">'+fx(w)+'</li>').join("")+'</ul>':'')+'</div></article>'+
   versionsRow(key(i),l.garments,ctx)+'<div class="tile-tools"><button class="chip-button" data-explore-save="'+i+'">♡ Guardar</button><button class="chip-button" data-explore-wear="'+i+'">✓ Llevado</button><button class="chip-button" data-explore-edit="'+i+'">✎ Editar</button><button class="chip-button" data-explore-almost="'+i+'">Casi</button></div></div>'}).join("")+'</div>'
  :(()=>{const miss=missingFor(occ),alt=occ?occsWithLooks(occ,3,so):[]; /* vacío útil: qué falta y qué ocasiones sí tienen looks */
   return '<div class="empty"><p class="muted">'+fx(miss||(occ?'Con '+(sd?SEASON_TEMP[p.season]:currentTemperature())+' °C no encuentro looks para «'+(occasions[occ]||occ).toLowerCase()+'». Revisa la temporada y cuánto abriga cada prenda en su ficha.':'Añade prendas de arriba y de abajo (o vestidos) para ver looks.'))+'</p>'+
    (alt.length?'<p class="muted">Sí tienes looks para:</p><div class="explore-occs">'+alt.map(o=>'<button type="button" class="chip-button" data-explore-occ="'+o+'">'+fx(occasions[o]||o)+'</button>').join("")+'</div>':'')+
    (miss?'<button type="button" class="primary" id="exploreAdd">+ Añadir prendas</button>':'')+'</div>'})());
 stylistShell(root,"Explorar looks","Todo lo que puedes ponerte, por ocasión, con versiones de cada look.",body);
 $("#exploreAdd",root)?.addEventListener("click",()=>{setView("wardrobe");openGarment()});
 $$("[data-explore-occ]",root).forEach(b=>b.addEventListener("click",()=>{ui.exploreOcc=b.dataset.exploreOcc;render()}));
 bindVersions(root);
 $$("[data-explore-save]",root).forEach(b=>b.addEventListener("click",async()=>{const gs=shown[Number(b.dataset.exploreSave)];if(!gs)return;const ids=gs.map(g=>g.id);
  if(myLooks().some(x=>lookSig(x.garmentIds||[])===lookSig(ids)))return toast("Ese look ya está guardado");
  await mutate(()=>myLooks().unshift({id:uid(),name:"Look de "+(occasions[occ]||occ).toLowerCase(),garmentIds:ids,occasion:occ,ai:false,updatedAt:new Date().toISOString()}),"Look guardado")}));
 $$("[data-explore-edit]",root).forEach(b=>b.addEventListener("click",()=>{const gs=shown[Number(b.dataset.exploreEdit)];if(gs)openLookEditor(gs.map(g=>g.id),{occasion:occ,name:"Mi look de "+(occasions[occ]||occ).toLowerCase()})}));
 $$("[data-explore-wear]",root).forEach(b=>b.addEventListener("click",()=>{const gs=shown[Number(b.dataset.exploreWear)];if(gs)promptWear(gs.map(g=>g.id),null)}));
 $$("[data-explore-almost]",root).forEach(b=>b.addEventListener("click",()=>{const gs=shown[Number(b.dataset.exploreAlmost)];if(gs)openAlmost(gs.map(g=>g.id),occ)}));
}
/* Elegir la prenda con fotos, por categoría (UX, 10/10/2026): con 100+ prendas, una lista desplegable no sirve */
const PICK_CATS=["Arriba","Abajo","Vestidos","Capas","Zapatos","Bolsos","Accesorios","Casa","Baño"];
function aroundPickerHtml(gs,sel){
 const img=g=>validImage(g.image)?photoUrl(g):pieceSketch(g);
 if(sel)return '<div class="pick-selected"><img src="'+img(sel)+'" alt=""><div><span class="muted">Combinar</span><strong>'+fx(sel.name)+'</strong></div><button type="button" class="chip-button" id="aroundChange">Cambiar</button></div>';
 const cats=PICK_CATS.filter(c=>gs.some(g=>g.category===c)),cat=cats.includes(ui.aroundCat)?ui.aroundCat:cats[0],items=gs.filter(g=>g.category===cat);
 return '<p class="field-label">¿Qué prenda quieres ponerte?</p><div class="explore-occs" role="group" aria-label="Tipo de prenda">'+cats.map(c=>'<button type="button" class="chip-button'+(c===cat?' on':'')+'" aria-pressed="'+(c===cat)+'" data-around-cat="'+c+'">'+fx(c)+'</button>').join("")+'</div>'+
  '<div class="pick-grid">'+items.map(g=>'<button type="button" class="pick-item" data-around-pick="'+fx(g.id)+'"><img src="'+img(g)+'" alt="" loading="lazy"><span>'+fx(g.name)+'</span></button>').join("")+'</div>'}
function renderAround(root){
 const gs=myGarments().slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),"es")),sel=gs.find(g=>g.id===ui.aroundId);
 const occs=sel?["daily","work","party","event","formal","sport","beach"].filter(o=>occasionFits(sel,o)):[],aocc=occs.includes(ui.aroundOcc)?ui.aroundOcc:null,mains=sel?looksAround(sel,8,aocc):[];
 const vctx=engineContext({occasion:aocc}),vkey=i=>"around:"+(sel?.id||"")+":"+(aocc||"all")+":"+i,looks=mains.map((l,i)=>pickedLook(vkey(i),l,vctx)); /* versiones: la elegida es la que se ve, se guarda y se registra */
 let body='<div class="feature-card" id="aroundCard"><div class="section-head"><h2>Combina una prenda</h2><span class="muted">Sin IA</span></div>'+
  extrasTogglesHtml()+aroundPickerHtml(gs,sel)+
  (occs.length>0?'<div class="explore-occs" role="group" aria-label="Ocasión">'+[[null,"Cualquier ocasión"],...occs.map(o=>[o,occasions[o]||o])].map(([k,t])=>'<button type="button" class="chip-button'+(k===aocc?' on':'')+'" aria-pressed="'+(k===aocc)+'" data-around-occ="'+(k||"")+'">'+fx(t)+'</button>').join("")+'</div>':'');
 if(sel)body+=looks.length?'<p class="muted">'+plural(looks.length,"combinación","combinaciones")+' con «'+fx(sel.name)+'», de mejor a peor combinación.</p><div class="grid">'+looks.map((l,i)=>'<div class="look-tile"><article class="card">'+outfitBoard(l)+'<div class="card-body"><div class="look-items">'+l.map(x=>'<span class="look-chip'+(x.id===sel.id?' new':'')+'">'+fx(x.name)+'</span>').join("")+'</div>'+(l.reasons?.length?'<ul class="look-reasons">'+l.reasons.map(r=>'<li>'+fx(r)+'</li>').join("")+'</ul>':'')+'</div></article>'+versionsRow(vkey(i),mains[i],vctx)+'<div class="tile-tools"><button class="chip-button" data-around-save="'+i+'">Guardar look</button><button class="chip-button" data-around-wear="'+i+'">✓ Llevado</button><button class="chip-button" data-around-edit="'+i+'">✎ Editar</button></div></div>').join("")+'</div>'
  :'<p class="muted">No encuentro combinaciones para esta prenda'+(aocc?' para «'+fx((occasions[aocc]||aocc).toLowerCase())+'». Prueba otra ocasión o':' con tu armario actual.')+' Mira «Recomendaciones» en Compras para ver qué le falta.</p>';
 stylistShell(root,"Tu estilista","Elige una prenda y te digo con qué ponértela.",body+'</div>');
 $$("[data-around-pick]",root).forEach(b=>b.addEventListener("click",()=>{ui.aroundId=b.dataset.aroundPick;ui.aroundOcc=null;render();$("#aroundCard")?.scrollIntoView({block:"start"})}));
 $$("[data-around-cat]",root).forEach(b=>b.addEventListener("click",()=>{ui.aroundCat=b.dataset.aroundCat;render()}));
 $("#aroundChange")?.addEventListener("click",()=>{ui.aroundCat=sel?.category||ui.aroundCat;ui.aroundId="";render()});
 $$("[data-around-occ]",root).forEach(b=>b.addEventListener("click",()=>{ui.aroundOcc=b.dataset.aroundOcc||null;render()}));
 bindExtrasToggles(root);bindVersions(root);
 $$("[data-around-save]",root).forEach(b=>b.addEventListener("click",async()=>{const l=looks[Number(b.dataset.aroundSave)];if(!l)return;
  const sig=l.map(x=>x.id).sort().join("|");if(myLooks().some(x=>(x.garmentIds||[]).slice().sort().join("|")===sig))return toast("Ese look ya está guardado");
  await mutate(()=>myLooks().unshift({id:uid(),name:"Con "+sel.name,garmentIds:l.map(x=>x.id),occasion:aocc||appState.data.preferences.occasion||"daily",ai:false,updatedAt:new Date().toISOString()}),"Look guardado")}));
 $$("[data-around-edit]",root).forEach(b=>b.addEventListener("click",()=>{const l=looks[Number(b.dataset.aroundEdit)];if(l)openLookEditor(l.map(x=>x.id),{occasion:aocc,name:"Mi look con "+sel.name})}));
 $$("[data-around-wear]",root).forEach(b=>b.addEventListener("click",()=>{const l=looks[Number(b.dataset.aroundWear)];if(l)promptWear(l.map(x=>x.id),null)}));
}
/* Tiempo de hoy con Open-Meteo (gratis, sin tokens). Por defecto, 25 °C. */
async function fetchTodayTemperature(ask){
 const p=appState.data.preferences;let pos=p.weatherPlace;
 if(!pos||ask)pos=await new Promise((res,rej)=>{if(!navigator.geolocation)return rej(new Error("NO_GEO"));navigator.geolocation.getCurrentPosition(x=>res({lat:Math.round(x.coords.latitude*100)/100,lon:Math.round(x.coords.longitude*100)/100}),e=>rej(e),{timeout:10000,maximumAge:3600000})});
 const r=await fetch("https://api.open-meteo.com/v1/forecast?latitude="+pos.lat+"&longitude="+pos.lon+"&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7"); /* 7 días: Mi semana usa la previsión de cada día */
 if(!r.ok)throw new Error("WEATHER_"+r.status);
 const d=await r.json(),max=d?.daily?.temperature_2m_max?.[0],min=d?.daily?.temperature_2m_min?.[0];
 if(typeof max!=="number"||typeof min!=="number")throw new Error("WEATHER_DATA");
 const week={},T=d?.daily?.time||[];T.forEach((day,i)=>{const a=d.daily.temperature_2m_max?.[i],b=d.daily.temperature_2m_min?.[i];if(typeof a==="number"&&typeof b==="number"&&validDay(day))week[day]=Math.round((a+b)/2)});
 Object.assign(p,{weatherWeek:week,weatherPlace:pos,temperature:Math.round((max+min)/2),weatherMin:Math.round(min),weatherMax:Math.round(max),weatherDay:dayISO(),autoWeather:true});
 await saveState({fromSync:true});return {mean:p.temperature,max:Math.round(max),min:Math.round(min)};
}
let weatherInFlight=false;
async function refreshWeatherIfNeeded(){
 const p=appState.data.preferences;
 if(weatherInFlight||!p.autoWeather||!p.weatherPlace||p.weatherDay===dayISO())return;
 weatherInFlight=true;
 try{await fetchTodayTemperature(false);if(appState.view==="today"||appState.view==="stylist")render()}catch(e){console.warn("WEATHER",e)}finally{weatherInFlight=false}
}

/* Mi semana: un look planificado por día (sin IA).
   Cada plan guarda su propia copia de prendas: cambiarlo no altera el look guardado del que salió.
   Planificado no es usado: solo «Me lo he puesto» lo pasa al historial (wearLog). Se sincroniza como lista (plans) con tomb al borrar. */
const myPlans=()=>appState.data.plans;
const planFor=date=>myPlans().find(p=>p.date===date);
const planGarments=p=>(p?.garmentIds||[]).map(id=>myGarments().find(g=>g.id===id)).filter(Boolean);
function weekStartOf(day){const d=new Date((validDay(day)?day:dayISO())+"T12:00:00");d.setDate(d.getDate()-(d.getDay()+6)%7);return dayISO(d)}
function addDays(day,n){const d=new Date(day+"T12:00:00");d.setDate(d.getDate()+n);return dayISO(d)}
const weekdayName=d=>new Intl.DateTimeFormat("es-ES",{weekday:"long"}).format(new Date(d+"T12:00:00"));
const capFirst=s=>s.charAt(0).toUpperCase()+s.slice(1);
/* «Planificar los días libres» (revisión nocturna): un núcleo distinto cada día, sin repetir prendas principales en la semana
   y variando calzado y bolso (las prendas de los días cercanos se evitan). Sin IA. */
function weekFillPlan(days){
 const today=dayISO(),plans=[],week=myPlans().filter(p=>days.includes(p.date)),skipN=new Set(week.map(p=>nucleusKey(planGarments(p)))),used=new Set(week.flatMap(p=>p.garmentIds||[])); /* lo ya planificado cuenta (revisión de Codex, #175) */
 for(const d of days){if(d<today||planFor(d))continue;
  const l=rankOutfits({date:d,max:1,avoid:new Set([...used,...dailyAvoid(d)]),skipNuclei:[...skipN]})[0];if(!l)break; /* sin núcleos distintos, mejor dejar el día libre que repetir (revisión de Codex, #175) */
  skipN.add(nucleusKey(l.garments));l.ids.forEach(id=>used.add(id));plans.push({date:d,ids:l.ids})}
 return plans;
}
async function fillWeek(days){
 const plans=weekFillPlan(days),free=days.filter(d=>d>=dayISO()&&!planFor(d)).length;if(!plans.length)return toast(free?"No encuentro combinaciones distintas para esos días":"No hay días libres que planificar");
 const now=new Date().toISOString();
 await mutate(()=>{for(const {date,ids} of plans){const id="plan:"+date;appState.data.plans=myPlans().filter(p=>{if(p.date!==date)return true;if(p.id!==id)tomb(p.id);return false});
  myPlans().push({id,date,garmentIds:[...ids],name:"Propuesta de Atelier",lookId:null,worn:false,updatedAt:now})}},plural(plans.length,"día planificado","días planificados")+(plans.length<free?"; para el resto no hay más combinaciones distintas.":". Puedes cambiar cualquiera."));
}
async function setPlan(date,garmentIds,{name,lookId}={}){
 const now=new Date().toISOString();
 // Id fijo por día: si dos móviles planifican el mismo día sin conexión, queda uno solo (el más reciente)
 return mutate(()=>{const id="plan:"+date;appState.data.plans=myPlans().filter(p=>{if(p.date!==date)return true;if(p.id!==id)tomb(p.id);return false});
  myPlans().push({id,date,garmentIds:[...garmentIds],name:String(name||"Look del día").slice(0,80),lookId:lookId||null,worn:false,updatedAt:now})},"Look planificado para el "+fmtDay(date));
}
/* Propuestas para un día (Hoy y Mi semana): motor común con la ocasión y la temperatura de esa fecha,
   evitando lo planificado en los días cercanos y lo que se pide evitar (avoid). */
/* Versiones de un look (idea de Noelia, 10/10/2026): el mismo núcleo (vestido, o arriba + abajo) con otra intención.
   Más informal, más arreglada, «si refresca» u otros zapatos. Solo cuentan si cambian el calzado o la capa (un complemento no basta),
   si combinan con todo, cumplen las reglas y puntúan cerca del principal. Sin relleno: si no hay ninguna a la altura, ninguna. */
const VERSION_GAP=6;
function lookVersions(main,ctxIn=null,max=3){
 ensureRelations();const ctx=ctxIn||engineContext(),nuc=nucleusOf(main);if(!nuc.length||!main.length)return [];
 const notes=pieceNotes(),usable=x=>!main.includes(x)&&seasonFits(x,ctx.season)&&(!ctx.occasion||occasionFits(x,ctx.occasion)&&!ctx.offOcc.has(x.id))&&!notes.disliked.has(x.id);
 const rel=(x,ys)=>ys.every(y=>(relationOf(x,y,ctx)?.s??1)>=REL_OK),rule=layerRule(ctx.temp);
 const shoe0=main.find(g=>g.category==="Zapatos")||null,layer0=main.find(g=>g.category==="Capas")||null,rest=main.filter(g=>!nuc.includes(g)&&g!==shoe0&&g!==layer0);
 const near=(cat,lim)=>myGarments().filter(x=>x.category===cat&&usable(x)&&rel(x,nuc)).map(x=>({x,m:nuc.reduce((t,y)=>t+(relationOf(x,y,ctx)?.s??.6),0)})).sort((a,b)=>b.m-a.m).slice(0,lim).map(o=>o.x);
 const shoes=shoe0?[shoe0,...near("Zapatos",6)]:[null];
 const r0=scoreOutfit(main,ctx),s0=r0.score,w0=r0.warnings,cold=!layer0&&w0.some(w=>/frío/i.test(w)); /* si el principal avisa de frío y no hay capa ligera, «Si refresca» puede ofrecer una algo más abrigada (vestido de fiesta sin mangas a 17 °C) */
 const layers=[layer0,...(rule.need?[]:[null]),...(rule.max>=0?near("Capas",4).filter(x=>warmthOf(x)<=rule.max+(cold?1:0)&&!insufficientColdLayer(x,ctx.temp)):[])].filter((x,i,a)=>a.indexOf(x)===i);
 const f0=shoe0?formalLevel(shoe0):null,sig0=lookSig(main.map(g=>g.id)),cands=[];
 for(const z of shoes)for(const c of layers){
  if(z===shoe0&&c===layer0)continue;
  const core=[...nuc,z,c].filter(Boolean),gs=[...core,...rest];
  if(!rest.every(r=>rel(r,core)))continue; /* sin quitar piezas a escondidas: una versión cambia una sola cosa (revisión de Codex, #171) */
  if(!core.every((x,i)=>rel(x,core.filter((_,j)=>j!==i)))||lookIssues(gs,ctx).length||!lookComplete(gs))continue;
  const r=scoreOutfit(gs,ctx);if(r.score<s0-VERSION_GAP||r.warnings.some(w=>!w0.includes(w)))continue; /* ningún aviso nuevo respecto al principal */
  cands.push({gs,score:r.score,f:z&&shoe0?formalLevel(z):null,sameLayer:c===layer0,sameShoe:z===shoe0,addsLayer:!layer0&&!!c,sig:lookSig(gs.map(g=>g.id))});
 }
 const out=[],take=(label,list)=>{const best=list.filter(v=>v.sig!==sig0&&!out.some(o=>o.sig===v.sig)).sort((a,b)=>b.score-a.score)[0];if(best&&out.length<max)out.push({...best,label})};
 /* cada intención cambia una sola cosa: el calzado (más informal / más arreglada / otros zapatos) o la capa (si refresca) */
 if(f0!=null){take("Más informal",cands.filter(v=>v.sameLayer&&v.f!=null&&f0-v.f>=.5));take("Más arreglada",cands.filter(v=>v.sameLayer&&v.f!=null&&v.f-f0>=.5))}
 if(ctx.temp>=12&&ctx.temp<24)take("Si refresca",cands.filter(v=>v.sameShoe&&v.addsLayer));
 if(out.length<2&&shoe0)take("Otros zapatos",cands.filter(v=>v.sameLayer&&!v.sameShoe&&(v.f==null||f0==null||Math.abs(v.f-f0)<.5))); /* p. ej. en una fiesta, otros tacones */
 return out.map(v=>({label:v.label,garments:v.gs,ids:v.gs.map(g=>g.id),score:v.score}));
}
function dayProposals(date,max=3,avoid=new Set(),seen=[],skipNuclei=[]){
 const near=myPlans().filter(p=>p.date!==date&&Math.abs(Date.parse(p.date)-Date.parse(date))<=3*86400000).flatMap(p=>p.garmentIds||[]);
 return rankOutfits({date,max,avoid:new Set([...avoid,...near]),seen,skipNuclei}).map(r=>Object.assign(r.garments,{reasons:r.reasons,warnings:r.warnings}));
}
function showSheet(id,html,onClose){
 const previous=$("#"+id);
 const origin=previous?previous.__returnFocus||document.activeElement:document.activeElement;
 if(previous)previous.remove();
 document.body.insertAdjacentHTML("beforeend",'<div id="'+id+'" class="overlay"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="'+id+'Title" tabindex="-1">'+html+'</section></div>');
 const el=$("#"+id),dialog=el.querySelector('[role="dialog"]');
 el.__returnFocus=origin;
 const focusable=()=>[...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>x.getClientRects().length>0&&!x.closest('[hidden],.hidden,[inert]'));
 const close=()=>{if(!el.isConnected)return;el.remove();onClose?.();if(origin?.isConnected&&typeof origin.focus==="function")origin.focus()};
 el.addEventListener("click",e=>{if(e.target===el)close()});
 el.addEventListener("keydown",e=>{
  if(e.key==="Escape"){e.preventDefault();close();return}
  if(e.key!=="Tab")return;
  const nodes=focusable();
  if(!nodes.length){e.preventDefault();dialog.focus();return}
  const first=nodes[0],last=nodes[nodes.length-1];
  if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){e.preventDefault();first.focus()}
 });
 $$("[data-close-sheet]",el).forEach(b=>b.addEventListener("click",close));
 setTimeout(()=>{if(el.isConnected)(focusable()[0]||dialog).focus()},0);
 return {el,close};
}
/* Versiones en cualquier lista de looks (Combinar prenda, Mis looks, Mi semana): la elección vive en la pantalla (no se guarda)
   y «Guardar», «Me lo pongo» o «Usar» actúan sobre la versión elegida */
const versionPick=new Map(),versionCache=new Map();
/* Clave de la caché de versiones (revisión de ChatGPT, #176): perfil, firma completa del armario y lo marcado (huella de relCache.sig, no su longitud),
   núcleo y contexto (fecha, ocasión, temperatura, temporada, estilo del día). La versión elegida se recuerda por su intención, no por su posición */
function versionsOf(key,mainGs,ctx){
 const c=ctx||engineContext(),sig=String(relCache.sig||"");let h=5381;for(let i=0;i<sig.length;i++)h=(h*33+sig.charCodeAt(i))|0;
 const prof=typeof appState!=="undefined"?appState.profile?.id||"":"";
 const k=[key,prof,h,sig.length,lookSig(mainGs.map(g=>g.id)),c.date,c.occasion,c.temp,c.season,c.dress].join("|");
 if(!versionCache.has(k)){if(versionCache.size>200)versionCache.clear();versionCache.set(k,lookVersions(mainGs,c))}return versionCache.get(k)}
function pickedVersion(key,mainGs,ctx){const label=versionPick.get(key);if(!label)return null;const v=versionsOf(key,mainGs,ctx).find(x=>x.label===label);if(!v)versionPick.delete(key);return v||null} /* si la intención ya no existe, vuelve al principal */
function pickedLook(key,mainGs,ctx){return pickedVersion(key,mainGs,ctx)?.garments||mainGs}
function versionsRow(key,mainGs,ctx){
 const vs=versionsOf(key,mainGs,ctx);if(!vs.length)return "";const pv=pickedVersion(key,mainGs,ctx),cur=pv?vs.indexOf(pv)+1:0;
 return '<div class="look-versions" role="group" aria-label="Versiones de este look">'+[{label:"Principal",garments:mainGs},...vs].map((v,i)=>{const diff=i?v.garments.filter(g=>!mainGs.includes(g)&&g.category!=="Bolsos"&&g.category!=="Accesorios"):mainGs.filter(g=>g.category==="Zapatos"||g.category==="Capas");
  return '<button type="button" class="look-version'+(i===cur?' on':'')+'" data-vkey="'+fx(key)+'" data-vlabel="'+(i?fx(v.label):"")+'" aria-pressed="'+(i===cur)+'"><span class="look-version-thumbs">'+diff.slice(0,2).map(g=>validImage(g.image)?'<img src="'+photoUrl(g)+'" alt="" loading="lazy">':'<span aria-hidden="true">◇</span>').join("")+'</span><span>'+fx(v.label)+'</span></button>'}).join("")+'</div>';
}
function bindVersions(root,rerender=render){$$("[data-vkey]",root).forEach(b=>b.addEventListener("click",()=>{if(b.dataset.vlabel)versionPick.set(b.dataset.vkey,b.dataset.vlabel);else versionPick.delete(b.dataset.vkey);rerender()}))}
const miniLook=(gs,extra="")=>'<div class="mini-look"><div class="mini-look-img">'+outfitBoard(gs)+'</div><div class="mini-look-body"><span class="muted">'+fx(gs.map(g=>g.name).join(" · "))+'</span>'+extra+'</div></div>';
function openPlanPicker(date){
 const props=dayProposals(date),pctx=engineContext({date}),saved=myLooks().filter(l=>lookComplete((l.garmentIds||[]).map(id=>myGarments().find(g=>g.id===id)))).slice(0,30);
 const {el,close}=showSheet("planSheet",'<div class="section-head"><h2 id="planSheetTitle">'+fx(capFirst(weekdayName(date))+" "+fmtDay(date))+'</h2><button type="button" class="secondary" data-close-sheet>Cerrar</button></div>'+
  '<h3>Propuestas para ese día</h3>'+extrasTogglesHtml()+(props.length?'<div class="plan-options">'+props.map((l,i)=>'<div class="plan-option-group">'+miniLook(pickedLook("plan:"+date+":"+i,l,pctx),'<button type="button" class="primary" data-plan-prop="'+i+'">Usar este look</button>')+versionsRow("plan:"+date+":"+i,l,pctx)+'</div>').join("")+'</div>':'<p class="muted">Añade prendas de arriba y de abajo (o vestidos) para recibir propuestas.</p>')+
  '<h3>Tus looks guardados</h3>'+(saved.length?'<div class="plan-options">'+saved.map((l,i)=>miniLook((l.garmentIds||[]).map(id=>myGarments().find(g=>g.id===id)).filter(Boolean),'<strong>'+fx(l.name)+'</strong><button type="button" class="secondary" data-plan-saved="'+i+'">Usar este look</button>')).join("")+'</div>':'<p class="muted">Todavía no tienes looks guardados.</p>'));
 bindExtrasToggles(el,()=>{close();openPlanPicker(date)});
 bindVersions(el,()=>{close();openPlanPicker(date)});
 $$("[data-plan-prop]",el).forEach(b=>b.addEventListener("click",async()=>{const i=Number(b.dataset.planProp),l=pickedLook("plan:"+date+":"+i,props[i],pctx);close();await setPlan(date,l.map(g=>g.id),{name:"Propuesta de Atelier"})}));
 $$("[data-plan-saved]",el).forEach(b=>b.addEventListener("click",async()=>{const l=saved[Number(b.dataset.planSaved)];close();await setPlan(date,l.garmentIds,{name:l.name,lookId:l.id})}));
}
function openPlanCopy(p){
 const ws=weekStartOf(p.date),days=[0,1,2,3,4,5,6].map(i=>addDays(ws,i)).filter(d=>d!==p.date);
 const {el,close}=showSheet("planSheet",'<div class="section-head"><h2 id="planSheetTitle">Copiar a otro día</h2><button type="button" class="secondary" data-close-sheet>Cerrar</button></div>'+
  '<p class="muted">'+fx(p.name)+'. Si ese día ya tiene un look, se sustituye.</p><div class="swap-picks">'+days.map(d=>'<button type="button" class="chip-button" data-copy-day="'+d+'">'+fx(capFirst(weekdayName(d)).slice(0,3)+" "+fmtDay(d))+(planFor(d)?" ·":"")+'</button>').join("")+'</div>'+
  '<label class="field"><span>Otra fecha</span><input type="date" id="copyDate" min="'+dayISO()+'"></label><button type="button" class="secondary wide" id="copyOther">Copiar a esa fecha</button>');
 const go=async d=>{if(!validDay(d))return toast("Elige una fecha válida");close();await setPlan(d,p.garmentIds,{name:p.name,lookId:p.lookId})};
 $$("[data-copy-day]",el).forEach(b=>b.addEventListener("click",()=>go(b.dataset.copyDay)));
 $("#copyOther",el).addEventListener("click",()=>go($("#copyDate",el).value));
}
async function planWorn(p){
 if(p.date>dayISO())return toast("Ese día todavía no ha llegado");
 const ids=p.garmentIds.filter(id=>myGarments().some(g=>g.id===id));if(!ids.length)return toast("No hay prendas para registrar");
 const now=new Date().toISOString();
 await mutate(()=>{logs().unshift({id:uid(),date:p.date,garmentIds:ids,lookId:p.lookId||null,updatedAt:now});p.worn=true;p.updatedAt=now},"Registrado como puesto");
}
function planCardHtml(p,{compact=false}={}){
 const gs=planGarments(p);
 return '<div class="plan-look">'+miniLook(gs,'<strong>'+fx(p.name)+'</strong>'+(p.worn?'<span class="badge-ok">✓ Te lo has puesto</span>':''))+
  '<div class="plan-actions">'+(!p.worn&&p.date<=dayISO()?'<button type="button" class="primary" data-plan-worn="'+fx(p.id)+'">Me lo he puesto</button>':'')+
  (compact?'':'<button type="button" class="chip-button" data-plan-swap="'+fx(p.id)+'">↻ Cambiar prenda</button><button type="button" class="chip-button" data-plan-change="'+fx(p.date)+'">Cambiar look</button><button type="button" class="chip-button" data-plan-copy="'+fx(p.id)+'">Copiar a…</button><button type="button" class="chip-button" data-plan-remove="'+fx(p.id)+'">Quitar</button>')+'</div></div>';
}
function bindPlanActions(root){
 const find=id=>myPlans().find(p=>p.id===id);
 $$("[data-plan-worn]",root).forEach(b=>b.addEventListener("click",()=>{const p=find(b.dataset.planWorn);if(p)planWorn(p)}));
 $$("[data-plan-swap]",root).forEach(b=>b.addEventListener("click",()=>openSwap(b.dataset.planSwap,"plan")));
 $$("[data-plan-change]",root).forEach(b=>b.addEventListener("click",()=>openPlanPicker(b.dataset.planChange)));
 $$("[data-plan-copy]",root).forEach(b=>b.addEventListener("click",()=>{const p=find(b.dataset.planCopy);if(p)openPlanCopy(p)}));
 $$("[data-plan-remove]",root).forEach(b=>b.addEventListener("click",async()=>{const p=find(b.dataset.planRemove);if(!p)return;await mutate(()=>{appState.data.plans=myPlans().filter(x=>x!==p);tomb(p.id)},"Look quitado del día")}));
 $$("[data-plan-pick]",root).forEach(b=>b.addEventListener("click",()=>openPlanPicker(b.dataset.planPick)));
}
function renderWeek(root){
 const ws=ui.weekStart||weekStartOf(dayISO()),days=[0,1,2,3,4,5,6].map(i=>addDays(ws,i)),today=dayISO();
 const range=fmtDay(days[0])+" – "+fmtDay(days[6]);
 stylistShell(root,"Mi semana","Planifica qué te pondrás cada día. Lo planificado no cuenta como usado hasta que pulses «Me lo he puesto».",
  '<div class="week-nav"><button type="button" class="secondary" id="weekPrev" aria-label="Semana anterior">‹</button><strong>'+fx(range)+'</strong><button type="button" class="secondary" id="weekNext" aria-label="Semana siguiente">›</button></div>'+
  (ws!==weekStartOf(today)?'<button type="button" class="chip-button" id="weekToday">Volver a esta semana</button>':'')+
  (days.some(d=>d>=today&&!planFor(d))?'<button type="button" class="primary wide" id="weekFill">✦ Planificar los días libres</button>':'')+
  '<div class="week-list">'+days.map(d=>{const p=planFor(d);return '<section class="day-card'+(d===today?' is-today':'')+'" aria-label="'+fx(capFirst(weekdayName(d))+" "+fmtDay(d))+'"><div class="day-head"><strong>'+fx(capFirst(weekdayName(d)))+'</strong><span class="muted">'+fx(fmtDay(d))+(d===today?' · hoy':'')+'</span></div>'+
   (p?planCardHtml(p):d<today?(()=>{const worn=logs().filter(l=>l.date===d),nm=id=>myGarments().find(g=>g.id===id)?.name; /* días pasados: lo que llevaste, o apuntarlo (no se planifica el pasado) */
    return worn.length?worn.map(l=>'<p class="muted day-worn">Llevaste: '+fx((l.garmentIds||[]).map(nm).filter(Boolean).join(" · ")||"un look")+'</p>').join(""):'<button type="button" class="chip-button" data-plan-pick="'+d+'">+ Apuntar lo que llevé</button>'})():(d===today?logs().filter(l=>l.date===d).map(l=>'<p class="muted day-worn">Llevaste: '+fx((l.garmentIds||[]).map(id=>myGarments().find(g=>g.id===id)?.name).filter(Boolean).join(" · ")||"un look")+'</p>').join(""):"")+'<button type="button" class="secondary wide" data-plan-pick="'+d+'">+ Elegir look</button>')+'</section>'}).join("")+'</div>');
 $("#weekPrev").addEventListener("click",()=>{ui.weekStart=addDays(ws,-7);render()});
 $("#weekNext").addEventListener("click",()=>{ui.weekStart=addDays(ws,7);render()});
 $("#weekToday")?.addEventListener("click",()=>{ui.weekStart=weekStartOf(today);render()});
 $("#weekFill")?.addEventListener("click",()=>fillWeek(days));
 bindPlanActions(root);
}
/* Tu look de hoy: una propuesta completa nada más entrar, según el tiempo de tu zona (o 25 °C), sin IA.
   Cambia cada día: evita las prendas de los looks del día de los 3 días anteriores y lo que te has puesto hace poco.
   «Otro look» pasa a la siguiente propuesta distinta. Se guarda en preferences.dailyLook (se sincroniza). */
function dailyAvoid(date){
 const p=appState.data.preferences,prev=(p.dailyHistory||[]).filter(h=>h.date<date&&h.date>=addDays(date,-3)).flatMap(h=>h.ids||[]);
 const worn=logs().filter(l=>validDay(l.date)&&l.date<date&&l.date>=addDays(date,-3)).flatMap(l=>l.garmentIds||[]);
 return new Set([...prev,...worn]);
}
function computeDaily(date,skip=[],skipN=[]){
 // «Otro look»: otro núcleo (revisión de ChatGPT, #171); además evita (penaliza) las prendas de los looks ya vistos hoy
 const seenIds=skip.flatMap(sig=>sig.split("|"));
 return dayProposals(date,1,new Set([...dailyAvoid(date),...seenIds]),skip,skipN)[0]||dayProposals(date,1,dailyAvoid(date),skip,skipN)[0]||null;
}
let dailyDirty=false;
/* Lo que eliges al ponerte un look (principal o una versión) se cuenta por perfil; si una intención domina, se propone directamente */
function favoriteIntent(){const t=appState.data.preferences.versionTaste||{},n=Object.values(t).reduce((a,b)=>a+(Number(b)||0),0);if(n<3)return null;const [k,v]=Object.entries(t).sort((a,b)=>b[1]-a[1])[0];return v/n>=.6&&k!=="Principal"?k:null}
function chosenVersionLabel(d){const mainGs=(d.main?.length?d.main:d.ids||[]).map(id=>myGarments().find(g=>g.id===id)).filter(Boolean);if(lookSig(d.ids||[])===lookSig(mainGs.map(g=>g.id)))return "Principal";return lookVersions(mainGs,engineContext()).find(v=>lookSig(v.ids)===lookSig(d.ids||[]))?.label||null}
function ensureDailyLook(force=false){
 const p=appState.data.preferences,today=dayISO(),temp=currentTemperature();let d=p.dailyLook;
 const wsig=myGarments().length+"|"+myGarments().reduce((m,g)=>String(g.updatedAt||"")>m?String(g.updatedAt||""):m,"")+"|"+(p.dressStyle||"")+"|"+workDress(); // cambiar el código de vestir rehace el look del día (revisión de Codex, #139)
 const stale=!d||d.date!==today||!d.ids?.length||(!d.touched&&(Math.abs((d.temp??temp)-temp)>=5||d.wsig!==wsig));
 if(!stale&&!force)return d;
 dailyDirty=true;
 if(d&&validDay(d.date)&&d.date!==today&&d.ids?.length){p.dailyHistory=[...(p.dailyHistory||[]).filter(h=>h.date>=addDays(today,-7)),{date:d.date,ids:d.ids}].slice(-7)}
 const same=force&&d?.date===today,cur=same?(d.main?.length?d.main:d.ids||[]).map(id=>myGarments().find(g=>g.id===id)).filter(Boolean):[];
 const skip=same?[...(d.skip||[]),lookSig(d.ids||[]),...(d.main?.length?[lookSig(d.main)]:[])]:[],skipN=same?[...(d.skipN||[]),...(cur.length?[nucleusKey(cur)]:[])]:[];
 let l=computeDaily(today,skip,skipN),wrapped=false;
 if(!l&&skip.length){wrapped=true;l=computeDaily(today,[],[]);if(l)toast("Ya has visto todas las propuestas de hoy: vuelvo a empezar")}
 d=p.dailyLook={date:today,ids:l?l.map(g=>g.id):[],main:l?l.map(g=>g.id):[] /* look principal: sus versiones se calculan sobre él */,temp,wsig,skip:wrapped?[]:skip,skipN:wrapped?[]:skipN,touched:force||d?.date===today&&!!d?.touched,worn:false};
 const fav=favoriteIntent(),fv=fav&&l?lookVersions(l,engineContext()).find(v=>v.label===fav):null;if(fv){d.ids=[...fv.ids];d.byTaste=fav} /* tu versión de siempre, ya elegida */
 return d;
}
function weatherLabel(){
 const p=appState.data.preferences;
 if(p.autoWeather&&p.weatherDay===dayISO())return (p.weatherMin!=null&&p.weatherMax!=null?p.weatherMin+"–"+p.weatherMax+" °C":p.temperature+" °C")+" en tu zona";
 return p.autoWeather?"Actualizando el tiempo…":currentTemperature()+" °C"+(currentTemperature()===DEFAULT_TEMPERATURE?" (por defecto)":"");
}
function dailyLookHtml(){
 const t=planFor(dayISO()),p=appState.data.preferences;
 const weather='<p class="daily-weather muted">'+fx(weatherLabel())+' · <button type="button" class="link-button" id="dailyWeather">'+(p.autoWeather?'↻ Actualizar ubicación':'📍 Usar el tiempo de mi zona')+'</button></p>';
 const occRow='<label class="daily-occasion-field"><span>Ocasión</span><select id="dailyOccasion" aria-label="Ocasión del look de hoy">'+optionList(Object.entries(occasions),p.occasion||"daily")+'</select></label>';
 if(t)return '<section class="feature-card daily-look"><div class="section-head"><h2>Tu look de hoy</h2><span class="muted">Planificado</span></div>'+weather+planCardHtml(t)+'</section>';
 const d=ensureDailyLook(),gs=(d.ids||[]).map(id=>myGarments().find(g=>g.id===id)).filter(Boolean),why=gs.length?scoreOutfit(gs,engineContext()):null;
 if(gs.length<1){const occ=appState.data.preferences.occasion,other=occ&&rankOutfits({max:1,occasion:null}).length;
  return '<section class="feature-card daily-look"><div class="section-head"><h2>Tu look de hoy</h2></div>'+weather+occRow+(other?'<p class="muted">'+fx(missingFor(occ)||'No encuentro un look para «'+(occasions[occ]||occ).toLowerCase()+'» con tu armario.')+' Mientras, tienes looks para otras ocasiones en Explorar.</p><button type="button" class="secondary" id="dailyExplore">Ver looks en Explorar</button>':lookComplete(myGarments())&&rankOutfits({max:1,occasion:null,temp:20}).length?'<p class="muted">Con '+fx(currentTemperature())+' °C no encuentro prendas adecuadas en tu armario. Revisa la temporada y cuánto abriga cada prenda en su ficha, o ajusta la temperatura desde el tiempo de hoy.</p>':lookComplete(myGarments())?'<p class="muted">Tus prendas de arriba y de abajo todavía no combinan entre sí (por ejemplo, ropa de deporte con ropa de fiesta). Revisa sus etiquetas o añade alguna prenda básica.</p><button type="button" class="primary" id="dailyAdd">+ Añadir prendas</button>':'<p class="muted">Empieza por varias prendas que puedas combinar: partes de arriba y de abajo (o vestidos), calzado y alguna capa. Así podré elegir looks que tengan sentido.</p><button type="button" class="primary" id="dailyAdd">+ Añadir prendas</button>')+'</section>'}
 const mainGs=(d.main?.length?d.main:d.ids).map(id=>myGarments().find(g=>g.id===id)).filter(Boolean),versions=mainGs.length?lookVersions(mainGs,engineContext()):[];
 const opts=versions.length?[{label:"Principal",ids:mainGs.map(g=>g.id),garments:mainGs},...versions]:[],cur=lookSig(d.ids||[]);
 const versionsHtml=opts.length?'<div class="look-versions" role="group" aria-label="Versiones de este look">'+opts.map((v,i)=>{const on=lookSig(v.ids)===cur,diff=v.garments.filter(g=>!mainGs.includes(g)&&g.category!=="Bolsos"&&g.category!=="Accesorios");
   return '<button type="button" class="look-version'+(on?' on':'')+'" data-version="'+i+'" aria-pressed="'+on+'"><span class="look-version-thumbs">'+(i?diff:mainGs.filter(g=>g.category==="Zapatos"||g.category==="Capas")).slice(0,2).map(g=>validImage(g.image)?'<img src="'+photoUrl(g)+'" alt="" loading="lazy">':'<span aria-hidden="true">◇</span>').join("")+'</span><span>'+fx(v.label)+'</span></button>'}).join("")+'</div>':'';
 const tasteNote=d.byTaste&&lookSig(d.ids||[])!==lookSig(mainGs.map(g=>g.id))&&chosenVersionLabel(d)===d.byTaste?'<p class="muted version-note">Te muestro la versión «'+fx(d.byTaste.toLowerCase())+'» porque es la que más eliges.</p>':'';
 return '<section class="feature-card daily-look"><div class="section-head"><h2>Tu look de hoy</h2></div>'+weather+occRow+
  '<div class="daily-board">'+outfitBoard(gs)+'</div>'+versionsHtml+tasteNote+'<div class="look-items">'+gs.map(g=>'<span class="look-chip">'+fx(g.name)+'</span>').join("")+'</div>'+
  (why?.reasons.length||why?.warnings.length?'<ul class="look-reasons">'+why.reasons.map(r=>'<li>'+fx(r)+'</li>').join("")+why.warnings.map(w=>'<li class="warn">'+fx(w)+'</li>').join("")+'</ul>':'')+
  '<div class="daily-actions">'+(d.worn||logs().some(x=>x.date===dayISO()&&lookSig(x.garmentIds||[])===lookSig(d.ids||[]))?'<span class="badge-ok">✓ Te lo has puesto hoy</span>':'<button type="button" class="primary" id="dailyWear">Me lo pongo</button>')+
  '<button type="button" class="secondary" id="dailyNext">↻ Otro look</button></div>'+
  '<div class="plan-actions"><button type="button" class="chip-button" id="dailySave">♡ Guardar en Mis looks</button><button type="button" class="chip-button" id="dailyEdit">✎ Editar</button><button type="button" class="chip-button" id="dailyAlmost">Casi: algo no me cuadra</button></div></section>';
}
/* «Casi»: marcar la prenda que no cuadra y por qué. Sin IA: lo aprende el motor del perfil (pieceNotes) */
function openAlmost(ids,occasion,onDone){
 const gs=ids.map(id=>myGarments().find(g=>g.id===id)).filter(Boolean),off=new Set(),why=new Set();if(!gs.length)return;
 const body=()=>'<div class="section-head"><h2 id="almostSheetTitle">¿Qué no te cuadra?</h2><button type="button" class="secondary" data-close-sheet>Cerrar</button></div>'+
  '<p class="muted">Toca la prenda (o las prendas) y, si quieres, di por qué. Solo cambia tus propuestas, no las de nadie más.</p>'+
  '<div class="almost-pieces">'+gs.map(g=>'<button type="button" class="almost-piece'+(off.has(g.id)?' off':'')+'" data-almost-piece="'+fx(g.id)+'" aria-pressed="'+off.has(g.id)+'">'+(validImage(g.image)?'<img src="'+photoUrl(g)+'" alt="" loading="lazy">':'<span aria-hidden="true">◇</span>')+'<span>'+fx(g.name||g.category)+'</span></button>').join("")+'</div>'+
  '<div class="almost-why" role="group" aria-label="Por qué (opcional)">'+ALMOST_WHY.map(([k,t])=>'<button type="button" class="chip-button'+(why.has(k)?' on':'')+'" data-almost-why="'+k+'" aria-pressed="'+why.has(k)+'">'+t+'</button>').join("")+'</div>'+
  '<div class="actions"><button type="button" class="primary wide" id="almostSave"'+(off.size?'':' disabled')+'>Guardar</button></div>';
 const {el,close}=showSheet("almostSheet",body());
 const bind=()=>{
  $$("[data-almost-piece]",el).forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.almostPiece;off.has(id)?off.delete(id):off.add(id);redraw()}));
  $$("[data-almost-why]",el).forEach(b=>b.addEventListener("click",()=>{const k=b.dataset.almostWhy;why.has(k)?why.delete(k):why.add(k);redraw()}));
  $$("[data-close-sheet]",el).forEach(b=>b.addEventListener("click",close));
  $("#almostSave",el)?.addEventListener("click",async()=>{if(!almostLearns(gs,[...off],[...why]))return toast("Con una sola prenda, elige «No me gusta la prenda», «No es para esta ocasión» o «Sobra»");const ok=await mutate(()=>saveAlmost(gs,[...off],[...why],occasion),"Gracias: lo tendré en cuenta en tus propuestas");if(ok){close();onDone?.()}});
 };
 const redraw=()=>{$(".sheet",el).innerHTML=body();bind()};bind();
}
function bindDailyLook(root){
 const p=appState.data.preferences,today=dayISO();
 if(dailyDirty){dailyDirty=false;saveState().catch(()=>{})}
 $("#dailyAdd",root)?.addEventListener("click",()=>setView("wardrobe"));
 $("#dailyOccasion",root)?.addEventListener("change",e=>{const o=e.target.value;if(!(o in occasions)||o===(p.occasion||"daily"))return;const d=p.dailyLook;if(d)d.date=null;setPref("occasion",o,true)}); /* elegir ocasión rehace el look de hoy */
 $("#dailyExplore",root)?.addEventListener("click",()=>{ui.stylistTab="explore";setView("stylist")});
 $("#dailyNext",root)?.addEventListener("click",async()=>{ensureDailyLook(true);await saveState();render()});
 $$("[data-version]",root).forEach(b=>b.addEventListener("click",async()=>{const d=p.dailyLook;if(!d?.ids?.length)return;
  const mainGs=(d.main?.length?d.main:d.ids).map(id=>myGarments().find(g=>g.id===id)).filter(Boolean),i=Number(b.dataset.version),v=i?lookVersions(mainGs,engineContext())[i-1]:{ids:mainGs.map(g=>g.id)};
  if(!v)return;if(!d.main?.length)d.main=mainGs.map(g=>g.id);d.ids=[...v.ids];d.worn=logs().some(x=>x.date===dayISO()&&lookSig(x.garmentIds||[])===lookSig(v.ids)) /* otra versión: «me lo pongo» vuelve a estar disponible (revisión de Codex, #171) */;d.touched=true;await saveState();render()}));
 $("#dailyAlmost",root)?.addEventListener("click",()=>{const d=p.dailyLook;if(!d?.ids?.length)return;openAlmost(d.ids,p.occasion||"daily",async()=>{ensureDailyLook(true);await saveState();render()})});
 $("#dailyWear",root)?.addEventListener("click",async()=>{const d=p.dailyLook;if(!d?.ids?.length)return;const now=new Date().toISOString(),label=chosenVersionLabel(d);
  await mutate(()=>{if(label)p.versionTaste={...(p.versionTaste||{}),[label]:((p.versionTaste||{})[label]||0)+1};logs().unshift({id:uid(),date:today,garmentIds:[...d.ids],lookId:null,updatedAt:now});d.worn=true;d.touched=true},"Registrado: te lo has puesto hoy")});
 $("#dailySave",root)?.addEventListener("click",async()=>{const d=p.dailyLook;if(!d?.ids?.length)return;
  if(myLooks().some(l=>lookSig(l.garmentIds||[])===lookSig(d.ids)))return toast("Ese look ya está guardado");
  await mutate(()=>{d.touched=true;myLooks().unshift({id:uid(),name:"Look del "+fmtDay(today),garmentIds:[...d.ids],occasion:p.occasion||"daily",ai:false,updatedAt:new Date().toISOString()})},"Look guardado")});
 // Cambiar una prenda: el look de hoy pasa a ser el plan de hoy, y se abre «Cambiar prenda» sobre él
 $("#dailyEdit",root)?.addEventListener("click",()=>{const d=p.dailyLook;if(!d?.ids?.length)return;openLookEditor(d.ids,{occasion:p.occasion||"daily",name:"Mi look del "+fmtDay(today),onSaved:async ids=>{d.ids=[...ids];d.touched=true;d.worn=false;await saveState();render()}})});
 $("#dailySwap",root)?.addEventListener("click",async()=>{const d=p.dailyLook;if(!d?.ids?.length)return;d.touched=true;
  if(await setPlan(today,d.ids,{name:"Look de hoy"})){const t=planFor(today);if(t)openSwap(t.id,"plan")}});
 $("#dailyWeather",root)?.addEventListener("click",async e=>{e.target.disabled=true;e.target.textContent="Consultando…";
  try{await fetchTodayTemperature(true);render()}catch(err){console.warn("WEATHER",err);toast(err?.code===1?"Sin permiso de ubicación: uso "+currentTemperature()+" °C":"No se pudo consultar el tiempo");e.target.disabled=false;e.target.textContent=p.autoWeather?"↻ Actualizar ubicación":"📍 Usar el tiempo de mi zona"}});
}
/* En «Hoy»: lo planificado para hoy y mañana */
function plannedTodayHtml(){
 const m=planFor(shiftDay(1));
 if(!m)return '<div class="plan-link"><button type="button" class="link-button" data-open-week>Planificar mi semana ›</button></div>';
 return '<div class="feature-card plan-today"><div class="section-head"><h2>Mañana</h2><button type="button" class="chip-button" data-open-week>Mi semana ›</button></div>'+planCardHtml(m,{compact:true})+'</div>';
}

/* Maletas: lista de equipaje por viaje, calculada en el móvil (sin IA).
   La sugerencia elige pocas prendas que den al menos un look por día del viaje. */
const PACK_EXTRAS=["Ropa interior y calcetines","Neceser","Cargador del móvil","Documentación"];
const PACK_ORDER=["Arriba","Abajo","Vestidos","Capas","Zapatos","Casa","Baño","Bolsos","Accesorios",""];
const myTrips=()=>appState.data.trips;
const fmtDay=d=>validDay(d)?new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"short",year:d.slice(0,4)===dayISO().slice(0,4)?undefined:"numeric"}).format(new Date(d+"T12:00:00")):"";
function tripDays(t){if(!validDay(t.start)||!validDay(t.end)||t.end<t.start)return 1;return Math.round((Date.parse(t.end+"T12:00:00")-Date.parse(t.start+"T12:00:00"))/86400000)+1}
function seasonFor(day){return SEASON3(validDay(day)?Number(day.slice(5,7))-1:new Date().getMonth())}
const SEASON_LABEL={warm:"Calor",mid:"Entretiempo",cold:"Frío"};
const fitsSeason=(g,season)=>seasonFits(g,season);
const tripItems=t=>(t.garmentIds||[]).map(id=>myGarments().find(g=>g.id===id)).filter(Boolean);
/* Looks posibles con lo que va en la maleta: arriba + abajo, o vestido; con calzado y capa si encajan */
/* maleta: solo parejas que combinan de verdad, con el gusto del perfil (revisiones general y de Codex, #180) */
const packCtx=()=>engineContext({occasion:null}),packRel=(a,b,ctx)=>(relationOf(a,b,ctx)?.s??1)>=REL_OK;
function packLooks(items,ctx=packCtx()){
 ensureRelations();const looks=[],rel=(a,b)=>packRel(a,b,ctx);
 for(const t of items.filter(g=>g.category==="Arriba"))for(const b of items.filter(g=>g.category==="Abajo"))if(pairs(t,b)&&rel(t,b))looks.push([t,b]);
 for(const d of items.filter(g=>g.category==="Vestidos"))looks.push([d]);
 return looks.map(l=>{const out=[...l];for(const cat of ["Zapatos","Capas"]){const x=items.find(g=>g.category===cat&&out.every(p=>pairs(g,p)&&rel(g,p)));if(x)out.push(x)}return out});
}
function suggestPacking(t){
 ensureRelations();
 const season=seasonFor(t.start),days=tripDays(t),all=myGarments().filter(g=>fitsSeason(g,season));
 const core=all.filter(g=>["Arriba","Abajo","Vestidos"].includes(g.category)),chosen=[],max=Math.min(12,days+4);
 const pctx=packCtx(),looksOf=list=>packLooks(list,pctx).length;
 // Versatilidad: con cuántas prendas complementarias combina (desempata cuando aún no suma looks)
 const partner={Arriba:"Abajo",Abajo:"Arriba"},versatility=g=>core.filter(o=>o.category===partner[g.category]&&goes(g,o)).length;
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
 const looks=packLooks(chosen,pctx).map(l=>l.filter(x=>["Arriba","Abajo","Vestidos"].includes(x.category)));
 const fitsAll=(g,l)=>l.every(p=>pairs(g,p)&&packRel(g,p,pctx)); /* mismo criterio que los looks de ejemplo (revisión de Codex, #180) */
 const coverBest=(cat,need)=>{const opts=all.filter(g=>g.category===cat&&!chosen.includes(g));let best=null,n=0;for(const g of opts){const c=need.filter(l=>fitsAll(g,l)).length;if(c>n){best=g;n=c}}return best?{g:best,covers:need.filter(l=>fitsAll(best,l))}:null};
 let pending=looks;
 for(let i=0;i<2&&pending.length;i++){const s=coverBest("Zapatos",pending);if(!s)break;if(i===1&&s.covers.length<pending.length/2&&pending.length<looks.length/2)break;chosen.push(s.g);pending=pending.filter(l=>!s.covers.includes(l))}
 if(season!=="warm"){const c=coverBest("Capas",looks);if(c)chosen.push(c.g)}  // frío o entretiempo, según las fechas del viaje
 const bag=coverBest("Bolsos",looks);if(bag)chosen.push(bag.g);
 const rest=all.find(g=>g.category==="Casa"&&!chosen.includes(g));if(rest)chosen.push(rest);
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
  '<button class="primary wide" type="submit">✦ Preparar maleta</button></form>'+(missingFor(null)?'<p class="notice-card">'+fx(missingFor(null))+' Así podré proponerte qué llevar.</p>':'')+
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
 stylistShell(root,t.name,(validDay(t.start)?fmtDay(t.start)+" – "+fmtDay(t.end)+" · ":"")+plural(days,"día","días")+" · "+SEASON_LABEL[season],
  '<div class="actions"><button class="secondary" id="tripBack">← Mis maletas</button><button class="secondary" id="tripResuggest">✦ Volver a sugerir</button></div>'+
  '<div class="stats">'+miniStat("prendas",items.length)+miniStat("looks posibles",looks)+'</div>'+
  (items.length&&looks<days?'<p class="notice-card">Con estas prendas tienes '+plural(looks,"look","looks")+' para '+plural(days,"día","días")+'. Repetirás alguno, o añade más prendas.</p>':'')+
  (!items.length?'<p class="notice-card">No he encontrado prendas de '+fx(SEASON_LABEL[season].toLocaleLowerCase("es"))+' que combinen entre sí. Añádelas a mano abajo.</p>':'')+
  '<div class="feature-card"><div class="section-head"><h2>Equipaje</h2><span class="muted">'+ready+' de '+total+'</span></div>'+
  '<div class="progress-track"><div style="width:'+(total?Math.round(100*ready/total):0)+'%"></div></div>'+
  '<div class="pack-list">'+sorted.map(g=>'<div class="pack-row"><input type="checkbox" data-pack="'+fx(g.id)+'" aria-label="Preparada: '+fx(g.name)+'"'+(t.packed?.[g.id]?' checked':'')+'><span class="pack-thumb"'+(validImage(g.image)?' style="background-image:url('+photoUrl(g)+')"':'')+'></span><span class="pack-name">'+fx(g.name)+'<small class="muted">'+fx(g.category||"")+'</small></span><button class="chip-button" data-unpack="'+fx(g.id)+'" aria-label="Quitar '+fx(g.name)+'">✕</button></div>').join("")+'</div>'+
  (others.length?'<div class="pack-add"><select id="tripAddSelect" aria-label="Prenda para añadir">'+optionList([["","Añadir otra prenda…"],...others.map(g=>[g.id,g.name+(g.category?" · "+g.category:"")])],"")+'</select><button class="secondary" id="tripAdd">Añadir</button></div>':'')+
  '<h3 class="mini-title">Además</h3><div class="pack-list">'+extras.map(x=>'<div class="pack-row extra"><input type="checkbox" data-extra="'+fx(x.id)+'" aria-label="Preparado: '+fx(x.text)+'"'+(x.done?' checked':'')+'><span class="pack-name">'+fx(x.text)+'</span><button class="chip-button" data-extra-remove="'+fx(x.id)+'" aria-label="Quitar '+fx(x.text)+'">✕</button></div>').join("")+'</div>'+
  '<form id="extraForm" class="pack-add"><input id="extraText" maxlength="60" placeholder="Añadir algo (gafas de sol, bañador…)" aria-label="Otra cosa para la maleta"><button class="secondary" type="submit">Añadir</button></form></div>'+
  (examples.length?'<div class="section-head"><h2>Looks con tu maleta</h2></div><div class="grid">'+examples.map((l,i)=>{return '<div class="look-tile"><article class="card">'+outfitBoard(l)+'<div class="card-body"><div class="look-items">'+l.map(x=>'<span class="look-chip">'+fx(x.name)+'</span>').join("")+'</div></div></article><div class="tile-tools"><button class="chip-button" data-trip-look="'+i+'">Guardar look</button></div></div>'}).join("")+'</div>':'')+
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
  await mutate(()=>myLooks().unshift({id:uid(),name:"Viaje: "+t.name,garmentIds:l.map(x=>x.id),occasion:"daily",ai:false,updatedAt:new Date().toISOString()}),"Look guardado")}));
 $("#tripDelete")?.addEventListener("click",async()=>{if(!confirm("¿Eliminar la maleta «"+t.name+"»?"))return;const id=t.id;if(await mutate(()=>{appState.data.trips=myTrips().filter(x=>x.id!==id);tomb(id)},"Maleta eliminada")){ui.tripId="";render()}});
}

/* ===================== 8. Compras ===================== */
let buyCheck=null;
function evaluateCandidate(c){
 ensureRelations();
 const gs=myGarments(),clothes=!c.category||isClothes(c),bases=clothes?[]:basesFor(c,lookBases(gs));
 const compatible=clothes?gs.filter(g=>isClothes(g)&&goes(c,g)):[...new Set(bases.flat())],core=clothes?compatible.filter(g=>!c.category||(CORE[c.category]||[]).includes(g.category)):bases;
 const duplicates=gs.filter(g=>isDuplicate(c,g)),rescued=gs.filter(g=>goes(c,g)&&gs.filter(o=>goes(g,o)).length<2);
 const reasons=[];let verdict,tone;
 if(duplicates.length>=2){verdict="No lo necesitas";tone="bad";reasons.push("Ya tienes "+duplicates.length+" prendas muy parecidas.")}
 else if(core.length>=3&&!duplicates.length){verdict="Cómpralo";tone="good";reasons.push(clothes?"Combina con "+plural(compatible.length,"prenda","prendas")+" de ropa de tu armario.":"Completa "+plural(bases.length,"look","looks")+" de tu armario (arriba + abajo, o vestido).")}
 else if(core.length>=3){verdict="Piénsalo";tone="mid";reasons.push("Encaja bien, pero se parece a «"+duplicates[0].name+"».")}
 else{verdict="Piénsalo";tone="mid";reasons.push(!clothes?(bases.length?"Solo completa "+plural(bases.length,"look","looks")+" de tu armario.":"Ahora mismo no completa ningún look de tu armario (arriba + abajo, o vestido)."):core.length?"Solo combina con "+plural(core.length,"prenda clave","prendas clave")+" de tu armario.":"Ahora mismo no tienes con qué combinarla"+(c.category&&CORE[c.category]?" (te faltaría: "+CORE[c.category].join(" o ").toLocaleLowerCase("es")+")":"")+".")}
 if(rescued.length)reasons.push("Daría salida a "+plural(rescued.length,"prenda","prendas")+" que ahora casi no combinas.");
 const p=appState.data.preferences,pending=appState.data.wishlist.filter(w=>!w.bought).reduce((s,w)=>s+(Number(w.price)||0),0);
 if(Number(c.price)>0&&Number(p.budget)>=0&&pending+Number(c.price)>Number(p.budget))reasons.push("Con tu wishlist pendiente superaría tu presupuesto de "+euro(p.budget)+".");
 if(!gs.length)reasons.push("Añade prendas a tu armario para que el veredicto sea fiable.");
 return {verdict,tone,reasons,compatible,core,duplicates,rescued};
}
function buyCheckHtml(){
 const c=buyCheck;
 let html='<div class="feature-card" id="buyCheck"><h2>¿Lo compro?</h2><p class="muted">Haz una foto a la prenda en la tienda o sube una captura. Te digo con qué combina de tu armario y si se parece a algo que ya tienes.</p>'+
  '<div class="photo-buttons buy-photo-actions"><button type="button" class="primary" data-photo-pick="buyCamera">Hacer foto</button><button type="button" class="secondary" data-photo-pick="buyImage">Elegir de galería</button></div><p class="photo-guidance">Para fotos de prendas extendidas, usa un fondo liso que contraste con su color y deja espacio alrededor.</p>'+
  '<input id="buyCamera" class="file-hidden" type="file" tabindex="-1" accept="image/*" capture="environment" aria-label="Hacer foto con la cámara"><input id="buyImage" class="file-hidden" type="file" tabindex="-1" accept="image/*" aria-label="Elegir foto de la galería">';
 if(!c)return html+'</div>';
 if(c.loading)return html+'<p class="muted">Preparando la foto…</p></div>';
 const r=evaluateCandidate(c);
 html+='<div class="buy-head">'+(validImage(c.image)?'<img class="buy-img" src="'+c.image+'" alt="Prenda que estás valorando">':'')+
  '<div class="buy-fields"><label class="field"><span>Nombre</span><input id="buyName" maxlength="80" value="'+fx(c.name)+'"></label>'+
  '<div class="filter-grid"><label class="field"><span>Categoría</span><select id="buyCategory">'+optionList([["","Sin categoría"],...CATEGORIES.map(x=>[x,x])],c.category)+'</select></label>'+
  '<label class="field"><span>Color</span><input id="buyColor" maxlength="60" value="'+fx(c.color)+'"></label>'+
  '<label class="field"><span>Estilo</span><select id="buyStyle">'+optionList([["","Sin definir"],...Object.entries(styleNames)],c.style)+'</select></label>'+
  '<label class="field"><span>Temporada</span><select id="buySeason">'+optionList(Object.entries(seasons),c.season||"all")+'</select></label>'+
  '<label class="field"><span>Precio (€)</span><input id="buyPrice" type="number" min="0" step=".01" inputmode="decimal" value="'+fx(c.price??"")+'"></label></div></div></div>'+
  (c.analyzeFailed?'<p class="error">No se pudo analizar la foto. Completa categoría y color a mano para ver el veredicto.</p>':'')+
  (!c.analyzed?'<div class="notice-card"><p>'+(c.category?'Revisa los datos: el color lo he estimado en tu móvil.':'Elige la categoría para que el veredicto sea fiable. El color lo he estimado en tu móvil.')+'</p>'+
   '<button type="button" class="secondary wide" id="buyAnalyze"'+(c.analyzing?' disabled':'')+'>'+(c.analyzing?'Reconociendo…':'✦ Reconocer con IA')+'</button><p class="helper">Rellena categoría, estilo y detalles. Usa 1 de tus '+AI_LIMITS.analyze+' análisis de hoy.</p></div>':'')+
  '<div class="verdict '+r.tone+'"><strong>'+fx(r.verdict)+'</strong>'+r.reasons.map(x=>'<p>'+fx(x)+'</p>').join("")+'</div>'+
  '<h3 class="mini-title">'+(c.category&&!isClothes(c)?'Completa '+plural(r.core.length,"look","looks")+' con estas prendas':'Combina con ('+r.compatible.length+')')+'</h3>'+(r.compatible.length?thumbs(r.compatible):'<p class="muted">Ninguna prenda de tu armario.</p>')+
  (r.duplicates.length?'<h3 class="mini-title">Se parece a ('+r.duplicates.length+')</h3>'+thumbs(r.duplicates):'')+
  '<button class="secondary wide" id="buyLooks"'+(r.compatible.length?'':' disabled')+'>✦ Ver looks con esta prenda</button>'+
  (c.looks?c.looks.length?'<div class="grid buy-looks">'+c.looks.map(l=>{const gs=l.ids.map(id=>id==="__nueva__"?{name:c.name||"Prenda nueva",image:c.image,category:c.category,bgWhite:!!c.bgWhite}:myGarments().find(g=>g.id===id)).filter(Boolean);return '<article class="card">'+outfitBoard(gs)+'<div class="card-body"><div class="card-title">'+fx(l.why)+'</div><div class="look-items">'+gs.map(g=>'<span class="look-chip">'+fx(g.name)+'</span>').join("")+'</div></div></article>'}).join("")+'</div>':'<p class="muted">Con tu armario actual no salen looks que combinen bien con esta prenda.</p>':'')+
  '<p class="helper">El veredicto se calcula en tu móvil con reglas de color, categoría, estilo y temporada; es orientativo y no gasta tokens. Solo «Reconocer con IA» usa la IA, cuando lo pulsas.</p>'+
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
/* B5: «¿Lo compro?» no llama a la IA sola. El color se estima en el móvil (media de la prenda, sin el fondo
   blanco, comparada en Lab con la paleta); la categoría la elige la usuaria o «Reconocer con IA», bajo demanda. */
/* Nombre de color a partir de Lab: sin color (negro, gris, blanco), tonos tierra (beige, marrón) y por tono (hue) */
function colorName(L,a,b){
 const C=Math.hypot(a,b),h=(Math.atan2(b,a)*180/Math.PI+360)%360;
 if(C<9)return L<30?"Negro":L>80?"Blanco":"Gris";
 if(C<24&&h>=35&&h<105)return L>62?"Beige":"Marrón";
 if(h<40||h>=335)return L>68&&C<45?"Rosa":"Rojo";
 if(h<70)return L<58?"Marrón":C>45?"Amarillo":"Beige";
 if(h<105)return C>35?"Amarillo":"Beige";
 if(h<200)return "Verde";
 if(h<312)return C<28&&L>32&&L<68?"Vaquero":"Azul";
 return L>70?"Rosa":"Morado";
}
async function guessColor(src){
 try{
  const img=await loadImg(src),c=mkCanvas(40,50),x=c.getContext("2d",{willReadFrequently:true});x.drawImage(img,0,0,40,50);
  const d=x.getImageData(8,8,24,34).data,n=d.length/4,[L,A,B]=labArrays(d,n),idx=[];
  for(let i=0;i<n;i++){const j=i*4,mn=Math.min(d[j],d[j+1],d[j+2]),mx=Math.max(d[j],d[j+1],d[j+2]);if(!(mn>=236&&mx-mn<=14))idx.push(i)}
  if(idx.length<20)return "Blanco";
  // Varios colores vivos repartidos (estampado de flores, rayas de colores): Multicolor
  const bins=new Array(6).fill(0);let vivid=0;for(const i of idx){if(Math.hypot(A[i],B[i])<18)continue;vivid++;bins[Math.floor(((Math.atan2(B[i],A[i])*180/Math.PI+360)%360)/60)]++}
  const sorted=[...bins].sort((p,q)=>q-p);if(vivid>idx.length*.3&&sorted[1]>vivid*.25&&sorted[0]<vivid*.6)return "Multicolor";
  const med=arr=>quantile(idx.map(i=>arr[i]),.5);
  return colorName(med(L),med(A),med(B));
 }catch{return ""}
}
async function buyAnalyze(){
 const c=buyCheck;if(!c||c.loading||c.analyzing)return;readBuyFields();
 c.analyzing=true;c.analyzeFailed=false;render();
 try{const out=await api("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:c.image})});const d=mapAnalysis(out.garment||out.result||out);
  if(buyCheck!==c)return;
  const keep={price:c.price,name:c.name||d.name};Object.assign(c,d,{season:d.season||"all",notes:undefined},keep,{analyzed:true,looks:null})}
 catch(e){console.error("BUY_ANALYZE",e);if(e.message==="SESSION_EXPIRED"){buyCheck=null;return}c.analyzeFailed=e.message!=="AI_QUOTA"}
 finally{c.analyzing=false}
 if(buyCheck===c)render();
}
async function startBuyCheck(file){
 let image;
 try{image=await readImage(file)}catch(e){return toast(e.message==="IMAGE_TOO_LARGE"?"La imagen es demasiado grande":"No se pudo leer la imagen")}
 if(!image)return;
 const token={};buyCheck={image,loading:true,token};render();
 let bgWhite=false;const original=image;
 let photoFx=false,catalogPhoto=false;
 if(appState.data.preferences.autoWhite!==false){const r=await enhancePhoto(image);if(buyCheck?.token!==token)return;if(r){image=r.image;bgWhite=r.white;photoFx=!r.asIs;catalogPhoto=!!r.asIs}}
 const c={image,original,bgWhite,photoFx,catalogPhoto,token,name:"",category:"",color:await guessColor(image),style:"",season:"all",price:null,looks:null,analyzeFailed:false,analyzed:false};
 if(buyCheck?.token===token){buyCheck=c;render();$("#buyCheck")?.scrollIntoView?.({block:"start",behavior:"smooth"})}
}
/* «¿Lo compro?» › looks con la prenda nueva: los hace el motor con tu armario (sin IA, decisión de Noelia, 10/10/2026) */
function buyLooks(){
 readBuyFields();const c=buyCheck;if(!c)return;if(!c.category)return toast("Elige la categoría de la prenda");
 const cand={...c,id:"__nueva__",name:c.name||"Prenda nueva",updatedAt:"buy"};
 c.looks=rankOutfits({pool:[...myGarments(),cand],required:"__nueva__",occasion:null,max:3}).map(l=>({why:l.reasons[0]||"Look con tu armario",ids:l.ids}));
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
].map(([name,category,color,style,season,pattern])=>({name,category,color,style,season,pattern:pattern||"plain",formality:{casual:"casual",smart:"smartcasual",party:"party",sport:"sport"}[style]}));
/* Versión arreglada de cada básico (Noelia, 10/10/2026): no es lo mismo una camiseta blanca básica que una elegante */
const CATALOG_DRESSY={"Camiseta blanca básica":["Camiseta blanca de punto fino","punto fino o cuello barco, con caída"],"Camiseta negra básica":["Camiseta negra de punto fino","punto fino o satinada, con caída"],
 "Camisa vaquera":["Camisa de seda azul","seda o satén, lisa"],"Vaquero recto azul":["Vaquero oscuro de corte recto","lavado oscuro, sin rotos"],"Zapatillas blancas":["Zapatillas blancas de piel","piel lisa, suela fina"],
 "Cárdigan crudo":["Cárdigan de punto fino crudo","punto fino, botones joya"],"Chaqueta vaquera":["Chaqueta de tweed","tweed o bouclé"],"Jersey de punto gris":["Jersey gris de cachemir","cachemir o merino"]};
/* Tiendas por franja de precio: el enlace busca la prenda en su web (no se leen precios: solo la franja habitual de cada tienda) */
const STORES=[["Primark","primark.com",1],["Lefties","lefties.com",1],["H&M","hm.com",2],["Uniqlo","uniqlo.com",2],["Zara","zara.com",3],["Mango","mango.com",3],["Massimo Dutti","massimodutti.com",4],["El Corte Inglés","elcorteingles.es",4]];
const storesFor=c=>{const dressy=c.formality==="smartcasual"||c.formality==="party"||c.style!=="casual";return STORES.filter(x=>dressy?x[2]>=2:x[2]<=3).slice(0,dressy?5:5)};
const storeLinks=c=>'<div class="store-links" aria-label="Buscar en tiendas, de más barata a más cara">'+storesFor(c).map(([n,d,t])=>'<a class="chip-button" href="https://www.google.com/search?q='+encodeURIComponent(c.name+" site:"+d)+'" target="_blank" rel="noopener noreferrer">'+fx(n)+' <span class="muted">'+"€".repeat(t)+'</span></a>').join("")+'</div>';
/* Ficha dibujada de una prenda que aún no tienes (Noelia, 10/10/2026): silueta según el tipo, en su color; sin IA ni red (CSP img-src data:) */
const SKETCH_HEX={blanco:"#f7f5f1",negro:"#26231f",beige:"#d9c4a6",gris:"#9b9893",camel:"#b4825a","azul marino":"#28324d",vaquero:"#5f7ea6",crudo:"#ede5d5",nude:"#e2c2a9",azul:"#4f6fa8"};
const SKETCH_PATH={
 tee:"M30 18L42 14Q50 21 58 14L70 18L85 33L75 41L68 36V86H32V36L25 41L15 33Z",
 long:"M30 16L42 12Q50 19 58 12L70 16L86 78L76 80L68 42V88H32V42L24 80L14 78Z",
 tank:"M38 12H42Q50 27 58 12H62Q62 28 68 34V88H32V34Q38 28 38 12Z",
 coat:"M30 8L42 5L50 30L58 5L70 8L87 82L77 84L69 40V96H31V40L23 84L13 82Z",
 jacket:"M30 14L42 10L50 34L58 10L70 14L86 76L76 78L68 40V82H32V40L24 78L14 76Z",
 pants:"M30 8H70L75 94H56L50 34L44 94H25Z",
 skirt:"M34 14H66L79 86H21Z",
 dress:"M40 6H44Q50 15 56 6H60Q60 22 64 30L81 92H19L36 30Q40 22 40 6Z",
 sneaker:"M12 62V75H89Q89 64 77 60L57 52L45 42L30 44Q22 56 12 62Z",
 boot:"M30 18H52V58L84 66Q89 70 87 79H30Z",
 heel:"M12 66Q38 44 60 52L86 60L87 68L60 66L24 72L22 86H17Z",
 sandal:"M12 70H88V77H12ZM34 70Q40 54 52 54Q62 54 66 70",
 bag:"M20 42H80L86 88H14ZM36 42Q36 18 50 18Q64 18 64 42",
 belt:"M6 44H94V56H6ZM60 40H74V60H60Z"};
function sketchKind(c){const t=norm(c.name||c.type||"");
 if(c.category==="Zapatos")return /bot/.test(t)?"boot":/salon|tacon/.test(t)?"heel":/sandal/.test(t)?"sandal":"sneaker";
 if(c.category==="Bolsos")return "bag";if(c.category==="Accesorios")return "belt";
 if(c.category==="Vestidos")return "dress";
 if(c.category==="Abajo")return /falda/.test(t)?"skirt":"pants";
 if(c.category==="Capas")return /abrigo|gabardina/.test(t)?"coat":"jacket";
 return /tirante|top/.test(t)?"tank":/camiseta/.test(t)?"tee":"long"}
function pieceSketch(c){const col=norm(c.color||""),hex=SKETCH_HEX[col]||SKETCH_HEX[Object.keys(SKETCH_HEX).find(k=>col.startsWith(k))]||"#c9c3ba",light=/^#(f|e|d)/i.test(hex);
 const kind=sketchKind(c),line=["bag","sandal"].includes(kind),stripes=c.pattern==="stripes";
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+({sneaker:"8 38 84 40",boot:"26 14 64 68",heel:"8 40 82 48",sandal:"8 50 84 30",belt:"4 36 92 28"}[kind]||"0 0 100 100")+'">'+(stripes?'<defs><pattern id="s" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="'+hex+'"/><rect width="8" height="3" fill="#28324d"/></pattern></defs>':'')+
  '<path d="'+SKETCH_PATH[kind]+'" fill="'+(line&&kind==="sandal"?hex:stripes?"url(#s)":hex)+'" stroke="'+(light?"#8f877c":"rgba(0,0,0,.35)")+'" stroke-width="1.6" stroke-linejoin="round"'+(line?' fill-rule="evenodd"':'')+'/></svg>';
 return "data:image/svg+xml,"+encodeURIComponent(svg)}
/* «Así quedaría con tu armario»: tus prendas con su foto y la nueva dibujada, en el mismo collage que los looks */
function suggestionBoard(l){const order={Capas:0,Arriba:1,Vestidos:2,Abajo:3,Zapatos:4,Bolsos:5,Accesorios:6},items=l.filter(g=>!g.id||validImage(g.image)).sort((a,b)=>(order[a.category]??7)-(order[b.category]??7)).slice(0,7);
 const hero=items.find(g=>!g.id&&(order[g.category]??7)<=3)||items[0],arr=hero?[hero,...items.filter(g=>g!==hero)]:[];
 if(arr.length<2)return "";
 return '<div class="look-mixed-board suggestion-board" data-count="'+arr.length+'" role="group" aria-label="Así quedaría con tu armario">'+arr.map(g=>'<div class="look-mixed-item'+(g.id?'':' is-new')+'"><img src="'+(g.id?photoUrl(g):pieceSketch(g))+'" alt="'+fx(g.name)+(g.id?'':' (nueva)')+'" loading="lazy">'+(g.id?'':'<span class="new-badge">Nueva</span>')+'</div>').join("")+'</div>'}
/* Productos reales con foto y precio, de muchas tiendas: se abren en Google Shopping (gratis, sin llamadas desde la app) */
const shopLink=(c,text="Ver productos con foto y precio")=>'<a class="primary shop-link" href="https://www.google.com/search?tbm=shop&q='+encodeURIComponent(c.name)+'" target="_blank" rel="noopener noreferrer">'+fx(text)+' ↗</a>';
function simulate(c,gs,bases){
 let looks=[];
 if(c.category==="Arriba")looks=gs.filter(g=>g.category==="Abajo"&&goes(c,g)).map(b=>[c,b]);
 else if(c.category==="Abajo")looks=gs.filter(g=>g.category==="Arriba"&&goes(c,g)).map(t=>[t,c]);
 else if(c.category==="Vestidos")looks=gs.filter(g=>["Zapatos","Capas"].includes(g.category)&&goes(c,g)&&sharesOccasion(g,[c])).map(e=>[c,e]);
 else looks=bases.filter(p=>p.every(x=>goes(c,x))&&sharesOccasion(c,p)).map(p=>[...p,c]);
 const complete=c.category==="Zapatos"?looks.filter(l=>!gs.some(g=>g.category==="Zapatos"&&l.slice(0,-1).every(p=>goes(g,p))&&sharesOccasion(g,l.slice(0,-1)))).length:0;
 const examples=looks.slice(0,40).map(l=>{if(["Arriba","Abajo"].includes(c.category)){const rest=l.filter(x=>x!==c),s=gs.find(g=>g.category==="Zapatos"&&goes(g,c)&&rest.every(p=>goes(g,p))&&sharesOccasion(g,l));return s?[...l,s]:l}return l});
 const q=l=>{let t=0,n=0,min=1;for(let i=0;i<l.length;i++)for(let j=i+1;j<l.length;j++){const r=relationOf(l[i],l[j]);if(r){t+=r.s;n++;min=Math.min(min,r.s)}}return min<REL_OK?0:n?t/n:.6}; /* eslabón débil: una pareja floja descarta el ejemplo (revisión de Codex, #174) */
 examples.sort((a,b)=>b.length-a.length||q(b)-q(a));
 return {count:looks.length,complete,examples:examples.filter(l=>q(l)>=REL_OK).slice(0,12)}; /* se eligen 2 al final, variados entre tarjetas */
}
function shoppingSuggestions(){
 ensureRelations();const gs=myGarments(),bases=outfitBases(gs),season=thisSeason(),wished=new Set(appState.data.wishlist.map(w=>norm(w.name)));
 const lb=lookBases(gs),lonely=new Set(gs.filter(g=>gs.filter(o=>goes(g,o)).length<2).map(g=>g.id)),partner={Arriba:["Abajo"],Abajo:["Arriba"]},out=[];
 for(const c of CATALOG){
  if(wished.has(norm(c.name))||gs.some(g=>isDuplicate(c,g)))continue;
  const clothes=isClothes(c),cb=clothes?[]:basesFor(c,lb),nb=cb.length,compatible=clothes?gs.filter(g=>isClothes(g)&&goes(c,g)):[...new Set(cb.flat())];if(!compatible.length)continue; /* ropa con ropa; el resto, con looks completos */
  const sim=simulate(c,gs,bases),rescued=compatible.filter(g=>lonely.has(g.id)&&(partner[c.category]||[]).includes(g.category));
  if(sim.count<2&&!rescued.length)continue;
  const seasonBoost=c.season==="all"?1:c.season===season?1.2:.5;
  const value=["Arriba","Abajo","Vestidos"].includes(c.category)?sim.count*2:c.category==="Zapatos"?sim.complete*2+sim.count*.3:c.category==="Capas"?sim.count*.6:sim.count*.25;
  const alt=CATALOG_DRESSY[c.name],ac=alt?{...c,name:alt[0],hint:alt[1],style:"smart",formality:"smartcasual"}:null,asim=ac?simulate(ac,gs,bases):null;
  out.push({c,alt:ac&&asim?.count?{c:ac,looks:asim.count}:null,compatible,bases:nb,rescued,looks:sim.count,complete:sim.complete,examples:sim.examples,score:(value+rescued.length*3+compatible.length*.3)*seasonBoost});
 }
 out.sort((a,b)=>b.score-a.score);
 const perCat={},picked=[];
 const kinds=new Set(); /* una prenda de cada tipo: no «blazer negro» y «blazer camel» a la vez (revisión general) */
 for(const s of out){const kind=norm(s.c.name).split(/\s+/)[0];if((perCat[s.c.category]||0)>=2||kinds.has(kind))continue;kinds.add(kind);perCat[s.c.category]=(perCat[s.c.category]||0)+1;picked.push(s);if(picked.length>=6)break}
 /* Ejemplos variados (revisión general, 10/10/2026): que no salga la misma blusa en todas las tarjetas */
 const seen=new Map();for(const s of picked){const pool=s.examples.slice(),ch=[];
  while(ch.length<2&&pool.length){pool.sort((a,b)=>{const cost=l=>l.filter(g=>g.id).reduce((t,g)=>t+(seen.get(g.id)||0)+(ch.some(c=>c.includes(g))?3:0),0);return cost(a)-cost(b)});const e=pool.shift();ch.push(e);for(const g of e)if(g.id)seen.set(g.id,(seen.get(g.id)||0)+1)}
  s.examples=ch}
 return picked;
}
function suggestionCard(s,i){
 const c=s.c,why=[isClothes(c)?"Combina con "+plural(s.compatible.length,"prenda","prendas")+" de ropa de tu armario.":"Completa "+plural(s.bases,"look","looks")+" de tu armario (arriba + abajo, o vestido)."],core=["Arriba","Abajo","Vestidos"].includes(c.category);
 if(core&&s.looks)why.push("Te da "+plural(s.looks,"look nuevo","looks nuevos")+".");
 else if(c.category==="Zapatos"&&s.complete)why.push("Completa "+plural(s.complete,"look","looks")+" que ahora no tienen calzado a juego.");
 else if(c.category==="Capas"&&s.looks)why.push("Puedes llevarla encima de "+s.looks+" de tus looks.");
 else if(s.looks&&isClothes(c))why.push("Encaja con "+s.looks+" de tus looks.");
 if(s.rescued.length)why.push("Le da salida a "+s.rescued.slice(0,2).map(g=>"«"+g.name+"»").join(" y ")+(s.rescued.length>2?" y "+(s.rescued.length-2)+" más":"")+", que ahora casi no combinas.");
 const piece=g=>'<span class="look-chip'+(g.id?'':' new')+'">'+fx(g.name)+'</span>',board=s.examples[0]?suggestionBoard(s.examples[0]):"";
 return '<div class="suggestion"><div class="suggestion-head"><img class="suggestion-sketch" src="'+pieceSketch(c)+'" alt=""><div><strong>'+fx(c.name)+'</strong><p class="muted">'+fx(c.category+" · "+c.color+" · "+(styleNames[c.style]||"")+(c.season!=="all"?" · "+seasons[c.season]:""))+'</p></div>'+
  (core&&s.looks?'<span class="looks-badge">+'+s.looks+' looks</span>':c.category==="Zapatos"&&s.complete?'<span class="looks-badge">completa '+s.complete+'</span>':'')+'</div>'+
  '<p class="suggestion-why">'+fx(why.join(" "))+'</p>'+thumbs(s.compatible,8)+
  (s.examples.length?'<div class="suggestion-examples">'+(board?'<p class="muted">Así quedaría con tu armario:</p>'+board:'')+s.examples.slice(board?1:0).map(l=>'<div class="example-line"><span class="muted">'+(board?'Otra idea:':'Por ejemplo:')+'</span>'+l.map(piece).join("")+'</div>').join("")+'</div>':'')+
  '<div class="shop-row">'+shopLink(c)+'</div><p class="muted store-title">O búscala en una tienda, de más barata a más cara:</p>'+storeLinks(c)+
  (s.alt?'<div class="suggestion-alt"><p><strong>¿Más arreglada?</strong> '+fx(s.alt.c.name)+' ('+fx(s.alt.c.hint)+'): '+fx(plural(s.alt.looks,"look","looks"))+' con tu armario.</p><div class="shop-row">'+shopLink(s.alt.c,"Ver productos")+'</div>'+storeLinks(s.alt.c)+'</div>':'')+
  '<div class="suggestion-actions"><button class="chip-button" data-suggest-wish="'+i+'">♡ A la wishlist</button></div></div>';
}
let suggestionCache={key:"",list:[]};
function suggestionsHtml(){
 const gs=myGarments();
 let html='<div class="feature-card" id="suggestions"><h2>Te recomiendo comprar</h2>';
 if(gs.length<5)return html+'<p class="muted">Añade al menos 5 prendas a tu armario y te diré qué piezas te darían más looks nuevos.</p></div>';
 ensureRelations();const key=relCache.sig+"|"+JSON.stringify(appState.data.wishlist.map(w=>w.name)); /* la firma de relaciones ya recoge la ficha de cada prenda y lo marcado con «Casi» (revisión de Codex, #174) */
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
  (wishlist.length?'<div class="insight-list">'+wishlist.map(w=>{const similar=myGarments().filter(g=>g.category&&g.category===w.category).length,link=/^https?:\/\//i.test(w.url||"")?'<a href="'+fx(w.url)+'" rel="noopener noreferrer" target="_blank">Ver tienda ↗</a>':w.bought?"":'<a href="https://www.google.com/search?tbm=shop&q='+encodeURIComponent(w.name)+'" rel="noopener noreferrer" target="_blank">Ver productos con foto y precio ↗</a>'; /* sin enlace propio: productos reales en Google Shopping */
   return '<div class="wish-row">'+(w.category?'<img class="wish-sketch" src="'+pieceSketch(w)+'" alt="">':'')+'<div class="wish-main"><strong>'+fx(w.name)+'</strong><p class="muted">'+euro(w.price)+(w.verdict?' · '+fx(w.verdict):'')+(w.bought?' · Comprada':'')+(similar?' · ya tienes '+plural(similar,"prenda","prendas")+' de esa categoría':'')+'</p>'+link+'</div><div class="wish-actions"><button class="chip-button" data-wish-bought="'+fx(w.id)+'">'+(w.bought?'Pendiente':'Comprada ✓')+'</button><button class="chip-button" data-wish-remove="'+fx(w.id)+'" aria-label="Quitar">✕</button></div></div>'}).join("")+'</div>':'<div class="empty">Tu lista está vacía.</div>')+
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
 $("#buyLooks")?.addEventListener("click",buyLooks);$("#buyAnalyze")?.addEventListener("click",buyAnalyze);
 $("#buyReset")?.addEventListener("click",()=>{buyCheck=null;render()});
 $("#buyWish")?.addEventListener("click",async()=>{readBuyFields();const c=buyCheck,r=evaluateCandidate(c);
  await mutate(()=>appState.data.wishlist.unshift({id:uid(),name:c.name||"Prenda sin nombre",price:Number(c.price)||0,category:c.category,url:"",bought:false,addedAt:dayISO(),verdict:r.verdict,updatedAt:new Date().toISOString()}),"Añadida a la wishlist")});
 $("#buyAdd")?.addEventListener("click",async()=>{readBuyFields();const c=buyCheck;if(!validImage(c.image))return;
  if(!confirm("¿Añadir esta prenda a tu armario?"))return;
  const now=new Date().toISOString(),newId=uid();
  const ok=await mutate(()=>myGarments().unshift({...cleanAnalysis(c),id:newId,name:c.name||"Prenda nueva",category:c.category,color:c.color,notes:"",season:c.season||"all",style:c.style,price:c.price,boughtAt:dayISO(),favorite:false,createdAt:now,image:c.image,bgWhite:!!c.bgWhite,...(c.photoFx||c.catalogPhoto?{photoFx:1}:{}),...(c.catalogPhoto?{catalogPhoto:1}:{}),imageAt:now,updatedAt:now}),"Prenda añadida a tu armario");
  // Igual que en la ficha: la original queda en este móvil para poder volver a ella
  if(ok&&c.photoFx&&validImage(c.original)){try{await dbSet(origKey(newId),c.original)}catch(err){console.warn("ORIG",err)}}
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
  '<div class="section-head"><h2>Historial de usos</h2><button class="secondary" id="backInsights">Volver al armario</button></div>'+
  (history.length?'<div class="insight-list">'+history.map(l=>'<div class="history-line"><div><strong>'+fx(validDay(l.date)?capFirst(weekdayName(l.date))+', '+fmtDay(l.date):String(l.date||"Sin fecha"))+'</strong><p class="muted">'+fx((l.garmentIds||[]).map(id=>myGarments().find(g=>g.id===id)?.name).filter(Boolean).join(" · "))+'</p></div><button class="chip-button" data-remove-use="'+fx(l.id)+'">Eliminar</button></div>').join("")+'</div>':'<div class="empty">Todavía no has registrado ningún conjunto utilizado.</div>');
 $("#calendarMonth")?.addEventListener("change",e=>{ui.calendarMonth=e.target.value||dayISO().slice(0,7);render()});
 $("#backInsights")?.addEventListener("click",()=>setView("wardrobe"));
 $$("[data-cal-date]",root).forEach(b=>b.addEventListener("click",()=>{const day=b.dataset.calDate,items=logs().filter(l=>l.date===day);toast(items.length?plural(items.length,"uso registrado","usos registrados")+" el "+fmtDay(day):"Sin usos registrados el "+fmtDay(day))}));
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
  const ids=d=>[...d.garments,...d.looks,...d.wishlist,...d.wearLog,...d.trips,...(d.plans||[])].map(x=>x.id);
  const current=new Set(ids(appState.data)),data=normalizeData(obj.data),kept=new Set(ids(data)),now=new Date().toISOString();
  // Lo restaurado cuenta como recién editado: así gana a borrados antiguos de otros dispositivos
  for(const key of ["garments","looks","wishlist","wearLog","trips","plans"])for(const x of data[key])x.updatedAt=now;
  data.deleted=newest(data.deleted,appState.data.deleted);for(const id of kept)delete data.deleted[id];
  await mutate(()=>{appState.data=data;for(const id of current)if(!kept.has(id))tomb(id)},"Copia restaurada");
 }catch(e){console.error("BACKUP",e);toast("No se pudo importar la copia")}
}
/* Mejora todas las fotos aún sin retocar; se parte de la original guardada en el móvil si la hay */
/* Prendas a las que «Fondo blanco en todas» puede ayudar: sin mejorar, o mejoradas conservando el fondo */
const needsWhite=g=>validImage(g.image)&&(!g.photoFx||!g.bgWhite&&!g.catalogPhoto);
async function whiteAll(btn){
 const todo=myGarments().filter(needsWhite),profile=appState.profile?.id;let done=0,white=0;
 btn.disabled=true;
 for(const [i,g] of todo.entries()){
  btn.textContent="Mejorando "+(i+1)+" de "+todo.length+"…";
  let source=g.image;try{const o=await dbGet(origKey(g.id));if(validImage(o))source=o}catch{}
  const res=await enhancePhoto(source);
  if(appState.profile?.id!==profile)return;
  if(!res||g.photoFx&&!res.white)continue; // ya retocada y sigue sin poder separarse: no se retoca otra vez
  const now=new Date().toISOString();
  if(res.asIs&&res.image===g.image)Object.assign(g,{bgWhite:true,photoFx:1,catalogPhoto:1,updatedAt:now});
  else{try{if(!res.asIs)await dbSet(origKey(g.id),source)}catch(e){console.warn("ORIG",e)}
   Object.assign(g,{image:res.image,bgWhite:res.white,photoFx:1,imageAt:now,updatedAt:now});if(res.asIs)g.catalogPhoto=1;else delete g.catalogPhoto}
  done++;if(res.white)white++;
 }
 if(done)await saveState();
 render();
 toast(done?plural(white,"foto con fondo blanco","fotos con fondo blanco")+(done-white?" · "+(done-white)+" con el fondo original (no se pudo separar la prenda)":""):"No he podido mejorar ninguna foto");
}
function renderSettings(root){
 const p=appState.data.preferences,u=aiUsage(),since=daysSince(p.lastBackupAt);
 const storage=storageInfo.persisted===true?"Almacenamiento protegido: el navegador no borrará estos datos automáticamente.":storageInfo.persisted===false?"El navegador no ha confirmado la protección del almacenamiento.":"";
 root.innerHTML=heroHtml("Ajustes","Perfil "+appState.profile.name)+
  '<div class="feature-card"><h2>Sincronización</h2><p class="muted" id="syncStatus">'+fx(syncStatusText())+'</p>'+
  (sync.status!=="off"?'<p class="helper">Tu armario y tus fotos se guardan en el servidor de Atelier, solo accesibles con tu contraseña. Así puedes cambiar de móvil o usar varios dispositivos.</p><button class="secondary wide" id="syncButton"'+(sync.status==="syncing"?' disabled':'')+'>↻ Sincronizar ahora</button>':'')+'</div>'+
  '<div class="feature-card"><h2>Compras</h2><label class="field"><span>Presupuesto de compras (€)</span><input id="shoppingBudget" type="number" min="0" max="100000" step="1" inputmode="numeric" value="'+fx(p.budget)+'"></label><p class="helper">Lo uso en la wishlist y en «¿Lo compro?» para avisarte si una compra te haría pasarte.</p></div>'+
  '<div class="feature-card"><h2>Preferencias del estilista</h2>'+
  '<label class="field"><span>Temporada para las propuestas</span><select id="settingsSeason">'+optionList(Object.entries(seasons),p.season||"all")+'</select></label>'+
  '<label class="field"><span>Temperatura si no usas el tiempo de tu zona (°C)</span><input id="settingsTemperature" type="number" min="-30" max="55" step="1" value="'+fx(currentTemperature())+'"></label>'+
  '<label class="switch-line"><input id="settingsAvoidRepeats" type="checkbox"'+(p.avoidRepeats?' checked':'')+'> Evitar repetir combinaciones recientes</label>'+'<label class="field"><span>Prenda olvidada tras (días)</span><input id="settingsForget" type="number" min="30" max="365" value="'+fx(p.forgottenDays)+'"></label>'+
  '<label class="field"><span>Código de vestir en tu trabajo</span><select id="settingsWorkDress">'+Object.entries(WORK_DRESS).map(([k,v])=>'<option value="'+k+'"'+(workDress()===k?' selected':'')+'>'+fx(v)+'</option>').join("")+'</select></label><p class="helper">Lo uso en los looks de trabajo: en una oficina informal valen deportivas y sudaderas; en una formal, solo prendas arregladas.</p>'+
  '</div>'+ 
  '<div class="feature-card"><h2>Uso de la IA hoy</h2><p class="muted">Análisis de fotos: '+u.analyze+' de '+AI_LIMITS.analyze+'.</p><p class="helper">Solo el análisis de fotos usa la IA. Los looks, «¿Lo compro?», las recomendaciones, las maletas y el fondo blanco se calculan en tu móvil.</p></div>'+
  '<div class="feature-card"><h2>Fotos</h2><p class="muted">'+fx(myGarments().filter(g=>g.photoFx).length+" de "+myGarments().filter(g=>validImage(g.image)).length+" fotos mejoradas ("+myGarments().filter(g=>g.bgWhite).length+" con fondo blanco).")+'</p>'+
  (myGarments().some(needsWhite)?'<button class="secondary wide" id="whiteAll">✨ Fondo blanco en todas las fotos</button><p class="helper">Como en una tienda online: prenda sobre fondo blanco, con luz, color y nitidez. Si en alguna no se puede separar la prenda, se mejora conservando el fondo. Se hace en tu móvil, sin gastar tokens. Las originales se guardan en este dispositivo y puedes volver a ellas desde cada prenda.</p>':'')+'</div>'+
  '<div class="feature-card"><h2>Copias de seguridad</h2>'+(storage?'<p class="muted">'+fx(storage)+'</p>':'')+
  '<p class="muted">'+fx(since===null?"Sin copias exportadas todavía.":"Última copia exportada hace "+plural(since,"día","días")+".")+'</p>'+
  '<button id="exportBackup" class="secondary wide">↓ Exportar copia JSON</button>'+
  '<label class="field"><span>Importar copia de este perfil</span><input id="importBackup" type="file" accept=".json,application/json"></label>'+
  '<p class="helper">La copia incluye fotografías y datos personales. Guárdala en un lugar privado.</p></div>'+
  '<button id="logout" class="danger wide">Cerrar sesión</button>';
 $("#syncButton")?.addEventListener("click",async e=>{e.target.disabled=true;e.target.textContent="Sincronizando…";$("#syncStatus").textContent="Sincronizando…";await syncNow();render()});
 $("#shoppingBudget")?.addEventListener("change",e=>{const n=Number(e.target.value);if(e.target.value===""||!Number.isFinite(n)||n<0)return toast("Introduce un importe en euros");setPref("budget",Math.round(n*100)/100,false);toast("Presupuesto guardado: "+euro(n))});
 $("#settingsWorkDress")?.addEventListener("change",e=>{setPref("workDress",WORK_DRESS[e.target.value]?e.target.value:"arreglado");toast("Código de vestir del trabajo: "+WORK_DRESS[e.target.value].toLowerCase())});
 $("#settingsSeason")?.addEventListener("change",e=>{const d=p.dailyLook;if(d&&!d.touched)d.date=null;setPref("season",e.target.value,false)});
 $("#settingsTemperature")?.addEventListener("change",e=>{const n=Number(e.target.value);if(e.target.value===""||!Number.isFinite(n)||n< -30||n>55)return toast("Introduce entre -30 y 55 °C");p.autoWeather=false;if(p.dailyLook&&!p.dailyLook.touched)p.dailyLook.date=null;setPref("temperature",n,true)});
 $("#settingsAvoidRepeats")?.addEventListener("change",e=>setPref("avoidRepeats",e.target.checked,false));
 $("#settingsForget")?.addEventListener("change",e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=30&&n<=365)setPref("forgottenDays",n);else toast("Introduce entre 30 y 365 días")});
 $("#exportBackup")?.addEventListener("click",downloadBackup);
 $("#importBackup")?.addEventListener("change",e=>importBackup(e.target.files[0]));
 $("#whiteAll")?.addEventListener("click",e=>whiteAll(e.target));
 $("#logout")?.addEventListener("click",showAuth);
}

/* ===================== 11. Arranque ===================== */
function bind(){
 $$(".profile-option").forEach(b=>b.addEventListener("click",()=>selectProfile(b.dataset.profile)));
 $("#backToProfiles").addEventListener("click",()=>{appState.profile=null;$("#passwordStep").classList.add("hidden");$("#password").value="";$("#authError").textContent="";setPasswordVisible(false);$$(".profile-option").forEach(x=>{x.classList.remove("selected");x.setAttribute("aria-pressed","false")});$(".profile-option")?.focus()});
 $("#loginBtn").addEventListener("click",login);
 $("#togglePassword").addEventListener("click",()=>setPasswordVisible($("#password").type==="password"));
 $("#password").addEventListener("keydown",e=>{if(e.key==="Enter")login()});
 $$(".nav-btn").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
 $("#garmentCategory").addEventListener("change",()=>{syncGarmentCategory(true);suggestOccasionsForSelection()});
 $("#garmentType").addEventListener("change",suggestOccasionsForSelection);

 $$("[data-garment-category]").forEach(btn=>btn.addEventListener("click",()=>{$("#garmentCategory").value=btn.dataset.garmentCategory;syncGarmentCategory(true);suggestOccasionsForSelection()}));
 $("#garmentForm").addEventListener("submit",saveGarment);$("#closeGarment").addEventListener("click",closeGarment);$("#deleteGarment").addEventListener("click",deleteGarment);$("#analyzeBtn").addEventListener("click",analyzeGarment);
 const onPhoto=async e=>{
  const files=[...(e.target.files||[])],f=files[0];e.target.value="";if(!f)return;
  /* Varias fotos de la galería (subir el armario): se procesan una a una y se guardan solas (loadSheetFile) */
  if(files.length>1&&!$("#garmentId").value){bulkQueue=files.slice(1);bulkTotal=files.length;updateBulkTitle()}
  await loadSheetFile(f)};
 loadSheetFile=async f=>{
  let original;try{original=await readImage(f)}catch(err){return toast(err.message==="IMAGE_TOO_LARGE"?"La imagen es demasiado grande":"No se pudo leer la foto")}
  const ph=sheetPhoto={original,edited:null,mode:"original",changed:true},bulk=bulkTotal>1&&!$("#garmentId").value,prof=appState.profile?.id;renderPhotoControls();
  const live=()=>sheetPhoto===ph&&appState.profile?.id===prof&&!$("#garmentSheet").classList.contains("hidden"); /* sigue abierta, misma foto y mismo perfil */
  if($("#autoWhite")?.checked)await makeSheetWhite();
  if(sheetPhoto!==ph)return;
  const auto=$("#autoAnalyze")?.checked,canAI=auto&&aiUsage().analyze<AI_LIMITS.analyze;
  if(auto&&!canAI)setAnalyzeStatus(QUOTA_SHEET_MSG); /* sin análisis hoy: no insistir en cada foto de la subida */
  let verdict=null;if(canAI){if(bulk)verdict=await analyzeGarment();else analyzeGarment()}
  /* Subida de varias fotos (Noelia, 10/10/2026: «el usuario tiene que hacer lo mínimo posible»): cada prenda se guarda sola tras
     mejorarla y analizarla; si no hubo análisis, con el color estimado en el móvil, y «Completar con IA» la termina después */
  if(bulk&&live()){
   if(verdict==="rejected"){const next=bulkQueue.shift();if(next){openGarment();updateBulkTitle();return loadSheetFile(next)}closeGarment(true);bulkTotal=0;return render()} /* ropa interior: no se guarda, se pasa a la siguiente (revisión de Codex, #207) */
   if(!$("#garmentColor").value.trim()){const c=await guessColor(sheetImage());if(live()&&c)$("#garmentColor").value=c}
   if(live())$("#garmentForm").requestSubmit()}};
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

/* Atelier family: metadata visible, editable and auto-detected. Works atop v4 without changing its data layer. */
(() => {
"use strict";
const visualDefs=[
 ["subtype","Subtipo (ej. blazer, vaquero)",80],
 ["secondaryColor","Color secundario",60],
 ["fit","Corte",["","oversize","holgado","regular","entallado","ajustado","recto"]],
 ["sleeve","Manga",["","sin mangas","corta","tres cuartos","larga","no aplica"]],
 ["neckline","Escote / cuello",["","redondo","pico","camisero","alto","barco","palabra de honor","no aplica"]],
 ["thickness","Grosor",["","ligero","medio","grueso"]],
 ["warmth","Abrigo",["","bajo","medio","alto"]],
 ["details","Detalles visibles",180],
 ["confidence","Confianza global del análisis",["","alta","media","baja"]]
];
const manualDefs=[["brand","Marca (si la conoces)",80],["size","Talla",35],["composition","Composición de etiqueta",140]];
const baseDefs=[
 ["pattern","Estampado",["","plain","stripes","checks","floral","animal","dots","graphic","other"]],
 ["fabric","Tejido aparente",["","unknown","cotton","denim","linen","wool","knit","leather","satin","silk","synthetic","mixed"]],
 ["length","Longitud",["","na","cropped","regular","midi","long"]],
 ["formality","Formalidad",["","casual","smartcasual","formal","party","sport"]],
 ["occasions","Ocasiones: daily,work,dinner,event,travel",120]
];
const extraKeys=new Set([...visualDefs,...manualDefs].map(d=>d[0]));
const allDefs=[...baseDefs,...visualDefs,...manualDefs];
const id=k=>"meta-"+k;
let busy=false,analysisRevision=0;
function plainText(v,max){return typeof v==="string"?v.trim().slice(0,max):""}
function safeValue(d,value){
 if(Array.isArray(d[2]))return d[2].includes(value)?value:"";
 return plainText(value,d[2]);
}
function field(d){
 const div=document.createElement("label");div.className="field";
 const title=document.createElement("span");title.textContent=d[1];div.append(title);
 let input;
 if(Array.isArray(d[2])){
  input=document.createElement("select");
  for(const v of d[2]){const option=document.createElement("option");option.value=v;option.textContent=v||"Sin especificar";input.append(option)}
 }else {input=document.createElement("input");input.type="text";input.maxLength=d[2]}
 input.id=id(d[0]);input.dataset.metadata=d[0];div.append(input);return div;
}
function build(){
 const form=document.querySelector("#garmentForm");
 if(!form||document.querySelector("#metadataDetails"))return;
 const notes=document.querySelector("#garmentNotes")?.closest(".field");
 const details=document.createElement("details");details.id="metadataDetails";details.className="feature-card";
 const summary=document.createElement("summary");summary.textContent="Características de la prenda · revisar y corregir";details.append(summary);
 const help=document.createElement("p");help.className="helper";help.textContent="La IA puede estimar estos rasgos a partir de la foto, pero no garantiza tejido o composición. Corrige cualquier dato dudoso. Marca, talla y composición se rellenan manualmente.";details.append(help);
 for(const def of allDefs)details.append(field(def));
 notes?.before(details);
 const image=document.querySelector("#garmentImage");
 if(image){
  const option=document.createElement("label");option.className="switch-line";option.id="autoAnalyzeOption";
  const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.id="autoAnalyze";checkbox.checked=true;
  option.append(checkbox,document.createTextNode(" Analizar automáticamente al seleccionar una foto"));
  const state=document.createElement("p");state.id="autoAnalyzeStatus";state.className="helper";state.setAttribute("role","status");state.setAttribute("aria-live","polite");
  image.closest(".field")?.append(option,state);
  image.addEventListener("change",async () => {
   const file=image.files?.[0],revision=++analysisRevision;
   if(!file||!checkbox.checked||busy)return;
   // Keep the user in control: no auto-save, only a proposal to review.
   await analyzeForReview(revision);
  });
 }
}
function setStatus(message){const s=document.querySelector("#autoAnalyzeStatus");if(s)s.textContent=message}
function populate(source){
 for(const d of allDefs){
  const el=document.getElementById(id(d[0]));if(!el)continue;
  const v=d[0]==="occasions"?(Array.isArray(source?.occasions)?source.occasions.join(", "):""):source?.[d[0]];
  el.value=safeValue(d,v)||"";
 }
}
function read(){
 const result={};
 for(const d of allDefs){
  const el=document.getElementById(id(d[0]));if(!el)continue;
  if(d[0]==="occasions"){
   const options=["daily","work","dinner","event","travel"];
   const unique=[...new Set(el.value.split(",").map(x=>x.trim().toLowerCase()).filter(x=>options.includes(x)))];
   if(unique.length)result.occasions=unique;
   continue;
  }
  const v=safeValue(d,el.value);
  if(v)result[d[0]]=v;
 }
 return result;
}
const originalClean=cleanAnalysis;
cleanAnalysis=function(d){
 const result=originalClean(d);
 for(const def of visualDefs){
  const raw=d?.[def[0]];
  const v=safeValue(def,raw);
  if(v)result[def[0]]=v;
 }
 return result;
};
const originalOpen=openGarment;
openGarment=function(garmentId){
 originalOpen(garmentId);
 build();analysisRevision++;
 const g=appState.data.garments.find(x=>x.id===garmentId);
 populate(g);
 lastAnalysis=g?read():null;
 setStatus("");
 const section=document.querySelector("#metadataDetails");if(section)section.open=false;
};
const originalSave=saveGarment;
saveGarment=async function(e){
 // Original saveGarment persists lastAnalysis while preserving existing photographs and profile-specific storage.
 const revised=read();
 lastAnalysis={...(lastAnalysis||{}),...revised};
 return originalSave(e);
};
const originalAnalyze=analyzeGarment;
analyzeGarment=async function(){
 if(busy)return;
 busy=true;
 const input=document.querySelector("#garmentImage"),before=input?.files?.[0],profile=appState.profile?.id;
 if(input)input.disabled=true;
 setStatus("Analizando fotografía… Puedes revisar los campos antes de guardarla.");
 try{
  await originalAnalyze();
  if(before===input?.files?.[0]&&profile===appState.profile?.id&&lastAnalysis){
   populate({...read(),...lastAnalysis});document.querySelector("#metadataDetails")?.setAttribute("open","");
   setStatus("Datos sugeridos por IA. Comprueba y corrige los atributos antes de guardar.");
  }else setStatus("Revisa manualmente los datos de la prenda.");
 }finally{if(input)input.disabled=false;busy=false}
};
async function analyzeForReview(revision){
 if(revision!==analysisRevision)return;
 try{await analyzeGarment()}catch(e){console.error("AUTO_METADATA",e);setStatus("No se pudo analizar. Puedes introducir los datos a mano o reintentarlo.")}
}
document.addEventListener("DOMContentLoaded",build);
})();

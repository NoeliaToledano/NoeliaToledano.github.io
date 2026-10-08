
/* Atelier v3: advanced wardrobe and styling features. Local-only, profile-scoped data. */
const featureState={search:"",category:"",season:"",onlyFavorites:false,onlyForgotten:false,sort:"recent",calendarMonth:new Date().toISOString().slice(0,7),lookFilter:"all",wishlistFilter:"all",selectedGarment:null,activePackingId:null};
const fx=(v)=>esc(v==null?"":v);
const dayISO=(date=new Date())=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10);
const euro=(n)=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(n)||0);
const validDay=(d)=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+"T12:00:00"));
const occasions={daily:"Día a día",work:"Trabajo",dinner:"Cena",event:"Evento",travel:"Viaje"};
const seasons={all:"Todo el año",warm:"Primavera / verano",cold:"Otoño / invierno"};
const myGarments=()=>appState.data.garments;
const myLooks=()=>appState.data.looks;
const logs=()=>appState.data.wearLog;
const wornCount=(id)=>logs().filter(l=>Array.isArray(l.garmentIds)&&l.garmentIds.includes(id)).length;
const lastWorn=(id)=>logs().filter(l=>Array.isArray(l.garmentIds)&&l.garmentIds.includes(id)&&validDay(l.date)).map(l=>l.date).sort().at(-1)||null;
const dayAge=(d)=>validDay(d)?Math.max(0,Math.floor((new Date(dayISO()+"T12:00:00")-new Date(d+"T12:00:00"))/86400000)):null;
const thisSeason=()=>[4,5,6,7,8,9].includes(new Date().getMonth())?"warm":"cold";
const notInSeason=(g)=>g.season&&g.season!=="all"&&g.season!==thisSeason();
function forgottenStatus(g){
 const last=lastWorn(g.id),d=last||String(g.createdAt||"").slice(0,10),age=dayAge(d),threshold=Number(appState.data.preferences.forgottenDays)||60;
 if(age===null||notInSeason(g))return {forgotten:false,age,reason:notInSeason(g)?"Fuera de temporada":"Sin fecha de referencia"};
 return {forgotten:age>=threshold,age,reason:last?"Desde el último uso":"Sin usos registrados desde que la añadiste"};
}
function recommendGarments(){
 const diversity=(Number(appState.data.preferences.diversity)||65)/100;
 return myGarments().slice().sort((a,b)=>{
  const ra=forgottenStatus(a),rb=forgottenStatus(b);
  const score=g=>(g.favorite?1:0)+diversity*(8/(1+wornCount(g.id)))+(forgottenStatus(g).forgotten?4:0);
  return score(b)-score(a);
 });
}
async function mutate(action,success){
 action();
 if(await saveState()){render();if(success)toast(success);return true}
 return false;
}
function featureHeader(title,subtitle){return '<section class="hero"><h1>'+fx(title)+'</h1><p>'+fx(subtitle)+'</p></section>'}
function miniStat(label,value){return '<div class="stat"><strong>'+fx(value)+'</strong><span class="muted">'+fx(label)+'</span></div>'}
function optionList(values,current){return values.map(v=>'<option value="'+fx(v[0])+'"'+(String(current)===String(v[0])?' selected':'')+'>'+fx(v[1])+'</option>').join("")}
function setContent(root,html){root.innerHTML=html}
const previousRender=render;
render=function(){
 const root=$("#content");
 if(!appState.profile)return;
 if(appState.view==="wardrobe")return renderAdvancedWardrobe(root);
 if(appState.view==="stylist")return renderStylist(root);
 if(appState.view==="shopping")return renderShopping(root);
 if(appState.view==="insights")return renderInsights(root);
 if(appState.view==="looks")return renderAdvancedLooks(root);
 if(appState.view==="calendar")return renderCalendar(root);
 if(appState.view==="packing")return renderPacking(root);
 if(appState.view==="settings")return renderAdvancedSettings(root);
 return previousRender();
};
const previousSetView=setView;
setView=function(v){
 appState.view=v;
 $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===v||(v==="looks"&&b.dataset.view==="stylist")||(v==="calendar"&&b.dataset.view==="insights")));
 render();
 window.scrollTo(0,0);
};
function renderAdvancedWardrobe(root){
 const cats=[...new Set(myGarments().map(g=>g.category).filter(Boolean))].sort();
 let gs=myGarments().filter(g=>{
  const q=featureState.search.toLocaleLowerCase("es");
  return (!q||[g.name,g.category,g.color,g.notes,g.style].join(" ").toLocaleLowerCase("es").includes(q))&&
  (!featureState.category||g.category===featureState.category)&&
  (!featureState.season||g.season===featureState.season)&&
  (!featureState.onlyFavorites||g.favorite)&&
  (!featureState.onlyForgotten||forgottenStatus(g).forgotten);
 });
 if(featureState.sort==="least")gs.sort((a,b)=>wornCount(a.id)-wornCount(b.id));
 else if(featureState.sort==="most")gs.sort((a,b)=>wornCount(b.id)-wornCount(a.id));
 else if(featureState.sort==="name")gs.sort((a,b)=>String(a.name).localeCompare(String(b.name),"es"));
 else if(featureState.sort==="oldest")gs.sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
 else gs.sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
 const filters='<div class="filter-panel"><label class="field"><span>Buscar prendas</span><input id="wardrobeSearch" type="search" placeholder="Nombre, color, estilo…" value="'+fx(featureState.search)+'"></label>'+
 '<details id="advancedFilters"><summary>Filtros y ordenación ▾</summary><div class="filter-grid">'+
 '<label class="field"><span>Categoría</span><select id="filterCategory">'+optionList([["","Todas"],...cats.map(c=>[c,c])],featureState.category)+'</select></label>'+
 '<label class="field"><span>Temporada</span><select id="filterSeason">'+optionList([["","Todas"],...Object.entries(seasons)],featureState.season)+'</select></label>'+
 '<label class="field"><span>Ordenar</span><select id="filterSort">'+optionList([["recent","Recientes"],["name","Nombre"],["least","Menos usadas"],["most","Más usadas"],["oldest","Más antiguas"]],featureState.sort)+'</select></label>'+
 '</div><label class="switch-line"><input type="checkbox" id="onlyFavorites"'+(featureState.onlyFavorites?' checked':'')+'> Solo favoritas</label>'+
 '<label class="switch-line"><input type="checkbox" id="onlyForgotten"'+(featureState.onlyForgotten?' checked':'')+'> Solo prendas olvidadas</label>'+
 '<button class="secondary small" id="resetFilters">Limpiar filtros</button></details></div>';
 const cards=gs.map(g=>{
  const f=forgottenStatus(g),n=wornCount(g.id);
  return '<div class="garment-tile">'+garmentCard(g)+'<div class="tile-tools">'+
   '<button class="chip-button" data-fav="'+fx(g.id)+'" aria-label="Favorito">'+(g.favorite?'♥':'♡')+'</button>'+
   '<button class="chip-button" data-wear="'+fx(g.id)+'" aria-label="Registrar uso">✓ Usada</button>'+ '<button class="chip-button" data-combine="'+fx(g.id)+'" aria-label="Combinar esta prenda">✦ Combinar</button></div>'+
   '<div class="tile-hints">'+fx(n+' usos registrados')+(f.forgotten?' · ✦ Olvidada':'')+'</div></div>';
 }).join("");
 setContent(root,featureHeader("Mi armario","Toda tu ropa, aprovechada al máximo.")+
 '<div class="stats">'+miniStat("prendas",myGarments().length)+miniStat("favoritas",myGarments().filter(g=>g.favorite).length)+miniStat("olvidadas",myGarments().filter(g=>forgottenStatus(g).forgotten).length)+miniStat("looks",myLooks().length)+'</div>'+
 '<div class="section-head"><h2>Prendas <span class="muted">('+gs.length+')</span></h2><button id="addGarment" class="primary">+ Añadir</button></div>'+filters+
 (gs.length?'<div class="grid">'+cards+'</div>':'<div class="empty"><h3>No hay prendas con estos filtros</h3><p class="muted">Prueba otro filtro o añade una prenda.</p><button class="primary" id="emptyAdd">Añadir prenda</button></div>'));
 $("#addGarment")?.addEventListener("click",()=>openGarment());
 $("#emptyAdd")?.addEventListener("click",()=>openGarment());
 $("#wardrobeSearch")?.addEventListener("input",e=>{featureState.search=e.target.value;const pos=e.target.selectionStart;renderAdvancedWardrobe(root);const input=$("#wardrobeSearch");input.focus();input.setSelectionRange(pos,pos)});
 for(const [id,key] of [["filterCategory","category"],["filterSeason","season"],["filterSort","sort"],["onlyFavorites","onlyFavorites"],["onlyForgotten","onlyForgotten"]]){
  $("#"+id)?.addEventListener("change",e=>{featureState[key]=e.target.type==="checkbox"?e.target.checked:e.target.value;renderAdvancedWardrobe(root);const dt=$("#advancedFilters");if(dt)dt.open=true});
 }
 $("#resetFilters")?.addEventListener("click",()=>{Object.assign(featureState,{search:"",category:"",season:"",onlyFavorites:false,onlyForgotten:false,sort:"recent"});render()});
 $$("[data-garment]",root).forEach(x=>x.addEventListener("click",()=>openGarment(x.dataset.garment)));
 $$("[data-fav]",root).forEach(b=>b.addEventListener("click",async()=>{const g=myGarments().find(x=>x.id===b.dataset.fav);if(g)await mutate(()=>{g.favorite=!g.favorite},"Favoritos actualizados")}));
 $("[data-wear]",root).forEach(b=>b.addEventListener("click",()=>promptWear([b.dataset.wear],null)));
 $("[data-combine]",root).forEach(b=>b.addEventListener("click",()=>{featureState.selectedGarment=b.dataset.combine;openLook()}));
}
function promptWear(ids,lookId){
 const date=prompt("¿Qué día llevaste este conjunto? (AAAA-MM-DD)",dayISO());
 if(date===null)return;
 if(!validDay(date)||date>dayISO())return toast("Introduce una fecha válida, no futura");
 recordWear(ids,date,lookId);
}
async function recordWear(ids,date,lookId){
 const validIds=[...new Set(ids)].filter(id=>myGarments().some(g=>g.id===id));
 if(!validIds.length)return toast("No hay prendas para registrar");
 await mutate(()=>appState.data.wearLog.unshift({id:uid(),date,garmentIds:validIds,lookId:lookId||null}),"Uso registrado");
}
function renderStylist(root){
 const p=appState.data.preferences;
 const candidates=recommendGarments().slice(0,5);
 setContent(root,featureHeader("Tu estilista","Combina lo que ya tienes. La IA no inventará prendas.")+
 '<div class="feature-card"><div class="section-head"><h2>¿Qué me pongo hoy?</h2><span class="muted">IA</span></div>'+
 '<div class="filter-grid"><label class="field"><span>Ocasión</span><select id="prefOccasion">'+optionList(Object.entries(occasions),p.occasion)+'</select></label>'+
 '<label class="field"><span>Temporada</span><select id="prefSeason">'+optionList(Object.entries(seasons),p.season)+'</select></label></div>'+
 '<label class="field"><span>Temperatura exterior manual (opcional, °C)</span><input id="prefTemperature" type="number" min="-30" max="55" step="1" value="'+fx(p.temperature??"")+'"></label>'+ 
 '<div class="field"><label for="prefDiversity">Diversidad <abbr title="Cuánto priorizar prendas poco usadas para variar tus looks">ⓘ</abbr>: <strong id="diversityText">'+fx(p.diversity)+'</strong>%</label><input id="prefDiversity" type="range" min="0" max="100" step="5" value="'+fx(p.diversity)+'"></div>'+
 '<label class="switch-line"><input id="prefAvoid" type="checkbox"'+(p.avoidRepeats?' checked':'')+'> Evitar repetir combinaciones recientes</label>'+
 '<button class="primary wide" id="suggestSmart">✦ Generar looks con mi ropa</button>'+
 '<p class="helper">Se utilizan únicamente los nombres y atributos de tus prendas. Las fotos no se envían para generar looks.</p></div>'+
 '<div class="section-head"><h2>Mis looks</h2><button class="secondary" id="openLooks">Ver todos →</button></div>'+
 '<div class="actions"><button class="secondary" id="createManual">+ Crear look manual</button><button class="secondary" id="openCalendar">Calendario de uso</button><button class="secondary" id="openPacking">Preparar maleta</button></div>'+
 '<div class="section-head"><h2>Rescata una prenda olvidada</h2></div>'+
 (candidates.length?'<div class="insight-list">'+candidates.map(g=>'<div class="list-line"><strong>'+fx(g.name)+'</strong><span class="muted">'+fx(wornCount(g.id)+' usos')+'</span></div>').join("")+'</div>':'<div class="empty">Añade prendas para recibir sugerencias.</div>'));
 $("#prefOccasion")?.addEventListener("change",e=>setPref("occasion",e.target.value,false));
 $("#prefSeason")?.addEventListener("change",e=>setPref("season",e.target.value,false));
 $("#prefTemperature")?.addEventListener("change",e=>{const v=e.target.value;const n=Number(v);if(v===""||(Number.isFinite(n)&&n>=-30&&n<=55))setPref("temperature",v===""?null:n,false);else toast("Introduce entre -30 y 55 °C")});
 $("#prefDiversity")?.addEventListener("input",e=>{$("#diversityText").textContent=e.target.value;setPref("diversity",Number(e.target.value),false)});
 $("#prefAvoid")?.addEventListener("change",e=>setPref("avoidRepeats",e.target.checked,false));
 $("#suggestSmart")?.addEventListener("click",()=>suggestLooks());
 $("#openLooks")?.addEventListener("click",()=>setView("looks"));
 $("#createManual")?.addEventListener("click",()=>openLook());
 $("#openCalendar")?.addEventListener("click",()=>setView("calendar"));
 $("#openPacking")?.addEventListener("click",()=>setView("packing"));
}
async function setPref(key,val,rerender=true){appState.data.preferences[key]=val;if(await saveState()&&rerender)render()}
function renderAdvancedLooks(root){
 let looks=myLooks();
 if(featureState.lookFilter==="favorites")looks=looks.filter(l=>l.favorite);
 if(featureState.lookFilter==="ai")looks=looks.filter(l=>l.ai);
 setContent(root,featureHeader("Mis looks","Tu historial de combinaciones favoritas y sugerencias.")+
 '<div class="section-head"><h2>Conjuntos ('+looks.length+')</h2><button class="primary" id="newLook">+ Crear</button></div>'+
 '<div class="filter-tabs"><button class="chip-button" data-look-filter="all">Todos</button><button class="chip-button" data-look-filter="favorites">Favoritos ♡</button><button class="chip-button" data-look-filter="ai">Sugeridos por IA</button></div>'+
 '<button class="secondary wide" id="aiLooks">✦ Sugerir nuevos looks</button>'+
 (looks.length?'<div class="grid">'+looks.map(l=>'<div class="look-tile">'+lookCard(l)+
 '<div class="tile-tools"><button class="chip-button" data-look-fav="'+fx(l.id)+'">'+(l.favorite?'♥':'♡')+'</button>'+
 '<button class="chip-button" data-look-wear="'+fx(l.id)+'">✓ Llevado</button></div>'+
 '<div class="tile-tools"><button class="chip-button" data-feedback="'+fx(l.id)+'" data-vote="up">👍</button><button class="chip-button" data-feedback="'+fx(l.id)+'" data-vote="down">👎</button></div>'+
 '<div class="tile-hints">'+fx((appState.data.feedback[l.id]||"")+" · "+(l.ai?"IA":"Manual"))+'</div></div>').join("")+'</div>':'<div class="empty">Todavía no tienes looks para este filtro.</div>'));
 $("#newLook")?.addEventListener("click",()=>openLook());$("#aiLooks")?.addEventListener("click",()=>suggestLooks());
 $$("[data-look-filter]",root).forEach(b=>b.addEventListener("click",()=>{featureState.lookFilter=b.dataset.lookFilter;render()}));
 $$("[data-look]",root).forEach(b=>b.addEventListener("click",()=>openLook(b.dataset.look)));
 $$("[data-look-fav]",root).forEach(b=>b.addEventListener("click",async()=>{const l=myLooks().find(l=>l.id===b.dataset.lookFav);if(l)await mutate(()=>{l.favorite=!l.favorite},"Look actualizado")}));
 $$("[data-look-wear]",root).forEach(b=>b.addEventListener("click",()=>{const l=myLooks().find(l=>l.id===b.dataset.lookWear);if(l)promptWear(l.garmentIds,l.id)}));
 $$("[data-feedback]",root).forEach(b=>b.addEventListener("click",async()=>{const id=b.dataset.feedback;await mutate(()=>{appState.data.feedback[id]=b.dataset.vote},"Preferencia guardada")}));
}
function renderShopping(root){
 const wishlist=appState.data.wishlist.filter(w=>featureState.wishlistFilter!=="pending"||!w.bought);
 const existingCats=new Set(myGarments().map(g=>g.category));
 const gaps=[["Zapatos","Zapatos"],["Arriba","Prendas superiores"],["Abajo","Prendas inferiores"],["Capas","Capas y abrigos"],["Accesorios","Accesorios"]].filter(x=>!existingCats.has(x[0]));
 const total=appState.data.wishlist.filter(w=>!w.bought).reduce((s,w)=>s+(Number(w.price)||0),0);
 setContent(root,featureHeader("Compras inteligentes","Deseos, presupuesto y combinaciones posibles.")+
 '<div class="stats">'+miniStat("pendientes",appState.data.wishlist.filter(w=>!w.bought).length)+miniStat("total previsto",euro(total))+'</div>'+
 '<div class="feature-card"><h2>Mi wishlist</h2><form id="wishlistForm"><label class="field"><span>Prenda que quiero</span><input name="wishName" maxlength="80" required placeholder="Por ejemplo, abrigo camel"></label>'+
 '<div class="filter-grid"><label class="field"><span>Precio (€)</span><input name="wishPrice" type="number" min="0" max="100000" step=".01" inputmode="decimal"></label>'+
 '<label class="field"><span>Categoría</span><select name="wishCategory">'+optionList([["","Sin categoría"],["Arriba","Arriba"],["Abajo","Abajo"],["Vestidos","Vestidos"],["Capas","Capas"],["Zapatos","Zapatos"],["Bolsos","Bolsos"],["Accesorios","Accesorios"]],"")+'</select></label></div>'+
 '<label class="field"><span>Enlace (opcional)</span><input name="wishUrl" type="url" placeholder="https://..."></label>'+
 '<button class="primary wide" type="submit">Añadir a mi lista</button></form></div>'+
 '<div class="section-head"><h2>Mis deseos</h2><button id="wishPending" class="secondary">'+(featureState.wishlistFilter==="pending"?"Ver todos":"Solo pendientes")+'</button></div>'+
 (wishlist.length?'<div class="insight-list">'+wishlist.map(w=>{const similar=myGarments().filter(g=>g.category&&g.category===w.category).length;const link=/^https?:\/\//i.test(w.url||"")?'<a href="'+fx(w.url)+'" rel="noopener noreferrer" target="_blank">Ver tienda ↗</a>':"";return '<div class="wish-row"><div><strong>'+fx(w.name)+'</strong><p class="muted">'+euro(w.price)+(w.bought?' · Comprada':'')+(similar?' · '+similar+' prendas de esa categoría en tu armario':'')+'</p>'+link+'</div><div class="wish-actions"><button class="chip-button" data-wish-bought="'+fx(w.id)+'">'+(w.bought?'Pendiente':'Comprada ✓')+'</button><button class="chip-button" data-wish-remove="'+fx(w.id)+'">✕</button></div></div>'}).join("")+'</div>':'<div class="empty">Tu lista está vacía.</div>')+
 '<div class="feature-card"><h2>¿Qué te falta realmente?</h2><p class="muted">Según las categorías que has registrado, sin recomendar compras innecesarias.</p>'+
 (gaps.length?'<div class="insight-list">'+gaps.map(x=>'<div class="list-line">'+fx(x[1])+'<span class="muted">No registrada</span></div>').join("")+'</div>':'<p>Ya tienes variedad de categorías básicas. Prioriza combinar tu ropa actual.</p>')+
 '<label class="field"><span>Presupuesto de compras (€)</span><input id="shoppingBudget" type="number" min="0" max="100000" value="'+fx(appState.data.preferences.budget)+'"></label>'+
 (total>Number(appState.data.preferences.budget)?'<p class="error">Tu wishlist pendiente supera tu presupuesto.</p>':'<p class="muted">Tu wishlist cabe dentro del presupuesto indicado.</p>')+'</div>');
 $("#wishlistForm")?.addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(e.target),name=String(fd.get("wishName")||"").trim(),url=String(fd.get("wishUrl")||"").trim();if(!name)return;if(url&&!/^https?:\/\//i.test(url))return toast("El enlace debe ser HTTPS o HTTP");await mutate(()=>appState.data.wishlist.unshift({id:uid(),name,price:Number(fd.get("wishPrice"))||0,category:String(fd.get("wishCategory")||""),url,bought:false,addedAt:dayISO()}),"Añadido a la wishlist")});
 $("#wishPending")?.addEventListener("click",()=>{featureState.wishlistFilter=featureState.wishlistFilter==="all"?"pending":"all";render()});
 $("#shoppingBudget")?.addEventListener("change",e=>setPref("budget",Math.max(0,Number(e.target.value)||0)));
 $$("[data-wish-bought]",root).forEach(b=>b.addEventListener("click",async()=>{const w=appState.data.wishlist.find(w=>w.id===b.dataset.wishBought);if(w)await mutate(()=>{w.bought=!w.bought},"Compra actualizada")}));
 $$("[data-wish-remove]",root).forEach(b=>b.addEventListener("click",async()=>{if(!confirm("¿Quitar de la wishlist?"))return;await mutate(()=>{appState.data.wishlist=appState.data.wishlist.filter(w=>w.id!==b.dataset.wishRemove)},"Eliminado")}));
}
function renderInsights(root){
 const gs=myGarments(),n=logs().length,forgotten=gs.filter(g=>forgottenStatus(g).forgotten),never=gs.filter(g=>!lastWorn(g.id)),priced=gs.filter(g=>g.price!==null&&g.price!==undefined),totalValue=priced.reduce((s,g)=>s+(Number(g.price)||0),0);
 const cats=[...new Set(gs.map(g=>g.category||"Sin categoría"))].map(c=>({name:c,n:gs.filter(g=>(g.category||"Sin categoría")===c).length})).sort((a,b)=>b.n-a.n);
 const ranked=gs.slice().sort((a,b)=>wornCount(b.id)-wornCount(a.id));
 setContent(root,featureHeader("Tu armario en cifras","Decisiones basadas en usos que hayas registrado.")+
 '<div class="stats">'+miniStat("prendas",gs.length)+miniStat("usos registrados",n)+miniStat("olvidadas",forgotten.length)+miniStat("valor registrado",euro(totalValue))+'</div>'+
 '<div class="feature-card"><div class="section-head"><h2>Prendas olvidadas</h2><button class="secondary" id="configureForget">Configurar</button></div>'+
 '<p class="muted">Sin utilizar durante al menos '+fx(appState.data.preferences.forgottenDays)+' días. Excluimos las prendas fuera de temporada. Las que no tienen fecha suficiente no se clasifican como olvidadas.</p>'+
 (forgotten.length?'<div class="insight-list">'+forgotten.map(g=>'<div class="list-line"><strong>'+fx(g.name)+'</strong><span class="muted">'+fx(forgottenStatus(g).age)+' días · '+fx(forgottenStatus(g).reason)+'</span></div>').join("")+'</div>':'<p>De momento no hay prendas identificadas como olvidadas.</p>')+
 '<p class="helper">'+never.length+' prendas sin usos registrados. Esto no demuestra que nunca te las hayas puesto.</p></div>'+
 '<div class="feature-card"><h2>Rotación de prendas</h2><div class="insight-list">'+(ranked.length?ranked.slice(0,12).map(g=>'<div class="progress-row"><span>'+fx(g.name)+'</span><div class="progress-track"><div style="width:'+Math.round(100*wornCount(g.id)/Math.max(1,wornCount(ranked[0].id)))+'%"></div></div><strong>'+wornCount(g.id)+'</strong></div>').join(""):'Añade prendas para ver su rotación.')+'</div></div>'+
 '<div class="feature-card"><h2>Distribución por categorías</h2><div class="insight-list">'+cats.map(c=>'<div class="progress-row"><span>'+fx(c.name)+'</span><div class="progress-track"><div style="width:'+Math.round(100*c.n/Math.max(1,gs.length))+'%"></div></div><strong>'+c.n+'</strong></div>').join("")+'</div></div>'+
 '<div class="feature-card"><h2>Coste por uso</h2><p class="helper">Disponible cuando introduces el precio de compra y registras usos.</p>'+
 (priced.length?'<div class="insight-list">'+priced.filter(g=>wornCount(g.id)>0).sort((a,b)=>(Number(b.price)/wornCount(b.id))-(Number(a.price)/wornCount(a.id))).slice(0,12).map(g=>'<div class="list-line"><strong>'+fx(g.name)+'</strong><span>'+euro(g.price/wornCount(g.id))+' / uso</span></div>').join("")+'</div>':'<p>Registra el precio de tus prendas para calcularlo.</p>')+'</div>'+
 '<div class="actions"><button class="primary" id="goCalendar">Calendario e historial</button><button class="secondary" id="goForgotten">Ver olvidadas</button></div>');
 $("#goCalendar")?.addEventListener("click",()=>setView("calendar"));
 $("#goForgotten")?.addEventListener("click",()=>{featureState.onlyForgotten=true;featureState.search="";setView("wardrobe")});
 $("#configureForget")?.addEventListener("click",()=>{const v=prompt("Días sin usar para considerar una prenda olvidada (30–365)",appState.data.preferences.forgottenDays);if(v===null)return;const n=Number(v);if(!Number.isInteger(n)||n<30||n>365)return toast("Introduce entre 30 y 365 días");setPref("forgottenDays",n)});
}
function renderCalendar(root){
 const month=featureState.calendarMonth,year=Number(month.slice(0,4)),mon=Number(month.slice(5,7)),days=new Date(year,mon,0).getDate(),first=(new Date(year,mon-1,1).getDay()+6)%7,byDay=new Map();
 for(const entry of logs())if(entry.date?.startsWith(month))byDay.set(entry.date,(byDay.get(entry.date)||0)+1);
 let grid="<div class='calendar-grid'>"+["L","M","X","J","V","S","D"].map(d=>'<span class="weekday">'+d+'</span>').join("");
 for(let i=0;i<first;i++)grid+='<span></span>';
 for(let d=1;d<=days;d++){const date=month+"-"+String(d).padStart(2,"0"),count=byDay.get(date)||0;grid+='<button class="cal-day '+(count?"used":"")+'" data-cal-date="'+date+'"><strong>'+d+'</strong>'+(count?'<small>'+count+' uso'+(count!==1?'s':'')+'</small>':"")+'</button>'}grid+="</div>";
 const history=logs().slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,60);
 setContent(root,featureHeader("Calendario de looks","Solo los días que hayas registrado; nunca inventamos usos.")+
 '<div class="feature-card"><label class="field"><span>Mes</span><input id="calendarMonth" type="month" value="'+fx(month)+'"></label>'+grid+'</div>'+
 '<div class="section-head"><h2>Historial de usos</h2><button class="secondary" id="backInsights">← Análisis</button></div>'+
 (history.length?'<div class="insight-list">'+history.map(l=>'<div class="history-line"><div><strong>'+fx(l.date)+'</strong><p class="muted">'+fx(l.garmentIds.map(id=>myGarments().find(g=>g.id===id)?.name).filter(Boolean).join(" · "))+'</p></div><button class="chip-button" data-remove-use="'+fx(l.id)+'">Eliminar</button></div>').join("")+'</div>':'<div class="empty">Todavía no has registrado ningún conjunto utilizado.</div>'));
 $("#calendarMonth")?.addEventListener("change",e=>{featureState.calendarMonth=e.target.value||dayISO().slice(0,7);render()});
 $("#backInsights")?.addEventListener("click",()=>setView("insights"));
 $$("[data-cal-date]",root).forEach(b=>b.addEventListener("click",()=>{const day=b.dataset.calDate,items=logs().filter(l=>l.date===day);toast(items.length?items.length+" usos registrados el "+day:"Sin usos registrados el "+day)}));
 $$("[data-remove-use]",root).forEach(b=>b.addEventListener("click",async()=>{if(!confirm("¿Eliminar este registro de uso?"))return;await mutate(()=>{appState.data.wearLog=logs().filter(l=>l.id!==b.dataset.removeUse)},"Registro eliminado")}));
}
function downloadBackup(){
 const payload=JSON.stringify({type:"atelier-backup",version:3,profile:appState.profile.id,exportedAt:new Date().toISOString(),data:appState.data});
 const url=URL.createObjectURL(new Blob([payload],{type:"application/json"})),a=document.createElement("a");
 a.href=url;a.download="atelier-"+appState.profile.id+"-"+dayISO()+".json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importBackup(file){
 if(!file||file.size>60*1024*1024)return toast("Copia demasiado grande (máximo 60 MB)");
 try{
  const obj=JSON.parse(await file.text());
  if(obj?.type!=="atelier-backup"||obj.profile!==appState.profile.id||!obj.data||!Array.isArray(obj.data.garments)||!Array.isArray(obj.data.looks))return toast("Copia inválida o perteneciente a otro perfil");
  if(!confirm("¿Sustituir todos los datos actuales de "+appState.profile.name+" por esta copia? Esta acción no se puede deshacer."))return;
  await mutate(()=>{appState.data=normalizeData(obj.data)},"Copia restaurada");
 }catch(e){console.error("BACKUP",e);toast("No se pudo importar la copia")}
}
function renderAdvancedSettings(root){
 const p=appState.data.preferences;
 setContent(root,featureHeader("Ajustes","Perfil "+appState.profile.name)+
 '<div class="feature-card"><h2>Preferencias del estilista</h2>'+
 '<label class="field"><span>Prenda olvidada tras (días)</span><input id="settingsForget" type="number" min="30" max="365" value="'+fx(p.forgottenDays)+'"></label>'+
 '<label class="field"><span>Diversidad de combinaciones: <strong id="settingsDiversityText">'+fx(p.diversity)+'</strong>%</span><input id="settingsDiversity" type="range" min="0" max="100" step="5" value="'+fx(p.diversity)+'"></label></div>'+
 '<div class="feature-card"><h2>Copias de seguridad</h2><p class="muted">Los datos y fotografías se guardan localmente en este navegador. No se sincronizan entre dispositivos. Exporta una copia antes de cambiar de móvil, borrar Safari o desinstalar la app.</p>'+
 '<button id="exportBackup" class="secondary wide">↓ Exportar copia JSON</button>'+
 '<label class="field"><span>Importar copia de este perfil</span><input id="importBackup" type="file" accept=".json,application/json"></label>'+
 '<p class="helper">La copia puede incluir fotografías y datos personales. Guárdala en un lugar privado.</p></div>'+
 '<button id="logout" class="danger wide">Cerrar sesión</button>');
 $("#settingsForget")?.addEventListener("change",e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=30&&n<=365)setPref("forgottenDays",n);else toast("Introduce entre 30 y 365 días")});
 $("#settingsDiversity")?.addEventListener("input",e=>{$("#settingsDiversityText").textContent=e.target.value;setPref("diversity",Number(e.target.value),false)});
 $("#exportBackup")?.addEventListener("click",downloadBackup);
 $("#importBackup")?.addEventListener("change",e=>importBackup(e.target.files[0]));
 $("#logout")?.addEventListener("click",showAuth);
}


/* Family MVP: private, offline packing lists, independent for each profile. */
function packingItems(list){
 const valid=new Map(myGarments().map(g=>[g.id,g]));
 return [...new Set(Array.isArray(list.garmentIds)?list.garmentIds:[])].map(id=>valid.get(id)).filter(Boolean);
}
function renderPacking(root){
 const packs=Array.isArray(appState.data.packingLists)?appState.data.packingLists:[];
 const selected=packs.find(x=>x.id===featureState.activePackingId);
 const names=selected?packingItems(selected):[];
 const selectedNames=selected?.checkedIds||[];
 setContent(root,featureHeader("Mis maletas","Prepara tus viajes con prendas reales de tu armario.")+
 '<div class="feature-card"><h2>Nueva maleta</h2><form id="packingForm">'+
 '<label class="field"><span>Nombre del viaje</span><input name="tripName" required maxlength="75" placeholder="Ej. Escapada de fin de semana"></label>'+
 '<label class="field"><span>Fecha de salida (opcional)</span><input type="date" name="tripDate"></label>'+
 '<p class="helper">Elige looks completos y añade cualquier otra prenda. No se comparte con otros perfiles.</p>'+
 (myLooks().length?'<details class="packing-picker"><summary>Elegir looks guardados</summary>'+myLooks().map(l=>'<label class="switch-line"><input type="checkbox" name="packingLook" value="'+fx(l.id)+'"> '+fx(l.name)+'</label>').join("")+'</details>':'')+
 '<details class="packing-picker"><summary>Elegir prendas sueltas</summary>'+ (myGarments().length?myGarments().map(g=>'<label class="switch-line"><input type="checkbox" name="packingGarment" value="'+fx(g.id)+'"> '+fx(g.name)+'</label>').join(""):'<p class="helper">Añade prendas al armario primero.</p>')+'</details>'+
 '<button class="primary wide" type="submit">Crear lista de maleta</button></form></div>'+
 '<div class="section-head"><h2>Mis viajes ('+packs.length+')</h2></div>'+
 (packs.length?'<div class="filter-tabs">'+packs.map(p=>'<button class="chip-button" data-packing-open="'+fx(p.id)+'"'+(selected?.id===p.id?' aria-current="true"':'')+'>'+fx(p.title)+'</button>').join("")+'</div>':'<div class="empty">Todavía no has preparado ninguna maleta.</div>')+
 (selected?'<section class="feature-card"><div class="section-head"><h2>'+fx(selected.title)+'</h2><button id="deletePacking" class="danger small">Eliminar</button></div>'+
 (selected.departure?'<p class="muted">Salida: '+fx(selected.departure)+'</p>':'')+
 '<p class="helper">'+selectedNames.filter(id=>names.some(g=>g.id===id)).length+' de '+names.length+' prendas preparadas</p>'+
 (names.length?names.map(g=>'<label class="packing-item"><input type="checkbox" data-packed-id="'+fx(g.id)+'"'+(selectedNames.includes(g.id)?' checked':'')+'><span>'+fx(g.name)+'</span></label>').join(""):'<p class="muted">Estas prendas ya no están en el armario.</p>')+
 '</section>':''));
 $("#packingForm")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const form=e.target,fd=new FormData(form),title=String(fd.get("tripName")||"").trim();
  if(!title)return;
  const chosenLooks=fd.getAll("packingLook").map(String);
  const chosenGarments=fd.getAll("packingGarment").map(String);
  const knownGarments=new Set(myGarments().map(g=>g.id));
  const lookIds=myLooks().filter(l=>chosenLooks.includes(l.id)).flatMap(l=>Array.isArray(l.garmentIds)?l.garmentIds:[]);
  const garmentIds=[...new Set([...chosenGarments,...lookIds])].filter(id=>knownGarments.has(id));
  if(!garmentIds.length)return toast("Elige al menos una prenda o un look");
  const id=uid(),departure=String(fd.get("tripDate")||"");
  await mutate(()=>{appState.data.packingLists.unshift({id,title,departure,garmentIds,checkedIds:[],createdAt:new Date().toISOString()});featureState.activePackingId=id},"Maleta creada");
 });
 $$("[data-packing-open]",root).forEach(b=>b.addEventListener("click",()=>{featureState.activePackingId=b.dataset.packingOpen;render()}));
 $$("[data-packed-id]",root).forEach(b=>b.addEventListener("change",async()=>{const id=b.dataset.packedId;await mutate(()=>{
  const list=appState.data.packingLists.find(p=>p.id===featureState.activePackingId);
  if(!list)return;list.checkedIds=b.checked?[...new Set([...(list.checkedIds||[]),id])]: (list.checkedIds||[]).filter(x=>x!==id);
 },"Maleta actualizada")}));
 $("#deletePacking")?.addEventListener("click",async()=>{
  if(!confirm("¿Eliminar esta lista de maleta?"))return;
  await mutate(()=>{appState.data.packingLists=appState.data.packingLists.filter(p=>p.id!==featureState.activePackingId);featureState.activePackingId=null},"Maleta eliminada");
 });
}

const CACHE="atelier-shell-v92";
const ASSETS=["./","./atelier.css","./atelier.js","./manifest.json"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith("atelier-v2-shell-")||key.startsWith("atelier-shell-"))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(request.mode==="navigate"){
  event.respondWith(fetch(request,{cache:"no-store"}).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put("./",copy)).catch(error=>console.warn("CACHE_NAV",error)))}
   return response;
  }).catch(()=>caches.match("./")));
  return;
 }
 event.respondWith(fetch(request).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(error=>console.warn("CACHE_ASSET",error)))}
  return response;
 }).catch(()=>caches.match(request)));
});

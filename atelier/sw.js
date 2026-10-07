const CACHE="atelier-shell-v15";
const ASSETS=["./manifest.json"];
self.addEventListener("install",event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)))});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("atelier-shell-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  if(event.request.mode==="navigate"||url.pathname.endsWith("/atelier/index.html")||url.pathname.endsWith("/atelier/payload.js")){
    event.respondWith(fetch(event.request,{cache:"no-store"}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));
});
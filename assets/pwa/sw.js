// BUFATECHNO WEB GAME DEV — PWA Service Worker v2
const CACHE = 'btgame-v2';
const ASSETS = ['./', './index.html', './src/main.js', './public/manifest.json'];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  e.respondWith(
    caches.match(e.request).then(cached=> cached || fetch(e.request).then(res=>{
      // Cache GET same-origin
      if(e.request.method==='GET' && e.request.url.startsWith(location.origin)){
        const clone=res.clone(); caches.open(CACHE).then(c=>c.put(e.request, clone));
      }
      return res;
    }).catch(()=> cached))
  );
});

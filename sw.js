'use strict';
const PREFIX = 'frekvence-lab-';
const CACHE = PREFIX + '2026-10-30-v3.0.0-release4';
const ASSETS = ['./','./index.html','./style.css','./app.js','./physics.js','./translations.js','./i18n.js','./manifest.webmanifest','./icons/apple-touch-icon.png','./icons/favicon.svg','./icons/icon-maskable-512.png','./icons/icon-192.png','./icons/icon-512.png','./vendor/three.min.js','./vendor/OrbitControls.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const cached=await cache.match(event.request);if(cached)return cached;
  try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate')return (await cache.match('./index.html'))||Response.error();return Response.error();}
 }));
});

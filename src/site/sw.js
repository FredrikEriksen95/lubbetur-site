// Lubbetur: frakoblet bruk. Siden hentes fra nettet først (ny versjon med en gang), og fra hurtiglageret når nettet mangler.
// Spar data: siden sjekkes mot serveren hver gang (no-cache), men lastes bare ned på nytt når den faktisk er endret.
const C = 'lubbetur-v2';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(C).then((c) => c.addAll(['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const nav = e.request.mode === 'navigate' || u.pathname === '/' || u.pathname.endsWith('/index.html');
  e.respondWith(caches.open(C).then(async (c) => {
    const key = nav ? './index.html' : e.request;
    const net = (nav ? fetch(u.origin + '/index.html', { cache: 'no-cache', credentials: 'same-origin' }) : fetch(e.request)).then((r) => { if (r && r.ok) c.put(key, r.clone()); return r; }).catch(() => null);
    if (nav) {
      const quick = await Promise.race([net, new Promise((res) => setTimeout(() => res('slow'), 5000))]);
      if (quick && quick !== 'slow') return quick;
      const hit = await c.match('./index.html');
      return hit || (await net) || new Response('Frakoblet', { status: 503 });
    }
    const hit = await c.match(e.request, { ignoreSearch: true });
    return hit || (await net) || new Response('Frakoblet', { status: 503 });
  }));
});

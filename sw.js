// =====================================================================
// sw.js — Service worker: guarda la app completa para usarla sin señal.
// Al publicar cambios, sube VERSION para que los teléfonos se actualicen.
// =====================================================================
const VERSION = 'cotizador-v5';
const ARCHIVOS = [
  './', './index.html', './manifest.webmanifest',
  './css/tokens.css', './css/app.css',
  './vendor/jspdf.umd.min.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/emblema.png', './icons/emblema.svg',
  './js/app.js', './js/calc.js', './js/config.js', './js/config-defaults.js', './js/cotizaciones.js',
  './js/db.js', './js/envio.js', './js/fotos.js', './js/icons.js', './js/pdf.js', './js/seed.js',
  './js/ui.js', './js/util.js', './js/whatsapp.js', './js/respaldo.js',
  './js/screens/ajustes.js', './js/screens/asistente.js', './js/screens/catalogo.js', './js/screens/cobro.js',
  './js/screens/comun.js', './js/screens/detalle.js', './js/screens/historial.js', './js/screens/inicio.js',
  './js/screens/orden.js', './js/screens/rapida.js', './js/screens/informe.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Red primero (para recibir actualizaciones) con respaldo en caché si no hay señal.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});

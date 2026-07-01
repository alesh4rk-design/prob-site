// Service Worker — Pro'B PWA
// Estratégia: "network-first" — sempre tenta buscar a versão mais nova online;
// se não conseguir (sem internet), usa a última versão salva em cache.
// Isso evita mostrar dados desatualizados quando há conexão, mas garante
// que o app pelo menos abra (modo offline básico) quando não há.

const CACHE_VERSION = 'prob-v1';
const PRECACHE_URLS = [
    'config.js',
    'favicon.ico',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png',
    'icon-192-maskable.png',
    'icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((nomes) =>
            Promise.all(
                nomes.filter((nome) => nome !== CACHE_VERSION).map((nome) => caches.delete(nome))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Só cuida de requisições GET, mesma origem (não mexe em chamadas ao Firestore/Google APIs)
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        fetch(req)
            .then((res) => {
                const resClone = res.clone();
                caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
                return res;
            })
            .catch(() =>
                caches.match(req).then((cached) => {
                    if (cached) return cached;
                    // Sem cache e sem internet: mensagem simples pra navegação de página
                    if (req.mode === 'navigate') {
                        return new Response(
                            '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Sem conexão — Pro\'B</title><style>body{background:#0a0e14;color:#e8f4f8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:2rem}</style></head><body><div><h2>📡 Sem conexão</h2><p>Conecte-se à internet e tente novamente.</p></div></body></html>',
                            { headers: { 'Content-Type': 'text/html; charset=UTF-8' } }
                        );
                    }
                    return new Response('', { status: 504, statusText: 'Offline' });
                })
            )
    );
});

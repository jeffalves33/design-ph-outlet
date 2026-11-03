const VERSAO = "ph-outlet-estaticos-v1";
const PRECACHE = [
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/ph_outlet.png",
  "/ph_kids.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(Promise.all([
    caches.keys().then((nomes) => Promise.all(nomes
      .filter((nome) => nome.startsWith("ph-outlet-estaticos-") && nome !== VERSAO)
      .map((nome) => caches.delete(nome)))),
    self.clients.claim(),
  ]));
});

self.addEventListener("message", (evento) => {
  if (evento.data?.tipo === "ATIVAR_ATUALIZACAO") self.skipWaiting();
});

self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;
  if (requisicao.method !== "GET") return;
  const url = new URL(requisicao.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (requisicao.mode === "navigate") {
    evento.respondWith(fetch(requisicao).catch(() => caches.match("/offline.html")));
    return;
  }

  const estatico = PRECACHE.includes(url.pathname) || url.pathname.startsWith("/_next/static/");
  if (!estatico) return;
  evento.respondWith(caches.match(requisicao).then(async (armazenado) => {
    if (armazenado) return armazenado;
    const resposta = await fetch(requisicao);
    if (resposta.ok) {
      const cache = await caches.open(VERSAO);
      await cache.put(requisicao, resposta.clone());
    }
    return resposta;
  }));
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // O app já usa a rede normalmente; este service worker existe
  // para habilitar instalabilidade PWA e futuras atualizações.
});

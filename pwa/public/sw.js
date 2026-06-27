const CACHE_NAME = "simplenotes-static-v1";
const API_CACHE_NAME = "simplenotes-api-v1";
const DB_NAME = "simplenotes";
const PENDING_STORE = "pending";

const STATIC_ASSETS = ["/", "/index.html", "/manifest.json"];

let API_URL = self.location.origin;

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SET_API_URL") {
    API_URL = event.data.url;
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/notes") ||
    url.pathname.startsWith("/sync") ||
    url.pathname.startsWith("/health")
  );
}

async function networkFirst(request) {
  const cache = await caches.open(API_CACHE_NAME);
  try {
    const response = await fetch(request);
    if (request.method === "GET" && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: "offline", detail: "No network and no cached data." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && request.method === "GET") {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (request.mode === "navigate") {
      const fallback = await caches.match("/index.html");
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (isApiRequest(url)) {
    if (request.method === "GET") {
      event.respondWith(networkFirst(request));
    }
    return;
  }

  event.respondWith(cacheFirst(request));
});

/* ---- Background sync ---- */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readPending(db) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(PENDING_STORE, "readonly").objectStore(PENDING_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function deletePending(db, id) {
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(PENDING_STORE, "readwrite")
      .objectStore(PENDING_STORE)
      .delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function syncNotes() {
  const db = await openDB();
  const pending = await readPending(db);
  if (pending.length === 0) return;

  const payload = pending.map(({ _pending, ...note }) => note);
  const response = await fetch(`${API_URL}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes: payload }),
  });

  if (response.ok) {
    await Promise.all(pending.map((p) => deletePending(db, p.id)));
    const clients = await self.clients.matchAll();
    clients.forEach((client) => client.postMessage({ type: "SYNC_COMPLETE" }));
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-notes") {
    event.waitUntil(syncNotes());
  }
});

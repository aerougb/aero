importScripts("/scram/scramjet.all.js");
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
const PREFIX = "/scram/service/";

// Some games link to "index.html" without the proxy encoding; rebuild that link from the page that asked for it.
function repairedUrl(request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(PREFIX)) return null;
  const rest = url.pathname.slice(PREFIX.length) + url.search;
  if (/^https?%3A/i.test(rest)) return null;
  try {
    const ref = new URL(request.referrer);
    if (!ref.pathname.startsWith(PREFIX)) return null;
    const page = decodeURIComponent(ref.pathname.slice(PREFIX.length));
    const target = new URL(rest, page);
    if (!/^https?:$/.test(target.protocol)) return null;
    return url.origin + PREFIX + encodeURIComponent(target.href);
  } catch { return null; }
}

// Game CDNs (e.g. jsDelivr /gh/) send .html files as plain text; show them as pages, not source code.
function asPage(request, response) {
  if (request.destination !== "iframe" && request.destination !== "document") return response;
  if (!(response.headers.get("content-type") || "").startsWith("text/plain")) return response;
  let target = "";
  try { target = new URL(decodeURIComponent(new URL(request.url).pathname.slice(PREFIX.length))).pathname; } catch { return response; }
  if (!/\.html?$/i.test(target)) return response;
  const headers = new Headers(response.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith((async () => {
    const repaired = repairedUrl(event.request);
    if (repaired) return Response.redirect(repaired, 302);
    await scramjet.loadConfig();
    if (scramjet.route(event)) {
      try { return asPage(event.request, await scramjet.fetch(event)); }
      catch { return new Response("", { status: 404 }); }
    }
    return fetch(event.request);
  })());
});

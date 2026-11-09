importScripts(new URL("scram2/controller/controller.sw.js", self.location.href).href);

// Firefox lacks request.body; buffer POST bodies so the controller forwards them intact.
const withBufferedBody = async (event) => {
  const { request } = event;
  if (request.method === "GET" || request.method === "HEAD") return event;
  const buffer = await request.arrayBuffer();
  const body = buffer.byteLength ? buffer : null;
  const shimmed = new Proxy(request, {
    get(target, prop) {
      if (prop === "body") return body;
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { request: shimmed, clientId: event.clientId, resultingClientId: event.resultingClientId };
};

// Scramjet rewrites stylesheets and scripts, so their original integrity hashes can never match;
// strip them from HTML tags and drop preload "Link" headers (which also carry hashes), or the
// browser blocks the files and Discord renders as a blank page.
const TAG = /<(?:link|script)\b[^>]*>/gi;
const INTEGRITY = /\s(?:scramjet-attr-)?integrity(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=[\s/>])/gi;
async function stripIntegrity(response) {
  const type = response.headers.get("content-type") || "";
  const html = type.includes("text/html") && response.body;
  if (!html && !response.headers.has("link")) return response;
  if (response.status === 101 || response.status === 204 || response.status === 304) return response;
  const headers = new Headers(response.headers);
  headers.delete("link");
  if (!html) return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  const text = await response.text();
  headers.delete("content-length");
  return new Response(text.replace(TAG, (tag) => tag.replace(INTEGRITY, "")), { status: response.status, statusText: response.statusText, headers });
}

// The relay's first HTTP/2 stream to a host sometimes resets (YouTube watch pages show
// "Internal Service Worker Error ... PROTOCOL_ERROR"); a fresh attempt succeeds, so safe
// requests are retried a couple of times before the error reaches the page.
const TRANSIENT = /Hyper client|http2 error|PROTOCOL_ERROR|connection closed|ConnectionReset|WebSocket/i;
async function routeWithRetry(routed) {
  const safe = routed.request.method === "GET" || routed.request.method === "HEAD";
  for (let attempt = 0; ; attempt++) {
    const last = !safe || attempt >= 2;
    try {
      const response = await $scramjetController.route(routed);
      if (last || response.status < 500) return response;
      const text = await response.clone().text();
      if (!TRANSIENT.test(text)) return response;
    } catch (error) {
      if (last || !TRANSIENT.test(String(error))) throw error;
    }
    await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
  }
}

self.addEventListener("fetch", (event) => {
  if ($scramjetController.shouldRoute(event)) {
    event.respondWith(withBufferedBody(event).then(routeWithRetry).then(stripIntegrity));
  }
});
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

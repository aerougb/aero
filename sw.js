// aero service worker — Scramjet v2 proxy.
//
// Every path is derived from this script's own location, so the same file
// works at the site root (https://aerogub.bolt.host/sw.js) and from a sub-path
// such as https://cdn.jsdelivr.net/gh/<user>/<repo>@main/sw.js.
//
// Rules:
//  1. This file never throws while it is being evaluated. A failure loading
//     the Scramjet runtime or a transport is remembered and reported per
//     request (HTTP 503 with the real error text).
//  2. Requests are converted into the ScramjetFetchRequest shape the runtime
//     reads (rawUrl, initialHeaders, ...). Passing the raw FetchEvent request
//     makes the runtime fail with "reading 'href'" / "reading 'clone'".
//  3. The runtime needs a transport OBJECT (ready / init / connect). A path
//     string such as "/baremux/worker.js" fails with "transport.init is not a
//     function". The worker builds Epoxy (or libcurl) itself.

var SW_VERSION = "20261022-v12";
var BASE = new URL("./", self.location.href);   // directory containing sw.js
var PREFIX = new URL("service/", BASE);          // proxy prefix, e.g. /service/
var BASE_PATH = BASE.pathname;                   // "/" at the root, "/gh/u/r@main/" on jsDelivr

(function shimScramjetDb() {
  try {
    var open = indexedDB.open.bind(indexedDB);
    var name = "$scramjet" + (BASE_PATH === "/" ? "" : BASE_PATH);
    var stores = ["config", "cookies", "redirectTrackers", "referrerPolicies", "publicSuffixList"];
    indexedDB.open = function (n, v) {
      if (n !== "$scramjet") return open(n, v);
      var r = open(name, v);
      r.addEventListener("upgradeneeded", function () {
        for (var i = 0; i < stores.length; i++) {
          if (!r.result.objectStoreNames.contains(stores[i])) r.result.createObjectStore(stores[i]);
        }
      });
      return r;
    };
  } catch (e) { /* no IndexedDB: nothing to shim */ }
})();

// Relay candidates (same servers mochii-svg uses, plus ours). The worker pings all of them
// in parallel and uses the fastest one that answers. A page can override this list with a
// "scramjet-config" message.
var WISP_CANDIDATES = [
  "wss://wisp.mercurywork.shop/",
  "wss://mochiiibackend.share.zrok.io/study/",
  "wss://zka.solidaritysafaris.com/api/",
  "wss://nyxlearning.org/wisp/"
];

var SJ = null;
var loadError = null;
var wispUrl = null;                 // set only when a page explicitly picks a relay
var wispServers = WISP_CANDIDATES.slice();
var wispChoice = null;              // promise for the auto-selected relay
var wispChoiceAt = 0;
var fetchHandler = null;
var initPromise = null;

function swLog() {
  try { console.log.apply(console, ["[aero-sw]"].concat([].slice.call(arguments))); } catch (e) { /* ignore */ }
}
function swError() {
  try { console.error.apply(console, ["[aero-sw]"].concat([].slice.call(arguments))); } catch (e) { /* ignore */ }
}
function errText(e) {
  return (e && e.message) ? e.message : String(e);
}

swLog("sw.js executing v" + SW_VERSION + ", base:", BASE.href);

// Lifecycle listeners are registered unconditionally, before anything else can fail.
self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

// Some engines do not expose WebSocket to workers. Stub it only if missing.
function stubWebSocketIfMissing() {
  if (typeof self.WebSocket !== "undefined") return;
  var Stub = function WebSocketStub() {
    this.readyState = 0;
    this.send = function () {};
    this.close = function () {};
  };
  Stub.CONNECTING = 0;
  Stub.OPEN = 1;
  Stub.CLOSING = 2;
  Stub.CLOSED = 3;
  Stub.prototype.addEventListener = function () {};
  Stub.prototype.removeEventListener = function () {};
  Stub.prototype.dispatchEvent = function () { return true; };
  self.WebSocket = Stub;
}

// Load the bundled Scramjet runtime (WASM embedded). Never throws.
function loadScramjet() {
  try {
    stubWebSocketIfMissing();
  } catch (e) {
    swError("WebSocket stub failed:", errText(e));
  }
  try {
    importScripts(new URL("scram/scramjet_bundled.js?v=" + SW_VERSION, BASE).href);
    SJ = self.$scramjet || null;
    if (!SJ) {
      throw new Error("scramjet_bundled.js ran but did not set $scramjet");
    }
    if (!SJ.ScramjetFetchHandler || !SJ.CookieJar || !SJ.defaultConfig || !SJ.ScramjetHeaders) {
      throw new Error("scramjet runtime is missing ScramjetFetchHandler / CookieJar / defaultConfig / ScramjetHeaders");
    }
    swLog("scramjet runtime loaded");
  } catch (e) {
    SJ = null;
    loadError = new Error("Scramjet failed to load in the service worker: " + errText(e));
    swError(loadError.message);
  }
}

loadScramjet();

// Open a WebSocket to a relay and report whether it answered, and how fast.
function pingWisp(url, timeout) {
  return new Promise(function (resolve) {
    var start = Date.now(), done = false, ws = null;
    function finish(ok) {
      if (done) return;
      done = true;
      try { if (ws) ws.close(); } catch (e) { /* ignore */ }
      resolve({ url: url, ok: ok, ms: Date.now() - start });
    }
    try { ws = new WebSocket(url); } catch (e) { return finish(false); }
    var timer = setTimeout(function () { finish(false); }, timeout || 4000);
    ws.onopen = function () { clearTimeout(timer); finish(true); };
    ws.onerror = function () { clearTimeout(timer); finish(false); };
    ws.onclose = function () { clearTimeout(timer); finish(false); };
  });
}

// Pick the fastest relay that answers. Cached for 10 minutes; reset when a request fails.
function chooseWisp() {
  if (wispUrl) return Promise.resolve(wispUrl);
  if (wispChoice && Date.now() - wispChoiceAt < 10 * 60 * 1000) return wispChoice;
  wispChoiceAt = Date.now();
  wispChoice = Promise.all(wispServers.map(function (u) { return pingWisp(u, 4000); }))
    .then(function (results) {
      var working = results.filter(function (r) { return r.ok; })
        .sort(function (a, b) { return a.ms - b.ms; });
      var pick = working.length ? working[0].url : wispServers[0];
      swLog("relays:", results.map(function (r) {
        return r.url + (r.ok ? " " + r.ms + "ms" : " unreachable");
      }).join(" | "), "-> using", pick);
      return pick;
    });
  return wispChoice;
}

// Forget the current transport and relay choice so the next request re-picks.
function resetRelay() {
  fetchHandler = null;
  initPromise = null;
  wispChoice = null;
}

// Build a transport object for the runtime. Epoxy first, libcurl as fallback.
function makeTransport() {
  var epoxyUrl = new URL("epoxy/index.mjs", BASE).href;
  var libcurlUrl = new URL("libcurl/index.mjs", BASE).href;
  return chooseWisp().then(function (relay) {
    return import(epoxyUrl).then(function (mod) {
      swLog("transport: epoxy ->", relay);
      return new mod.default({ wisp: relay });
    }, function (e) {
      swError("epoxy import failed, trying libcurl:", errText(e));
      return import(libcurlUrl).then(function (mod) {
        swLog("transport: libcurl ->", relay);
        return new mod.default({ websocket: relay });
      });
    });
  });
}

function initHandler() {
  if (fetchHandler) return Promise.resolve(fetchHandler);
  if (initPromise) return initPromise;
  if (loadError) return Promise.reject(loadError);

  initPromise = Promise.resolve()
    .then(function () {
      if (!SJ.setWasm) return;
      return fetch(new URL("scram/scramjet.wasm", BASE).href, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("scramjet.wasm fetch failed: HTTP " + r.status);
          return r.arrayBuffer();
        })
        .then(function (buf) {
          SJ.setWasm(new Uint8Array(buf));
        });
    })
    .then(function () {
      return makeTransport();
    })
    .then(function (transport) {
      var scriptPath = BASE_PATH + "scram/scramjet_bundled.js";
      var context = {
        config: SJ.defaultConfig,
        prefix: PREFIX,
        interface: {
          codecEncode: function (input) { return input; },
          codecDecode: function (input) { return input; },
          getInjectScripts: function (_meta, _handler, _htmlcontext, script) {
            return [script(scriptPath)];
          },
        },
        cookieJar: new SJ.CookieJar(),
      };
      fetchHandler = new SJ.ScramjetFetchHandler({
        transport: transport,
        context: context,
      });
      swLog("ScramjetFetchHandler ready, prefix:", PREFIX.pathname);
      return fetchHandler;
    })
    .catch(function (e) {
      initPromise = null; // allow a retry on the next request
      swError("init failed:", errText(e));
      throw e;
    });

  return initPromise;
}

// Convert a native FetchEvent into the shape the runtime reads.
function toScramjetRequest(event) {
  var req = event.request;
  var raw = new URL(req.url);
  var clientPromise = event.clientId
    ? self.clients.get(event.clientId).then(function (c) { return c ? c.url : null; }, function () { return null; })
    : Promise.resolve(null);

  return clientPromise.then(function (clientUrl) {
    return {
      rawUrl: raw,
      rawClientUrl: clientUrl ? new URL(clientUrl) : undefined,
      rawReferrer: req.referrer || undefined,
      rawDestination: req.destination || "",
      clientId: event.clientId || undefined,
      initialHeaders: new SJ.ScramjetHeaders(req.headers),
      headers: req.headers,
      method: req.method,
      body: req.body || undefined,
      duplex: "half",
      mode: req.mode,
      credentials: req.credentials,
      cache: req.cache,
      redirect: req.redirect,
      referrer: req.referrer,
      referrerPolicy: req.referrerPolicy,
      integrity: req.integrity,
      keepalive: req.keepalive,
      destination: req.destination,
      signal: req.signal,
    };
  });
}

function unavailable(message) {
  return new Response("Proxy unavailable: " + message, {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  if (url.pathname.indexOf(PREFIX.pathname) !== 0) return; // not ours: normal network

  event.respondWith(
    initHandler()
      .then(function (handler) {
        return toScramjetRequest(event).then(function (sreq) {
          return handler.handleFetch(sreq);
        });
      })
      .catch(function (e) {
        resetRelay();
        return unavailable(errText(e));
      })
  );
});

self.addEventListener("message", function (event) {
  if (!event.data) return;
  if (event.data.type === "scramjet-config") {
    var servers = Array.isArray(event.data.servers) ? event.data.servers.filter(function (u) {
      return typeof u === "string" && /^wss?:\/\//.test(u);
    }) : [];
    if (servers.length) wispServers = servers;
    // An explicit relay turns off auto-selection; no relay (null) turns it back on.
    wispUrl = (typeof event.data.wisp === "string" && /^wss?:\/\//.test(event.data.wisp)) ? event.data.wisp : null;
    resetRelay();
    return;
  }
  if (event.data.type !== "scramjet-init") return;
  initHandler().then(
    function () {
      if (event.source) event.source.postMessage({ type: "scramjet-state", ready: true });
    },
    function (e) {
      if (event.source) event.source.postMessage({ type: "scramjet-state", ready: false, error: errText(e) });
    }
  );
});

# aero — single-file build

`aero.svg` is the whole app in one SVG. The proxy runtime (Scramjet, BareMux,
Epoxy, libcurl) and the service worker (`sw.js`) must be real files next to it,
because a service worker cannot be loaded from inside an SVG.

Open it from jsDelivr after pushing this folder to a GitHub repo:

    https://cdn.jsdelivr.net/gh/<user>/<repo>@<commit>/aero.svg

Pinning a commit (instead of @main) avoids jsDelivr serving an old cached copy.

The worker pings several wisp relays and uses the fastest one that answers. If
none of them is reachable from your network, the proxy cannot start. Run your
own relay (server.mjs in the project) and set it from the page console:

    navigator.serviceWorker.controller.postMessage({type:'scramjet-config', wisp:'wss://your-relay/'})

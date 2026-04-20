/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";

declare let self: ServiceWorkerGlobalScope;

// Precache app shell (manifest injected by VitePWA)
precacheAndRoute(self.__WB_MANIFEST);

// OSM raster tiles — CacheFirst with silent offline fallback
const OSM_CACHE = "osm-tiles-cache";

registerRoute(
  ({ url }) => url.hostname === "tile.openstreetmap.org",
  async ({ request }) => {
    const cache = await caches.open(OSM_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      // Return transparent 1x1 PNG instead of failing noisily
      return new Response(
        Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRleErkJggg=="), c => c.charCodeAt(0)),
        { status: 200, headers: { "Content-Type": "image/png" } },
      );
    }
  },
);

// UNDP design system assets — CacheFirst
const UNDP_CACHE = "undp-assets-cache";

registerRoute(
  ({ url }) =>
    url.hostname === "cdn.jsdelivr.net" && url.pathname.includes("@undp/"),
  async ({ request }) => {
    const cache = await caches.open(UNDP_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return new Response("", { status: 503 });
    }
  },
);

// PMTiles range requests — custom handler
// Cache API rejects 206 responses, so we wrap them as 200 before caching
// Cache key includes the Range header to store each partial response separately
const PMTILES_CACHE = "pmtiles-cache";

registerRoute(
  ({ url }) => url.hostname === "data.source.coop",
  async ({ request }) => {
    const range = request.headers.get("Range") || "";
    const cacheKey = new Request(`${request.url}?_r=${encodeURIComponent(range)}`, {
      method: "GET",
    });

    const cache = await caches.open(PMTILES_CACHE);
    const cached = await cache.match(cacheKey);
    if (cached) {
      // Reconstruct the original 206 response from our cached 200
      const body = await cached.arrayBuffer();
      return new Response(body, {
        status: 206,
        statusText: "Partial Content",
        headers: {
          "Content-Type": cached.headers.get("Content-Type") || "application/octet-stream",
          "Content-Length": String(body.byteLength),
          "Content-Range": cached.headers.get("X-Original-Content-Range") || "",
        },
      });
    }

    try {
      const response = await fetch(request);

      if (response.ok || response.status === 206) {
        const body = await response.arrayBuffer();

        // Store as 200 so Cache API accepts it, preserve original headers
        const headers = new Headers({
          "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
          "Content-Length": String(body.byteLength),
          "X-Original-Content-Range": response.headers.get("Content-Range") || "",
          "X-Cached-At": new Date().toISOString(),
        });

        const cacheResponse = new Response(body, {
          status: 200,
          statusText: "OK",
          headers,
        });

        await cache.put(cacheKey, cacheResponse);

        // Return original 206 to the caller
        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }

      return response;
    } catch {
      return new Response("Offline — tile not cached", { status: 503 });
    }
  },
);

// API requests are cross-origin — don't intercept them in the SW.
// The connectivity hook and report queue handle offline gracefully.

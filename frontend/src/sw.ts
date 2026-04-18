/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare let self: ServiceWorkerGlobalScope;

// Precache app shell (manifest injected by VitePWA)
precacheAndRoute(self.__WB_MANIFEST);

// OSM raster tiles — CacheFirst
registerRoute(
  ({ url }) => url.hostname === "tile.openstreetmap.org",
  new CacheFirst({
    cacheName: "osm-tiles-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 30,
        maxEntries: 2000,
      }),
    ],
  }),
);

// UNDP design system assets
registerRoute(
  ({ url }) =>
    url.hostname === "cdn.jsdelivr.net" && url.pathname.includes("@undp/"),
  new CacheFirst({
    cacheName: "undp-assets-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 90,
        maxEntries: 100,
      }),
    ],
  }),
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

// API GET /reports — NetworkFirst with timeout
registerRoute(
  ({ url, request }) =>
    url.pathname.includes("/reports") && request.method === "GET",
  new NetworkFirst({
    cacheName: "api-reports-cache",
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 5,
        maxEntries: 50,
      }),
    ],
  }),
);

// API GET /health — NetworkFirst
registerRoute(
  ({ url, request }) =>
    url.pathname.endsWith("/health") && request.method === "GET",
  new NetworkFirst({
    cacheName: "api-health-cache",
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 60,
        maxEntries: 1,
      }),
    ],
  }),
);

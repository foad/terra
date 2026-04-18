import { useEffect, useRef } from "react";
import { PMTiles } from "pmtiles";
import { getTilesInRadius } from "../utils/tile-math";

const VIDA_BUILDINGS_URL =
  "https://data.source.coop/vida/google-microsoft-osm-open-buildings/pmtiles/goog_msft_osm.pmtiles";

const PREFETCH_RADIUS_METERS = 2000;
const PREFETCH_ZOOMS = [14, 15];
const THROTTLE_MS = 50;
const SIGNIFICANT_MOVE_METERS = 500;

/**
 * Background-prefetch PMTiles building footprints around the user's location.
 * Runs once on first GPS fix, then again only if the user moves significantly.
 */
export const usePrefetchTiles = (
  latitude: number | null,
  longitude: number | null,
) => {
  const lastPrefetchRef = useRef<{ lat: number; lng: number } | null>(null);
  const prefetchingRef = useRef(false);

  useEffect(() => {
    if (latitude === null || longitude === null) return;
    if (prefetchingRef.current) return;
    if (!navigator.onLine) return;

    // Check if we've moved significantly since last prefetch
    if (lastPrefetchRef.current) {
      const dLat = latitude - lastPrefetchRef.current.lat;
      const dLng = longitude - lastPrefetchRef.current.lng;
      const distMeters = Math.sqrt(
        (dLat * 110574) ** 2 +
          (dLng * 111320 * Math.cos((latitude * Math.PI) / 180)) ** 2,
      );
      if (distMeters < SIGNIFICANT_MOVE_METERS) return;
    }

    prefetchingRef.current = true;
    lastPrefetchRef.current = { lat: latitude, lng: longitude };

    const prefetch = async () => {
      const pmtiles = new PMTiles(VIDA_BUILDINGS_URL);

      const allTiles: { x: number; y: number; z: number }[] = [];
      for (const zoom of PREFETCH_ZOOMS) {
        allTiles.push(
          ...getTilesInRadius(longitude, latitude, PREFETCH_RADIUS_METERS, zoom),
        );
      }

      for (const tile of allTiles) {
        if (!navigator.onLine) break;

        try {
          await pmtiles.getZxy(tile.z, tile.x, tile.y);
        } catch {
          // Silently skip failed tiles
        }

        // Throttle to avoid competing with user requests
        await new Promise((r) => setTimeout(r, THROTTLE_MS));
      }

      prefetchingRef.current = false;
    };

    // Delay start so it doesn't compete with initial map load
    const timeout = setTimeout(prefetch, 3000);
    return () => clearTimeout(timeout);
  }, [latitude, longitude]);
};

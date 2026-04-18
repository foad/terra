/**
 * Convert lat/lng to tile coordinates at a given zoom level.
 */
export const lngLatToTile = (
  lng: number,
  lat: number,
  zoom: number,
): { x: number; y: number } => {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      n,
  );
  return { x, y };
};

/**
 * Get all tile coordinates within a radius (in meters) of a center point.
 */
export const getTilesInRadius = (
  lng: number,
  lat: number,
  radiusMeters: number,
  zoom: number,
): { x: number; y: number; z: number }[] => {
  const n = Math.pow(2, zoom);

  // Approximate degrees per meter at this latitude
  const degPerMeterLng = 1 / (111320 * Math.cos((lat * Math.PI) / 180));
  const degPerMeterLat = 1 / 110574;

  const dLng = radiusMeters * degPerMeterLng;
  const dLat = radiusMeters * degPerMeterLat;

  const min = lngLatToTile(lng - dLng, lat + dLat, zoom);
  const max = lngLatToTile(lng + dLng, lat - dLat, zoom);

  const tiles: { x: number; y: number; z: number }[] = [];
  for (let x = min.x; x <= max.x; x++) {
    for (let y = min.y; y <= max.y; y++) {
      if (x >= 0 && x < n && y >= 0 && y < n) {
        tiles.push({ x, y, z: zoom });
      }
    }
  }
  return tiles;
};

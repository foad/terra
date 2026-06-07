import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { api } from "../utils/api";
import styles from "./map.module.css";

const VIDA_BUILDINGS_URL =
  "https://data.source.coop/vida/google-microsoft-osm-open-buildings/pmtiles/goog_msft_osm.pmtiles";

const BUILDINGS_LAYER = "building-footprints";
const BUILDINGS_SOURCE_LAYER = "goog_msft_osm_building_footprints";

// Filled teardrop pin, tip at bottom-centre (marker anchored at "bottom").
// fill uses currentColor so .pinMarker can theme it with the UNDP palette.
const PIN_SVG = `
<svg width="26" height="34" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 0a12 12 0 0 0-12 12c0 7.5 9.7 18 11.1 19.5a1.2 1.2 0 0 0 1.8 0C14.3 30 24 19.5 24 12A12 12 0 0 0 12 0Z" fill="currentColor" stroke="#fff" stroke-width="1.5"/>
  <circle cx="12" cy="12" r="4" fill="#fff"/>
</svg>`;

export interface SelectedBuilding {
  buildingId: string;
  center: [number, number];
  areaM2: number;
  source: string;
  geometry: GeoJSON.Geometry;
}

interface MapProps {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  onBuildingSelect?: (building: SelectedBuilding | null) => void;
  onManualPin?: (coords: [number, number] | null) => void;
}

export const Map = ({
  latitude,
  longitude,
  accuracy,
  onBuildingSelect,
  onManualPin,
}: MapProps) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);
  const hasCenteredRef = useRef(false);
  const onBuildingSelectRef = useRef(onBuildingSelect);
  const onManualPinRef = useRef(onManualPin);
  const [coverageCount, setCoverageCount] = useState<{
    assessed: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    onBuildingSelectRef.current = onBuildingSelect;
  }, [onBuildingSelect]);

  useEffect(() => {
    onManualPinRef.current = onManualPin;
  }, [onManualPin]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
          },
          buildings: {
            type: "vector",
            url: `pmtiles://${VIDA_BUILDINGS_URL}`,
            promoteId: { [BUILDINGS_SOURCE_LAYER]: "geohash" },
            attribution:
              '© <a href="https://source.coop/vida/google-microsoft-osm-open-buildings">VIDA</a>',
          },
        },
        layers: [
          {
            id: "osm-basemap",
            type: "raster",
            source: "osm",
          },
          {
            id: BUILDINGS_LAYER,
            type: "fill",
            source: "buildings",
            "source-layer": BUILDINGS_SOURCE_LAYER,
            minzoom: 14,
            paint: {
              "fill-color": "#e5e7eb",
              "fill-opacity": 0.35,
              "fill-outline-color": "#9ca3af",
            },
          },
        ],
      },
      center: [0, 20],
      zoom: 2,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "top-left",
    );

    map.on("load", () => {
      // Damage-level fill driven by feature-state set from /reports bbox fetch.
      // minzoom 16: buildings are too small to read fills at lower zoom.
      // Outline is left at default for now — reserved for analyst priority flag (#46).
      map.addLayer(
        {
          id: "building-damage",
          type: "fill",
          source: "buildings",
          "source-layer": BUILDINGS_SOURCE_LAYER,
          minzoom: 16,
          paint: {
            "fill-color": [
              "case",
              ["==", ["feature-state", "damage_level"], "minimal"],
              "#16a34a",
              ["==", ["feature-state", "damage_level"], "partial"],
              "#d97706",
              ["==", ["feature-state", "damage_level"], "complete"],
              "#dc2626",
              "transparent",
            ],
            "fill-opacity": 0.65,
          },
        },
      );

      // Selection highlight layer (GeoJSON source, populated on click)
      map.addSource("selected-building", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "building-selected",
        type: "fill",
        source: "selected-building",
        paint: {
          "fill-color": "#f59e0b",
          "fill-opacity": 0.7,
          "fill-outline-color": "#d97706",
        },
      });
    });

    // Building click handler
    map.on("click", BUILDINGS_LAYER, (e) => {
      const feature = e.features?.[0];
      if (!feature || !feature.properties) return;

      const props = feature.properties;
      const geometry = feature.geometry;
      // Compute center from geometry
      let center: [number, number];
      if (geometry.type === "Polygon") {
        const coords = geometry.coordinates[0];
        const lng =
          coords.reduce((sum: number, c: number[]) => sum + c[0], 0) /
          coords.length;
        const lat =
          coords.reduce((sum: number, c: number[]) => sum + c[1], 0) /
          coords.length;
        center = [lng, lat];
      } else {
        center = [e.lngLat.lng, e.lngLat.lat];
      }

      // Selecting a building supersedes any manual pin
      clearPin();

      // Highlight selected building
      const source = map.getSource("selected-building") as
        | maplibregl.GeoJSONSource
        | undefined;
      source?.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry, properties: {} }],
      });

      onBuildingSelectRef.current?.({
        buildingId: props.geohash,
        center,
        areaM2: props.area_in_meters ?? 0,
        source: props.bf_source ?? "",
        geometry,
      });
    });

    // Drop a manual pin when clicking off any building — covers no-GPS and
    // buildings missing from the footprint layer. The pin is draggable for
    // fine-tuning.
    const clearPin = () => {
      pinMarkerRef.current?.remove();
      pinMarkerRef.current = null;
    };

    const placePin = (lng: number, lat: number) => {
      if (pinMarkerRef.current) {
        pinMarkerRef.current.setLngLat([lng, lat]);
      } else {
        const el = document.createElement("div");
        el.className = styles.pinMarker;
        el.innerHTML = PIN_SVG;
        const marker = new maplibregl.Marker({
          element: el,
          draggable: true,
          anchor: "bottom",
        })
          .setLngLat([lng, lat])
          .addTo(map);
        marker.on("dragend", () => {
          const pos = marker.getLngLat();
          onManualPinRef.current?.([pos.lng, pos.lat]);
        });
        pinMarkerRef.current = marker;
      }
      onManualPinRef.current?.([lng, lat]);
    };

    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [BUILDINGS_LAYER],
      });
      if (features.length > 0) return;

      // Clear any building selection, then place/move the pin.
      const source = map.getSource("selected-building") as
        | maplibregl.GeoJSONSource
        | undefined;
      source?.setData({ type: "FeatureCollection", features: [] });
      onBuildingSelectRef.current?.(null);
      placePin(e.lngLat.lng, e.lngLat.lat);
    });

    // Pointer cursor on buildings
    map.on("mouseenter", BUILDINGS_LAYER, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", BUILDINGS_LAYER, () => {
      map.getCanvas().style.cursor = "";
    });

    // Fetch reported buildings in the current viewport and apply feature-state
    // so the damage-level fill layer colours the correct polygons.
    const fetchNearbyReports = async () => {
      if (map.getZoom() < 14) return;
      const b = map.getBounds();
      try {
        const result = await api(
          `/reports?west=${b.getWest()}&south=${b.getSouth()}&east=${b.getEast()}&north=${b.getNorth()}&limit=500`,
        );
        const features: { properties: { building_id?: string; damage_level?: string } }[] =
          result?.features ?? [];
        const seen = new Set<string>();
        for (const f of features) {
          const bid = f.properties?.building_id;
          const dl = f.properties?.damage_level;
          if (!bid || !dl || seen.has(bid)) continue;
          seen.add(bid);
          map.setFeatureState(
            { source: "buildings", sourceLayer: BUILDINGS_SOURCE_LAYER, id: bid },
            { damage_level: dl },
          );
        }
        setCoverageCount((prev) => ({ total: prev?.total ?? 0, assessed: seen.size }));
      } catch {
        // Silent — coverage layer is best-effort
      }
    };

    map.on("moveend", fetchNearbyReports);

    // After tiles settle, count visible VIDA building features to derive unassessed total.
    map.on("idle", () => {
      if (map.getZoom() < 16) {
        setCoverageCount(null);
        return;
      }
      const rendered = map.queryRenderedFeatures(undefined, {
        layers: [BUILDINGS_LAYER],
      });
      const unique = new Set(
        rendered.map((f) => f.properties?.geohash as string | undefined).filter(Boolean),
      );
      setCoverageCount((prev) =>
        prev ? { ...prev, total: unique.size } : null,
      );
    });

    mapRef.current = map;

    return () => {
      map.remove();
      maplibregl.removeProtocol("pmtiles");
      mapRef.current = null;
      markerRef.current = null;
      pinMarkerRef.current = null;
      hasCenteredRef.current = false;
    };
  }, []);

  // Update user location marker and center map on first fix
  useEffect(() => {
    const map = mapRef.current;
    if (!map || latitude === null || longitude === null) return;

    if (!hasCenteredRef.current) {
      map.flyTo({ center: [longitude, latitude], zoom: 18, speed: 4 });
      hasCenteredRef.current = true;
    }

    if (markerRef.current) {
      markerRef.current.setLngLat([longitude, latitude]);
    } else {
      const el = document.createElement("div");
      el.className = styles.locationMarker;

      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([longitude, latitude])
        .addTo(map);
    }

    const accuracySource = map.getSource("accuracy") as
      | maplibregl.GeoJSONSource
      | undefined;
    const circle = createAccuracyCircle(longitude, latitude, accuracy ?? 0);

    if (accuracySource) {
      accuracySource.setData(circle);
    } else if (map.isStyleLoaded()) {
      map.addSource("accuracy", { type: "geojson", data: circle });
      map.addLayer(
        {
          id: "accuracy-circle",
          type: "fill",
          source: "accuracy",
          paint: {
            "fill-color": "#4a90d9",
            "fill-opacity": 0.15,
          },
        },
        BUILDINGS_LAYER,
      );
    }
  }, [latitude, longitude, accuracy]);

  const unassessed =
    coverageCount && coverageCount.total > 0
      ? Math.max(0, coverageCount.total - coverageCount.assessed)
      : null;

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.container} />
      {unassessed !== null && (
        <div className={styles.coverageBadge}>
          {t("coverage.unassessed", { count: unassessed })}
        </div>
      )}
    </div>
  );
};

const createAccuracyCircle = (
  lng: number,
  lat: number,
  radiusMeters: number,
): GeoJSON.Feature => {
  const points = 64;
  const coords: [number, number][] = [];
  const km = radiusMeters / 1000;
  const distanceX = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    coords.push([
      lng + distanceX * Math.cos(angle),
      lat + distanceY * Math.sin(angle),
    ]);
  }
  coords.push(coords[0]);

  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coords] },
    properties: {},
  };
};

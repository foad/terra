import { useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import styles from "./map.module.css";

const VIDA_BUILDINGS_URL =
  "https://data.source.coop/vida/google-microsoft-osm-open-buildings/pmtiles/goog_msft_osm.pmtiles";

const BUILDINGS_LAYER = "building-footprints";
const BUILDINGS_SOURCE_LAYER = "goog_msft_osm_building_footprints";

export interface SelectedBuilding {
  s2Id: string;
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
}

export const Map = ({
  latitude,
  longitude,
  accuracy,
  onBuildingSelect,
}: MapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const hasCenteredRef = useRef(false);
  const onBuildingSelectRef = useRef(onBuildingSelect);

  useEffect(() => {
    onBuildingSelectRef.current = onBuildingSelect;
  }, [onBuildingSelect]);

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
              "fill-color": "#4a90d9",
              "fill-opacity": 0.4,
              "fill-outline-color": "#2563eb",
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
      "bottom-right",
    );

    // Selection highlight layer (GeoJSON source, populated on click)
    map.on("load", () => {
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

      // Highlight selected building
      const source = map.getSource("selected-building") as
        | maplibregl.GeoJSONSource
        | undefined;
      source?.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry, properties: {} }],
      });

      onBuildingSelectRef.current?.({
        s2Id: props.s2_id,
        center,
        areaM2: props.area_in_meters ?? 0,
        source: props.bf_source ?? "",
        geometry,
      });
    });

    // Deselect when clicking elsewhere
    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [BUILDINGS_LAYER],
      });
      if (features.length === 0) {
        const source = map.getSource("selected-building") as
          | maplibregl.GeoJSONSource
          | undefined;
        source?.setData({ type: "FeatureCollection", features: [] });
        onBuildingSelectRef.current?.(null);
      }
    });

    // Pointer cursor on buildings
    map.on("mouseenter", BUILDINGS_LAYER, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", BUILDINGS_LAYER, () => {
      map.getCanvas().style.cursor = "";
    });

    mapRef.current = map;

    return () => {
      map.remove();
      maplibregl.removeProtocol("pmtiles");
      mapRef.current = null;
      markerRef.current = null;
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

  return <div ref={containerRef} className={styles.container} />;
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

import { useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import type { ReportFeature } from "../pages/dashboard";
import styles from "./dashboard-map.module.css";

const VIDA_BUILDINGS_URL =
  "https://data.source.coop/vida/google-microsoft-osm-open-buildings/pmtiles/goog_msft_osm.pmtiles";

const DAMAGE_COLORS: Record<string, string> = {
  minimal: "#16a34a",
  partial: "#d97706",
  complete: "#dc2626",
};

interface DashboardMapProps {
  reports: ReportFeature[];
  onReportSelect: (report: ReportFeature) => void;
}

export const DashboardMap = ({ reports, onReportSelect }: DashboardMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onReportSelectRef = useRef(onReportSelect);
  const reportsDataRef = useRef(reports);

  useEffect(() => {
    onReportSelectRef.current = onReportSelect;
  }, [onReportSelect]);

  useEffect(() => {
    reportsDataRef.current = reports;
  }, [reports]);

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
              '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
          },
          buildings: {
            type: "vector",
            url: `pmtiles://${VIDA_BUILDINGS_URL}`,
          },
        },
        layers: [
          {
            id: "osm-basemap",
            type: "raster",
            source: "osm",
          },
          {
            id: "building-footprints",
            type: "fill",
            source: "buildings",
            "source-layer": "goog_msft_osm_building_footprints",
            minzoom: 14,
            paint: {
              "fill-color": "#4a90d9",
              "fill-opacity": 0.3,
              "fill-outline-color": "#2563eb",
            },
          },
        ],
      },
      center: [36.16, 36.2],
      zoom: 3,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    map.on("load", () => {
      map.addSource("reports", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "report-markers",
        type: "circle",
        source: "reports",
        paint: {
          "circle-radius": 8,
          "circle-color": [
            "match",
            ["get", "damage_level"],
            "minimal", DAMAGE_COLORS.minimal,
            "partial", DAMAGE_COLORS.partial,
            "complete", DAMAGE_COLORS.complete,
            "#888",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "report-markers", (e) => {
        const feature = e.features?.[0];
        if (!feature?.properties?.id) return;
        const report = reportsDataRef.current.find(
          (r) => r.properties.id === feature.properties!.id,
        );
        if (report) onReportSelectRef.current?.(report);
      });

      map.on("mouseenter", "report-markers", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "report-markers", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    // Collapse attribution
    map.on("load", () => {
      const btn = containerRef.current?.querySelector<HTMLElement>(
        ".maplibregl-ctrl-attrib-button",
      );
      btn?.click();
    });

    mapRef.current = map;

    return () => {
      map.remove();
      maplibregl.removeProtocol("pmtiles");
      mapRef.current = null;
    };
  }, []);

  // Update report markers when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateData = () => {
      const source = map.getSource("reports") as maplibregl.GeoJSONSource | undefined;
      if (!source) return;

      source.setData({
        type: "FeatureCollection",
        features: reports,
      });

      if (reports.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        for (const r of reports) {
          bounds.extend(r.geometry.coordinates as [number, number]);
        }
        map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
      }
    };

    if (map.isStyleLoaded()) {
      updateData();
    } else {
      map.on("load", updateData);
      return () => { map.off("load", updateData); };
    }
  }, [reports]);

  return <div ref={containerRef} className={styles.container} />;
};

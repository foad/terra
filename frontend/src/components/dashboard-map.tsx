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
  const hasFittedRef = useRef(false);

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
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
        clusterProperties: {
          count_minimal: ["+", ["case", ["==", ["get", "damage_level"], "minimal"], 1, 0]],
          count_partial: ["+", ["case", ["==", ["get", "damage_level"], "partial"], 1, 0]],
          count_complete: ["+", ["case", ["==", ["get", "damage_level"], "complete"], 1, 0]],
        },
      });

      // Cluster circles — sized by point count, coloured by average damage severity
      // Severity score: (partial + 2*complete) / point_count → 0=all minimal, 2=all complete
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "reports",
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": [
            "step", ["get", "point_count"],
            18, 10,
            24, 50,
            32, 100,
            40,
          ],
          "circle-color": [
            "interpolate", ["linear"],
            ["/",
              ["+", ["get", "count_partial"], ["*", 2, ["get", "count_complete"]]],
              ["get", "point_count"],
            ],
            0, DAMAGE_COLORS.minimal,
            1, DAMAGE_COLORS.partial,
            2, DAMAGE_COLORS.complete,
          ],
          "circle-opacity": 0.8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Cluster count labels
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "reports",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 13,
          "text-font": ["Open Sans Bold"],
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // Individual report markers (unclustered)
      map.addLayer({
        id: "report-markers",
        type: "circle",
        source: "reports",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 7,
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

      // Click cluster to zoom in
      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id;
        const source = map.getSource("reports") as maplibregl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({
            center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
            zoom,
          });
        });
      });

      // Click individual marker to select
      map.on("click", "report-markers", (e) => {
        const feature = e.features?.[0];
        if (!feature?.properties?.id) return;
        const report = reportsDataRef.current.find(
          (r) => r.properties.id === feature.properties!.id,
        );
        if (report) onReportSelectRef.current?.(report);

        // Show popup
        const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
        const props = report?.properties;
        if (props) {
          new maplibregl.Popup({ offset: 12, closeButton: false })
            .setLngLat(coords)
            .setHTML(
              `<div class="${styles.popup}">` +
              `<strong>${props.damage_level}</strong>` +
              `<br>${props.infrastructure_type[0]?.split("(")[0]?.trim() ?? ""}` +
              (props.infrastructure_name ? `<br>${props.infrastructure_name}` : "") +
              `<br><small>${new Date(props.submitted_at).toLocaleDateString()}</small>` +
              `</div>`,
            )
            .addTo(map);
        }
      });

      // Pointer cursors
      map.on("mouseenter", "clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
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

      if (reports.length > 0 && !hasFittedRef.current) {
        const bounds = new maplibregl.LngLatBounds();
        for (const r of reports) {
          bounds.extend(r.geometry.coordinates as [number, number]);
        }
        map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
        hasFittedRef.current = true;
      }
    };

    if (map.isStyleLoaded()) {
      updateData();
    } else {
      map.on("load", updateData);
      return () => {
        map.off("load", updateData);
      };
    }
  }, [reports]);

  return <div ref={containerRef} className={styles.container} />;
};

import { useRef, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { TerraDraw, TerraDrawPolygonMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import type { ReportFeature } from "../pages/dashboard";
import { useApi } from "../hooks/use-api";
import { DAMAGE_COLORS } from "./damage-colors";
import { CoverageRing } from "./coverage-ring";
import styles from "./dashboard-map.module.css";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type MapMode = "clusters" | "heatmap" | "both";

interface CrisisEvent {
  id: string;
  name: string;
  crisis_type: string;
  region: GeoJSON.Polygon;
}

const VIDA_BUILDINGS_URL =
  "https://data.source.coop/vida/google-microsoft-osm-open-buildings/pmtiles/goog_msft_osm.pmtiles";

interface DashboardMapProps {
  reports: ReportFeature[];
  onReportSelect: (report: ReportFeature) => void;
  onPolygonFilter?: (polygon: GeoJSON.Polygon | null) => void;
}

export const DashboardMap = ({
  reports,
  onReportSelect,
  onPolygonFilter,
}: DashboardMapProps) => {
  const { t } = useTranslation();
  const api = useApi();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const onReportSelectRef = useRef(onReportSelect);
  const reportsByIdRef = useRef<Map<string, ReportFeature>>(new Map());
  const apiRef = useRef(api);
  const priorityBuildingsRef = useRef<Set<string>>(new Set());
  const hasFittedRef = useRef(false);
  const mapLoadedRef = useRef(false);
  const [mapMode, setMapMode] = useState<MapMode>("clusters");
  const onPolygonFilterRef = useRef(onPolygonFilter);
  const drawRef = useRef<TerraDraw | null>(null);
  const [drawMode, setDrawMode] = useState<"idle" | "drawing" | "active">(
    "idle",
  );
  const drawModeRef = useRef(drawMode);
  const [showBuildings, setShowBuildings] = useState(true);
  const [showCrisis, setShowCrisis] = useState(true);
  const [basemap, setBasemap] = useState<"street" | "satellite">("street");
  const [footprintCount, setFootprintCount] = useState<number | null>(null);

  const assessedCount = useMemo(() => {
    const seen = new Set<string>();
    for (const r of reports) {
      const bid = r.properties.building_id;
      if (bid) seen.add(bid);
    }
    return seen.size;
  }, [reports]);

  useEffect(() => {
    onReportSelectRef.current = onReportSelect;
  }, [onReportSelect]);

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  useEffect(() => {
    onPolygonFilterRef.current = onPolygonFilter;
  }, [onPolygonFilter]);

  useEffect(() => {
    reportsByIdRef.current = new Map(reports.map((r) => [r.properties.id, r]));
  }, [reports]);

  useEffect(() => {
    drawModeRef.current = drawMode;
    if (drawMode === "drawing" && tooltipRef.current) {
      tooltipRef.current.style.display = "none";
    }
  }, [drawMode]);

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
          "esri-satellite": {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            attribution:
              "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
          },
          buildings: {
            type: "vector",
            url: `pmtiles://${VIDA_BUILDINGS_URL}`,
            promoteId: { goog_msft_osm_building_footprints: "geohash" },
          },
        },
        layers: [
          {
            id: "osm-basemap",
            type: "raster",
            source: "osm",
          },
          {
            id: "esri-basemap",
            type: "raster",
            source: "esri-satellite",
            layout: { visibility: "none" },
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
      map.addSource("crisis-events", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "crisis-fill",
        type: "fill",
        source: "crisis-events",
        paint: {
          "fill-color": "#2563eb",
          "fill-opacity": 0.06,
        },
      });

      map.addLayer({
        id: "crisis-outline",
        type: "line",
        source: "crisis-events",
        paint: {
          "line-color": "#2563eb",
          "line-width": 2,
          "line-dasharray": [4, 3],
        },
      });

      map.addLayer({
        id: "crisis-label",
        type: "symbol",
        source: "crisis-events",
        layout: {
          "text-field": [
            "concat",
            ["get", "name"],
            " — ",
            ["get", "crisis_type"],
          ],
          "text-size": 12,
          "text-font": ["Open Sans Bold"],
          "symbol-placement": "point",
        },
        paint: {
          "text-color": "#1e3a8a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });

      // Purple dashed outline for buildings the analyst has flagged for more photos (#235).
      map.addLayer({
        id: "building-priority-outline",
        type: "line",
        source: "buildings",
        "source-layer": "goog_msft_osm_building_footprints",
        minzoom: 14,
        paint: {
          "line-color": "#7c3aed",
          "line-width": [
            "case",
            ["boolean", ["feature-state", "priority_flag"], false],
            3,
            0,
          ],
          "line-dasharray": [2, 1],
        },
      });

      // Non-clustered source for heatmap (heatmap layers need individual points)
      map.addSource("reports-heatmap", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addSource("polygon-filter", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "polygon-filter-fill",
        type: "fill",
        source: "polygon-filter",
        paint: { "fill-color": "#f59e0b", "fill-opacity": 0.12 },
      });

      map.addLayer({
        id: "report-heatmap",
        type: "heatmap",
        source: "reports-heatmap",
        maxzoom: 15,
        layout: { visibility: "none" },
        paint: {
          "heatmap-weight": [
            "match",
            ["get", "damage_level"],
            "minimal",
            0.33,
            "partial",
            0.66,
            "complete",
            1.0,
            0.33,
          ],
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            1,
            15,
            3,
          ],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(0,0,0,0)",
            0.2,
            "rgb(255,255,178)",
            0.4,
            "rgb(254,178,76)",
            0.6,
            "rgb(253,141,60)",
            0.8,
            "rgb(227,26,28)",
            1,
            "rgb(177,0,38)",
          ],
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            20,
            15,
            40,
          ],
          "heatmap-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            0.9,
            15,
            0,
          ],
        },
      });

      map.addSource("reports", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
        clusterProperties: {
          count_minimal: [
            "+",
            ["case", ["==", ["get", "damage_level"], "minimal"], 1, 0],
          ],
          count_partial: [
            "+",
            ["case", ["==", ["get", "damage_level"], "partial"], 1, 0],
          ],
          count_complete: [
            "+",
            ["case", ["==", ["get", "damage_level"], "complete"], 1, 0],
          ],
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
            "step",
            ["get", "point_count"],
            18,
            10,
            24,
            50,
            32,
            100,
            40,
          ],
          "circle-color": [
            "interpolate",
            ["linear"],
            [
              "/",
              [
                "+",
                ["get", "count_partial"],
                ["*", 2, ["get", "count_complete"]],
              ],
              ["get", "point_count"],
            ],
            0,
            DAMAGE_COLORS.minimal,
            1,
            DAMAGE_COLORS.partial,
            2,
            DAMAGE_COLORS.complete,
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
            "minimal",
            DAMAGE_COLORS.minimal,
            "partial",
            DAMAGE_COLORS.partial,
            "complete",
            DAMAGE_COLORS.complete,
            "#888",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "polygon-filter-outline",
        type: "line",
        source: "polygon-filter",
        paint: {
          "line-color": "#f59e0b",
          "line-width": 2,
          "line-dasharray": [4, 3],
        },
      });

      // Click cluster to zoom in
      map.on("click", "clusters", (e) => {
        if (drawModeRef.current === "drawing") return;
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["clusters"],
        });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id;
        const source = map.getSource("reports") as maplibregl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({
            center: (features[0].geometry as GeoJSON.Point).coordinates as [
              number,
              number,
            ],
            zoom,
          });
        });
      });

      // Click individual marker to select
      map.on("click", "report-markers", (e) => {
        if (drawModeRef.current === "drawing") return;
        const feature = e.features?.[0];
        if (!feature?.properties?.id) return;
        const report = reportsByIdRef.current.get(feature.properties.id);
        if (report) onReportSelectRef.current?.(report);

        // Show popup
        const coords = (feature.geometry as GeoJSON.Point).coordinates as [
          number,
          number,
        ];
        const props = report?.properties;
        if (props) {
          const infra =
            props.infrastructure_type[0]?.split("(")[0]?.trim() ?? "";
          new maplibregl.Popup({ offset: 12, closeButton: false })
            .setLngLat(coords)
            .setHTML(
              `<div class="${styles.popup}">` +
                `<strong>${escapeHtml(props.damage_level)}</strong>` +
                `<br>${escapeHtml(infra)}` +
                `<br><small>${new Date(props.submitted_at).toLocaleDateString()}</small>` +
                `</div>`,
            )
            .addTo(map);
        }
      });

      // Click unassessed building footprint to show a confirmation popup.
      // Skips when draw mode is active or when a report marker sits at the same point.
      map.on("click", "building-footprints", (e) => {
        if (drawModeRef.current !== "idle") return;
        const reportFeatures = map.queryRenderedFeatures(e.point, {
          layers: ["report-markers"],
        });
        if (reportFeatures.length > 0) return;
        const feature = e.features?.[0];
        const bid = feature?.properties?.geohash as string | undefined;
        if (!bid) return;

        const currentlyFlagged = priorityBuildingsRef.current.has(bid);
        const heading = currentlyFlagged
          ? "Priority flagged"
          : "Tag building as priority?";
        const btnLabel = currentlyFlagged ? "Remove flag" : "Flag for photos";
        const btnColor = currentlyFlagged ? "#6b7280" : "#0469a5";

        const popup = new maplibregl.Popup({
          offset: 10,
          closeButton: true,
          maxWidth: "200px",
        })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="${styles.popup}" style="padding:4px 2px">` +
              `<div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em;margin-bottom:8px">${escapeHtml(heading)}</div>` +
              `<button type="button" style="width:100%;padding:5px 10px;font-size:0.75rem;font-weight:600;background:${btnColor};color:#fff;border:none;cursor:pointer">${escapeHtml(btnLabel)}</button>` +
              `</div>`,
          )
          .addTo(map);

        popup
          .getElement()
          .querySelector("button")
          ?.addEventListener("click", () => {
            popup.remove();
            const newFlagged = !currentlyFlagged;
            if (newFlagged) priorityBuildingsRef.current.add(bid);
            else priorityBuildingsRef.current.delete(bid);
            map.setFeatureState(
              {
                source: "buildings",
                sourceLayer: "goog_msft_osm_building_footprints",
                id: bid,
              },
              { priority_flag: newFlagged },
            );
            apiRef
              .current(`/buildings/${bid}/priority`, {
                method: "PATCH",
                body: JSON.stringify({ flagged: newFlagged }),
              })
              .catch(() => {
                if (newFlagged) priorityBuildingsRef.current.delete(bid);
                else priorityBuildingsRef.current.add(bid);
                map.setFeatureState(
                  {
                    source: "buildings",
                    sourceLayer: "goog_msft_osm_building_footprints",
                    id: bid,
                  },
                  { priority_flag: !newFlagged },
                );
              });
          });
      });

      map.on("mouseenter", "building-footprints", () => {
        if (drawModeRef.current !== "idle") return;
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "building-footprints", () => {
        map.getCanvas().style.cursor = "";
      });

      // Pointer cursors + hover tooltips
      map.on("mouseenter", "clusters", (e) => {
        if (drawModeRef.current === "drawing") return;
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        const tip = tooltipRef.current;
        if (!feature || !tip) return;
        const p = feature.properties as Record<string, number>;
        const total = p.point_count ?? 0;
        tip.innerHTML =
          `<strong>${total} report${total !== 1 ? "s" : ""}</strong><br>` +
          `${p.count_complete ?? 0} complete · ${p.count_partial ?? 0} partial · ${p.count_minimal ?? 0} minimal`;
        tip.style.display = "block";
        tip.style.left = `${e.point.x + 14}px`;
        tip.style.top = `${e.point.y - 10}px`;
      });
      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
        if (tooltipRef.current) tooltipRef.current.style.display = "none";
      });
      map.on("mouseenter", "report-markers", (e) => {
        if (drawModeRef.current === "drawing") return;
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        const tip = tooltipRef.current;
        if (!feature?.properties?.id || !tip) return;
        const report = reportsByIdRef.current.get(feature.properties.id);
        if (!report) return;
        const props = report.properties;
        const infra = props.infrastructure_type?.[0]?.split("(")?.[0]?.trim();
        tip.innerHTML =
          `<strong>${escapeHtml(props.damage_level)}</strong>` +
          (infra ? `<br>${escapeHtml(infra)}` : "") +
          `<br><small>${new Date(props.submitted_at).toLocaleDateString()}</small>`;
        tip.style.display = "block";
        tip.style.left = `${e.point.x + 14}px`;
        tip.style.top = `${e.point.y - 10}px`;
      });
      map.on("mouseleave", "report-markers", () => {
        map.getCanvas().style.cursor = "";
        if (tooltipRef.current) tooltipRef.current.style.display = "none";
      });

      mapLoadedRef.current = true;
    });

    // Collapse attribution
    map.on("load", () => {
      const btn = containerRef.current?.querySelector<HTMLElement>(
        ".maplibregl-ctrl-attrib-button",
      );
      btn?.click();
    });

    // Count visible building footprints on settle to derive the coverage denominator.
    let footprintTimer: ReturnType<typeof setTimeout> | null = null;
    map.on("idle", () => {
      if (map.getZoom() < 14) {
        setFootprintCount(null);
        return;
      }
      if (footprintTimer) clearTimeout(footprintTimer);
      footprintTimer = setTimeout(() => {
        const rendered = map.queryRenderedFeatures(undefined, {
          layers: ["building-footprints"],
        });
        const unique = new Set(
          rendered
            .map((f) => f.properties?.geohash as string | undefined)
            .filter(Boolean),
        );
        setFootprintCount(unique.size > 0 ? unique.size : null);
      }, 200);
    });

    mapRef.current = map;
    if ((globalThis as { __E2E_PREFIX__?: string }).__E2E_PREFIX__) {
      (globalThis as { __MAP__?: maplibregl.Map }).__MAP__ = map;
    }

    return () => {
      if (footprintTimer) clearTimeout(footprintTimer);
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
      const source = map.getSource("reports") as
        | maplibregl.GeoJSONSource
        | undefined;
      if (!source) return;

      const fc = { type: "FeatureCollection" as const, features: reports };
      source.setData(fc);
      (
        map.getSource("reports-heatmap") as maplibregl.GeoJSONSource | undefined
      )?.setData(fc);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    (async () => {
      let events: CrisisEvent[] = [];
      try {
        const result = await api("/crisis-events");
        events = result.events ?? [];
      } catch {
        return;
      }
      if (cancelled) return;

      const apply = () => {
        const source = map.getSource("crisis-events") as
          | maplibregl.GeoJSONSource
          | undefined;
        if (!source) return;
        source.setData({
          type: "FeatureCollection",
          features: events.map((e) => ({
            type: "Feature",
            geometry: e.region,
            properties: {
              id: e.id,
              name: e.name,
              crisis_type: e.crisis_type,
            },
          })),
        });
      };
      if (map.isStyleLoaded()) apply();
      else map.on("load", apply);
    })();

    return () => {
      cancelled = true;
    };
  }, [api]);

  // Fetch priority buildings and apply feature-state so the amber outline appears.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    const applyPriority = (buildingIds: string[]) => {
      priorityBuildingsRef.current = new Set(buildingIds);
      for (const bid of buildingIds) {
        map.setFeatureState(
          {
            source: "buildings",
            sourceLayer: "goog_msft_osm_building_footprints",
            id: bid,
          },
          { priority_flag: true },
        );
      }
    };

    const fetchAndApply = async () => {
      try {
        const result = await api("/buildings/priority");
        if (cancelled) return;
        applyPriority(result.building_ids ?? []);
      } catch {
        // best-effort
      }
    };

    if (map.isStyleLoaded()) fetchAndApply();
    else map.once("load", fetchAndApply);

    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const showClusters = mapMode !== "heatmap";
    const showHeatmap = mapMode !== "clusters";
    for (const id of ["clusters", "cluster-count", "report-markers"]) {
      map.setLayoutProperty(
        id,
        "visibility",
        showClusters ? "visible" : "none",
      );
    }
    map.setLayoutProperty(
      "report-heatmap",
      "visibility",
      showHeatmap ? "visible" : "none",
    );
  }, [mapMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    map.setLayoutProperty(
      "building-footprints",
      "visibility",
      showBuildings ? "visible" : "none",
    );
  }, [showBuildings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    for (const id of ["crisis-fill", "crisis-outline", "crisis-label"]) {
      map.setLayoutProperty(id, "visibility", showCrisis ? "visible" : "none");
    }
  }, [showCrisis]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    map.setLayoutProperty(
      "osm-basemap",
      "visibility",
      basemap === "street" ? "visible" : "none",
    );
    map.setLayoutProperty(
      "esri-basemap",
      "visibility",
      basemap === "satellite" ? "visible" : "none",
    );
  }, [basemap]);

  const handleStartDraw = () => {
    const map = mapRef.current;
    if (!map || drawRef.current) return;
    if (!map.isStyleLoaded()) {
      // The style reports not-loaded whenever basemap tiles are still
      // streaming in (seconds at a time on slow connections) — engage once
      // the map settles instead of silently dropping the click.
      map.once("idle", handleStartDraw);
      return;
    }

    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [new TerraDrawPolygonMode()],
    });
    drawRef.current = draw;
    draw.start();
    draw.setMode("polygon");
    setDrawMode("drawing");

    const applyPolygon = (polygon: GeoJSON.Polygon) => {
      draw.stop();
      drawRef.current = null;

      const source = map.getSource("polygon-filter") as
        | maplibregl.GeoJSONSource
        | undefined;
      source?.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: polygon, properties: {} }],
      });

      onPolygonFilterRef.current?.(polygon);
      setDrawMode("active");
    };

    draw.on("finish", () => {
      const features = draw.getSnapshot();
      const poly = features.find((f) => f.geometry.type === "Polygon");
      if (poly) applyPolygon(poly.geometry as GeoJSON.Polygon);
    });

    if ((globalThis as { __E2E_PREFIX__?: string }).__E2E_PREFIX__) {
      (
        globalThis as { __APPLY_POLYGON__?: (p: GeoJSON.Polygon) => void }
      ).__APPLY_POLYGON__ = applyPolygon;
    }
  };

  const handleClearPolygon = () => {
    drawRef.current?.stop();
    drawRef.current = null;

    const map = mapRef.current;
    const source = map?.getSource("polygon-filter") as
      | maplibregl.GeoJSONSource
      | undefined;
    source?.setData({ type: "FeatureCollection", features: [] });

    onPolygonFilterRef.current?.(null);
    setDrawMode("idle");
  };

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.container} />

      <div className={styles.toggle}>
        {(["clusters", "heatmap", "both"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`${styles.toggleBtn} ${mapMode === mode ? styles.toggleBtnActive : ""}`}
            onClick={() => setMapMode(mode)}
          >
            {t(
              `dashboard.mapMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
            )}
          </button>
        ))}
      </div>

      <div className={styles.legend}>
        {(mapMode === "clusters" || mapMode === "both") && (
          <div className={styles.legendSection}>
            <div className={styles.legendTitle}>
              {t("dashboard.legendDamage")}
            </div>
            {(
              [
                { color: DAMAGE_COLORS.complete, key: "levelComplete" },
                { color: DAMAGE_COLORS.partial, key: "levelPartial" },
                { color: DAMAGE_COLORS.minimal, key: "levelMinimal" },
              ] as const
            ).map(({ color, key }) => (
              <div key={key} className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ background: color }}
                />
                <span>{t(`dashboard.${key}`)}</span>
              </div>
            ))}
          </div>
        )}
        {(mapMode === "heatmap" || mapMode === "both") && (
          <div className={styles.legendSection}>
            <div className={styles.legendTitle}>
              {t("dashboard.legendSeverity")}
            </div>
            <div className={styles.heatGradient} />
            <div className={styles.heatLabels}>
              <span>{t("dashboard.legendLow")}</span>
              <span>{t("dashboard.legendHigh")}</span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.layersPanel}>
        <div className={styles.layersPanelTitle}>
          {t("dashboard.layersPanel")}
        </div>
        <label className={styles.layerItem}>
          <input
            type="checkbox"
            checked={showBuildings}
            onChange={(e) => setShowBuildings(e.target.checked)}
          />
          {t("dashboard.layerBuildings")}
        </label>
        <label className={styles.layerItem}>
          <input
            type="checkbox"
            checked={showCrisis}
            onChange={(e) => setShowCrisis(e.target.checked)}
          />
          {t("dashboard.layerCrisis")}
        </label>
      </div>

      <div
        ref={tooltipRef}
        className={styles.tooltip}
        style={{ display: "none" }}
      />

      {footprintCount !== null && footprintCount > 0 && drawMode === "idle" && (
        <div className={styles.coverageCard}>
          <CoverageRing
            assessed={assessedCount}
            total={footprintCount}
            label={
              assessedCount >= footprintCount
                ? t("coverage.allAssessed")
                : t("coverage.ring", {
                    assessed: assessedCount,
                    total: footprintCount,
                  })
            }
          />
        </div>
      )}

      <div className={styles.basemapToggle}>
        {(["street", "satellite"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`${styles.basemapBtn} ${basemap === mode ? styles.basemapBtnActive : ""}`}
            onClick={() => setBasemap(mode)}
          >
            {t(
              mode === "street"
                ? "dashboard.basemapStreet"
                : "dashboard.basemapSatellite",
            )}
          </button>
        ))}
      </div>

      {onPolygonFilter && (
        <div className={styles.drawControls}>
          {drawMode === "idle" && (
            <button
              type="button"
              className={styles.drawButton}
              onClick={handleStartDraw}
            >
              Draw area
            </button>
          )}
          {drawMode === "drawing" && (
            <button
              type="button"
              className={`${styles.drawButton} ${styles.drawButtonDrawing}`}
              onClick={handleClearPolygon}
            >
              Cancel
            </button>
          )}
          {drawMode === "active" && (
            <button
              type="button"
              className={`${styles.drawButton} ${styles.drawButtonActive}`}
              onClick={handleClearPolygon}
            >
              Clear area
            </button>
          )}
        </div>
      )}
    </div>
  );
};

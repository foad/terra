import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import styles from "./crisis-region-editor.module.css";

interface CrisisRegionEditorProps {
  initial: GeoJSON.Polygon | null;
  onChange: (polygon: GeoJSON.Polygon | null) => void;
}

export const CrisisRegionEditor = ({
  initial,
  onChange,
}: CrisisRegionEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

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
        },
        layers: [{ id: "osm-basemap", type: "raster", source: "osm" }],
      },
      center: initial ? polygonCentroid(initial) : [0, 20],
      zoom: initial ? 7 : 2,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    let draw: TerraDraw | null = null;
    let cancelled = false;

    map.on("load", () => {
      if (cancelled) return;

      draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          new TerraDrawPolygonMode(),
          new TerraDrawSelectMode({
            flags: {
              polygon: {
                feature: {
                  draggable: true,
                  coordinates: {
                    midpoints: true,
                    draggable: true,
                    deletable: true,
                  },
                },
              },
            },
          }),
        ],
      });
      draw.start();

      if (initial) {
        const id = crypto.randomUUID();
        draw.addFeatures([
          {
            id,
            type: "Feature",
            geometry: initial,
            properties: { mode: "polygon" },
          },
        ]);
        draw.setMode("select");
        draw.selectFeature(id);
        map.fitBounds(polygonBounds(initial), { padding: 40, maxZoom: 10 });
      } else {
        draw.setMode("polygon");
      }

      const emit = () => {
        if (!draw) return;
        const features = draw.getSnapshot();
        const poly = features.find((f) => f.geometry.type === "Polygon");
        onChangeRef.current(poly ? (poly.geometry as GeoJSON.Polygon) : null);
      };
      draw.on("finish", emit);
      draw.on("change", emit);
    });

    return () => {
      cancelled = true;
      draw?.stop();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={styles.map} />;
};

const polygonCentroid = (poly: GeoJSON.Polygon): [number, number] => {
  const coords = poly.coordinates[0];
  if (!coords?.length) return [0, 0];
  const [lngSum, latSum] = coords.reduce(
    ([lngAcc, latAcc], [lng, lat]) => [lngAcc + lng, latAcc + lat],
    [0, 0],
  );
  return [lngSum / coords.length, latSum / coords.length];
};

const polygonBounds = (poly: GeoJSON.Polygon): maplibregl.LngLatBoundsLike => {
  const coords = poly.coordinates[0];
  const bounds = new maplibregl.LngLatBounds();
  for (const [lng, lat] of coords) bounds.extend([lng, lat]);
  return bounds;
};

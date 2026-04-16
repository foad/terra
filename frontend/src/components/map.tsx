import { useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'
import styles from './map.module.css'

const VIDA_BUILDINGS_URL =
  'https://data.source.coop/vida/google-microsoft-osm-open-buildings/pmtiles/goog_msft_osm.pmtiles'

export const Map = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution:
              '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
          },
          buildings: {
            type: 'vector',
            url: `pmtiles://${VIDA_BUILDINGS_URL}`,
            attribution:
              '© <a href="https://source.coop/vida/google-microsoft-osm-open-buildings">VIDA</a>',
          },
        },
        layers: [
          {
            id: 'osm-basemap',
            type: 'raster',
            source: 'osm',
          },
          {
            id: 'building-footprints',
            type: 'fill',
            source: 'buildings',
            'source-layer': 'goog_msft_osm_building_footprints',
            paint: {
              'fill-color': '#4a90d9',
              'fill-opacity': 0.4,
              'fill-outline-color': '#2563eb',
            },
          },
        ],
      },
      center: [0, 20],
      zoom: 2,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right',
    )

    mapRef.current = map

    return () => {
      map.remove()
      maplibregl.removeProtocol('pmtiles')
      mapRef.current = null
    }
  }, [])

  return <div ref={containerRef} className={styles.container} />
}

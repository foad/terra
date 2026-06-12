# Architecture

One-page system view (#70). Renders on GitHub; for the proposal attachment export via mermaid.live or `mmdc -i architecture.md -o architecture.png`.

```mermaid
flowchart LR
    subgraph Reporter["📱 Community reporter (PWA, 6 UN languages)"]
        UI[React PWA<br/>building-footprint selection<br/>photo + survey]
        SW[Service worker<br/>PMTiles tile cache<br/>HTTP 206 handler]
        IDB[(IndexedDB<br/>offline report queue)]
        UI --> IDB
        SW -.offline tiles.- UI
    end

    subgraph Edge["CloudFront CDN"]
        CF[Static PWA assets<br/>+ photo thumbnails]
    end

    subgraph AWS["AWS (Terraform-managed, serverless)"]
        APIGW[API Gateway]
        LAMBDA[Python Lambda<br/>reports / crises / exports API]
        CLS[Classification Lambda<br/>AWS Bedrock - Claude vision<br/>damage level + type + confidence]
        PHOTO[Photo pipeline Lambda<br/>EXIF extract → thumbnail → STRIP]
        S3[(S3<br/>EXIF-stripped photos only)]
    end

    subgraph Data["Supabase"]
        PG[(PostGIS<br/>reports · crisis_events<br/>H3 R12+R8 indexing<br/>version-chain trigger)]
    end

    subgraph Analyst["🖥️ Analyst"]
        DASH[Dashboard<br/>live map · heatmap · time slider<br/>polygon filter · 30s auto-refresh]
        ADMIN[Admin console<br/>crisis polygon · follow-up questions<br/>Community Activation Kit QR]
        EXPORT[GeoJSON / CSV export<br/>HBDA-aligned fields → QGIS/ArcGIS]
    end

    VIDA[VIDA building footprints<br/>PMTiles, ~2.6B buildings] -.vector tiles.-> UI
    OSM[OSM / Esri basemaps] -.raster tiles.-> UI

    IDB -- "sync on reconnect<br/>(exponential backoff)" --> APIGW
    APIGW --> LAMBDA
    LAMBDA --> PG
    LAMBDA --> CLS
    LAMBDA --> PHOTO
    PHOTO --> S3
    CF --> UI
    S3 --> CF
    PG --> DASH
    DASH --> EXPORT
    ADMIN --> LAMBDA
```

## The four properties the diagram encodes

1. **Offline-first:** the reporter's path never requires connectivity at capture — reports queue in IndexedDB, tiles come from the service-worker cache, and sync fires on reconnect with exponential backoff. Client-generated UUIDs make retries idempotent.
2. **Privacy at the boundary:** photos pass through the EXIF-strip pipeline before storage; nothing identifying ever reaches S3 or PostGIS (no accounts anywhere in the system).
3. **Serverless scale:** every compute component is a Lambda — horizontal burst scaling during a crisis's first 48 hours, near-zero idle cost the rest of the year. The data layer absorbs national scale via two-resolution H3 indexing (see [database-schema.md](database-schema.md)).
4. **Modularity:** the PWA, dashboard, classification service, and deployment kit are separable — each could be adopted independently or integrated piecewise into UNDP's existing RAPIDA/Geo-HUB tooling.

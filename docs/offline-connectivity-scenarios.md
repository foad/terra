# Offline & Connectivity Scenarios

## Architecture Overview

```mermaid
flowchart TB
    subgraph Client["PWA (Client)"]
        UI[Report Flow UI]
        IDB[(IndexedDB)]
        SW[Service Worker]
        Cache[(Cache API)]
    end

    subgraph Network
        API[Lambda API]
        S3[S3 Photos]
    end

    UI -->|"1. Save report + photo blob"| IDB
    UI -->|"2. Show 'Queued' confirmation"| UI
    IDB -->|"3. Background sync"| API
    IDB -->|"3a. Get presigned URL"| API
    IDB -->|"3b. Upload photo"| S3
    SW -->|"Cache tiles, app shell"| Cache
    Cache -->|"Serve cached assets"| UI
```

## Submission Flow (Offline-First)

All submissions go through IndexedDB first, regardless of connectivity.

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Report Flow
    participant IDB as IndexedDB
    participant Sync as Sync Engine
    participant API as Lambda API
    participant S3 as S3

    U->>UI: Complete report (location, photo, damage, survey)
    UI->>IDB: Store report + photo blob + offline_queue_id
    UI->>U: Show "Queued" confirmation

    Note over Sync: Triggered by: online event, periodic poll, manual

    Sync->>Sync: Check navigator.onLine
    Sync->>API: HEAD /health (verify connectivity)
    alt Verified online
        loop For each pending report
            Sync->>IDB: Get next pending report
            Sync->>IDB: Update status: syncing
            Sync->>API: POST /photos/upload
            API-->>Sync: { photo_key, upload_url }
            Sync->>IDB: Get photo blob
            Sync->>S3: PUT photo via presigned URL
            Sync->>API: POST /reports (with photo_key + offline_queue_id)
            alt Success (201)
                API-->>Sync: { status: "created" }
                Sync->>IDB: Update status: synced
            else Duplicate (offline_queue_id match)
                API-->>Sync: { status: "duplicate" }
                Sync->>IDB: Update status: synced
            else Transient failure (5xx / network error)
                Sync->>IDB: Update status: pending, increment retry count
                Note over Sync: Exponential backoff, retry later
            else Permanent failure (4xx)
                Sync->>IDB: Update status: failed, store error
                Note over Sync: User intervention needed
            end
        end
    else Not verified online
        Note over Sync: Skip, wait for next trigger
    end
```

## Connectivity Scenarios

### Scenario 1: Completely offline from start

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Report Flow
    participant IDB as IndexedDB
    participant Map as MapLibre

    Note over U,Map: App loads from service worker cache

    U->>Map: View map
    Map->>Map: Show cached tiles (previously viewed areas)
    Map->>Map: Blank tiles for unvisited areas

    U->>UI: Select building / describe location
    U->>UI: Capture photo (stored as blob, no upload)
    U->>UI: Select damage level (no AI suggestions)
    U->>UI: Fill survey
    U->>UI: Submit
    UI->>IDB: Store complete report + photo blob
    UI->>U: "Report queued — will sync when online"

    Note over IDB: Report waits in queue
    Note over Map: On reconnect: online event → verify → sync queue + reload map sources
```

### Scenario 2: Connection lost after photo upload, before AI classify

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Report Flow
    participant API as Lambda API
    participant S3 as S3

    U->>UI: Capture photo
    UI->>API: POST /photos/upload
    API-->>UI: { photo_key, upload_url }
    UI->>S3: PUT photo ✓
    UI->>API: POST /photos/{key}/classify
    API--xUI: Connection lost

    Note over UI: AI classify failed — skip suggestions
    UI->>U: Proceed to damage step (all fields manual)
    Note over UI: photo_key is known, photo is on S3
    Note over UI: Report submitted normally with photo_key, no ai_damage_level
```

### Scenario 3: Connection lost after classify, before submit

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Report Flow
    participant IDB as IndexedDB
    participant API as Lambda API

    Note over UI: Photo uploaded, AI suggestions received
    U->>UI: Select damage, fill survey, submit

    UI->>API: POST /reports
    API--xUI: Connection lost

    UI->>IDB: Store report (with photo_key already on S3)
    UI->>U: "Report queued — will sync when online"

    Note over IDB: Sync engine retries POST /reports
    Note over IDB: Photo already on S3, only form data needs syncing
```

### Scenario 4: Connection lost during submit (response lost)

```mermaid
sequenceDiagram
    participant UI as Report Flow
    participant IDB as IndexedDB
    participant API as Lambda API

    UI->>API: POST /reports (offline_queue_id: "abc-123")
    Note over API: Report saved successfully
    API--xUI: Response lost (connection dropped)

    UI->>IDB: Store as pending (status: pending)
    Note over IDB: Sync engine retries later

    IDB->>API: POST /reports (offline_queue_id: "abc-123")
    API-->>IDB: { status: "duplicate", id: "..." }
    IDB->>IDB: Update status: synced
```

### Scenario 5: Intermittent connectivity

```mermaid
sequenceDiagram
    participant Sync as Sync Engine
    participant API as Lambda API
    participant S3 as S3

    Note over Sync: Processing queued report

    Sync->>API: POST /photos/upload ✓
    Sync->>S3: PUT photo (connection drops mid-upload)
    Note over Sync: XHR error → presigned URL still valid (15 min)

    Sync->>Sync: Wait (exponential backoff: 2s)
    Sync->>API: HEAD /health ✓
    Sync->>S3: PUT photo (retry, S3 PUT is idempotent) ✓

    Sync->>API: POST /reports
    API--xSync: 5xx server error

    Sync->>Sync: Wait (backoff: 4s)
    Sync->>API: HEAD /health ✓
    Sync->>API: POST /reports ✓

    Note over Sync: If presigned URL expired (>15 min),<br/>get a new one and re-upload
```

### Scenario 6: Reconnection with multiple queued reports

```mermaid
sequenceDiagram
    participant U as User
    participant Sync as Sync Engine
    participant IDB as IndexedDB
    participant API as Lambda API

    Note over IDB: 5 reports queued while offline

    U->>U: Reconnects to network
    Note over Sync: online event → HEAD /health → verified

    loop Sequential processing
        Sync->>IDB: Get oldest pending report
        Sync->>API: Upload photo + submit report
        alt Success
            Sync->>IDB: Mark synced
            Sync->>U: Update badge count (4 remaining)
        else Transient failure
            Sync->>Sync: Backoff, retry this report
        else Permanent failure
            Sync->>IDB: Mark failed
            Sync->>U: Show error indicator
            Sync->>Sync: Continue to next report
        end
    end

    Sync->>U: "All reports synced" (or "4 synced, 1 failed")
```

## Map Tile Handling

```mermaid
flowchart TD
    Request[Tile Request] --> SW{Service Worker}
    SW -->|App shell| Precache[Precache: Cache Only]
    SW -->|PMTiles range| PMCache["CacheFirst: 206→200 wrap, keyed by URL+Range"]
    SW -->|OSM raster| OSMCache[CacheFirst: 30 day TTL]
    SW -->|API GET /reports| APICache[NetworkFirst: 5 min TTL]
    SW -->|API POST| NoCache[Network Only → IndexedDB fallback]

    Reconnect[Online Event] --> Verify[HEAD /health]
    Verify -->|Verified| Reload[Reload map sources]
    Reload --> Repaint[MapLibre triggerRepaint]
```

### PMTiles Caching Detail

The Cache API rejects 206 (partial) responses. The custom service worker handler:
1. Intercepts range requests to `data.source.coop`
2. Keys cache entries by `URL?_r=Range` to store each partial response separately
3. Wraps 206 responses as 200 before storing (preserves Content-Range in `X-Original-Content-Range` header)
4. Reconstructs the 206 response when serving from cache

### Progressive Prefetch

On first GPS fix, the app background-prefetches building footprint tiles in a 2km radius at zoom 14 and 15:
- Starts 3 seconds after GPS fix (avoids competing with initial map load)
- Throttled at 50ms between requests
- ~80 tiles, ~3MB of cached data
- Stops if connectivity is lost
- Re-runs only if the user moves 500m+ from the last prefetch location
- The service worker caches these requests automatically via the same PMTiles handler

## IndexedDB Schema

```mermaid
erDiagram
    PENDING_REPORTS {
        string id PK "offline_queue_id"
        string status "pending | syncing | synced | failed"
        blob photo "compressed JPEG blob"
        string photo_key "S3 key (set after upload)"
        float latitude
        float longitude
        string s2_id
        string location_description
        string damage_level
        json survey_data "all survey fields"
        string error "error message if failed"
        int retry_count
        datetime created_at
        datetime last_attempt
        datetime synced_at
    }
```

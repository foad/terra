# Report Submission Flow

```mermaid
sequenceDiagram
    participant U as User (PWA)
    participant API as Lambda API
    participant S3 as S3 (Photos)
    participant AI as Bedrock (AI)
    participant DB as Supabase (PostGIS)
    participant IDB as IndexedDB
    participant LS as localStorage

    Note over U: Step 1 — Location
    U->>U: Select building on map (building_id) or drop a pin
    U->>API: GET /crisis-events/active?lat&lng
    API-->>U: { crisis_type, follow_up_questions }

    Note over U: Step 2 — Photo
    U->>API: POST /photos/upload { content_type }
    API-->>U: { photo_key, upload_url }
    U->>S3: PUT photo via presigned URL
    Note over U,AI: Fire-and-forget; non-blocking
    U->>API: POST /photos/classify { photo_key }
    API->>S3: Fetch photo
    API->>AI: Bedrock Converse + tool-use
    AI-->>API: { damage_level, damage_confidence,<br/>infrastructure_type, infrastructure_confidence }
    API-->>U: AI suggestions

    Note over U: Step 3 — Damage Classification
    U->>U: AI suggestion pre-selected (if confidence ≥ 0.6),<br/>user confirms or overrides

    Note over U: Step 4 — Survey
    U->>LS: Load previous survey-prefs (keyed by H3 r8 cell)
    U->>U: Fields pre-seeded from AI (infra type),<br/>active crisis (crisis_nature),<br/>previous answers (debris/electricity/health/needs)

    Note over U: Step 5 — Submit
    U->>IDB: Queue report (offline_queue_id, photo blob,<br/>building_id or pin coords, all fields)
    U->>U: Sync engine fires processQueue()
    U->>API: POST /reports
    API->>DB: Compute H3 r12/r8 indexes
    API->>DB: Find or create version chain (by building_id, fallback H3 r12)
    API->>DB: INSERT report (trigger flips previous versions to is_latest=false)
    API->>DB: SELECT area report count
    API-->>U: { id, status: created \| duplicate, version_chain_id }
    U->>IDB: Mark report synced
    U->>LS: Save survey answers for pre-seeding next report

    Note over U: Step 6 — Confirmation
    U->>U: Show Plus Code, area report count, "submit another" / return home
```

Offline-specific paths and failure scenarios live in [`offline-connectivity-scenarios.md`](offline-connectivity-scenarios.md).

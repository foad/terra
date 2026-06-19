# Database Schema

PostGIS (PostgreSQL 17) `db/001_initial_schema.sql`

The design follows two principles from the challenge brief: **scale to 500k reports per crisis** (national-level event) and **modularity** (crisis-specific form configuration without schema changes).

## Tables

### `reports` — one row per damage report submission

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID PK | Client-generated (idempotent offline retry — a resubmitted queued report can't double-insert) |
| `crisis_event_id` | UUID → crisis_events | Owning crisis (column reserved for future multi-crisis link) |
| `building_id` | TEXT | VIDA footprint identifier when the reporter tapped a building (`s2_id` from the PMTiles layer). NULL for manual-pin reports |
| `location` | GEOMETRY(Point, 4326) | Report coordinates, GIST-indexed |
| `h3_r12`, `h3_r8` | TEXT | Uber H3 cells at resolution 12 (~308 m² avg hexagon, edge ~9 m — building-granular) and 8 (~0.74 km² — aggregation/heatmap). Computed at ingest; B-tree indexed |
| `damage_level` | TEXT CHECK | `minimal` / `partial` / `complete` — the challenge's verbatim 3-tier classification |
| `ai_damage_level`, `ai_confidence`, `ai_infrastructure_type` | TEXT CHECK / REAL / TEXT[] | Bedrock vision classifier output, stored alongside (never instead of) the human's answer — supports later accuracy analysis and the human-in-the-loop story |
| `photo_url`, `thumbnail_url` | TEXT | S3 keys; objects are post-EXIF-strip only |
| `infrastructure_type` | TEXT[] | Challenge's verbatim category multi-select (English keys; i18next translates at display) |
| `infrastructure_description` | TEXT | Free-text details/name of the infrastructure |
| `crisis_nature` | TEXT[] | Verbatim taxonomy (Earthquake … Civil unrest) |
| `debris_present` | BOOLEAN | Verbatim debris question |
| `electricity_status`, `health_status`, `pressing_needs` | TEXT / TEXT / TEXT[] | Appendix-1 module answers |
| `follow_up_responses` | JSONB | Answers to crisis-configured follow-up questions. Modular by design: new questions need zero migrations |
| `version_chain_id`, `is_latest` | UUID / BOOLEAN | Version chaining (below) |
| `duplicate_status`, `related_report_id` | TEXT CHECK / UUID → reports | `possible_duplicate` (same spot <15m, <2min) or `reassessment` (same building_id) — flagged at ingest, never silently dropped |
| `device_id`, `offline_queue_id` | TEXT | Anonymous device correlation + offline-queue idempotency. **No user identity exists anywhere in the schema** |
| `submitted_at`, `created_at`, `updated_at` | TIMESTAMPTZ | `submitted_at` is capture time (survives offline queueing); `created_at` is ingest time |

### `crisis_events` — one row per deployed crisis

| Column | Type | Purpose |
|---|---|---|
| `id`, `name`, `crisis_type` | UUID PK / TEXT / TEXT | Identity |
| `region` | GEOMETRY(Polygon, 4326) | Crisis boundary drawn by the analyst; drives active-crisis lookup (point-in-polygon on the reporter's location) and map auto-centring |
| `follow_up_questions` | JSONB | Analyst-configured question definitions — the adjustable-form-fields requirement, no migration per crisis |
| `config` | JSONB | Reserved per-crisis configuration |
| `is_active` | BOOLEAN | Activation toggle |

### Vestigial tables

`building_footprints` and `admin_boundaries` exist from migration 001 but are **not used by the current pipeline**: footprints are served client-side from VIDA PMTiles (migration 002 replaced the FK with the direct VIDA identifier), and admin boundaries are reserved for the planned boundary-based area filter (#111). Documented here so nobody re-derives them.

## Versioning

Multiple reports about the same building are linked by `version_chain_id`. An `AFTER INSERT` trigger (`update_version_chain`) marks all earlier rows in the chain `is_latest = false`, so **the current state of the world is always `WHERE is_latest = true`** — one canonical assessment per building, biased to the most recent, exactly as the brief's report-lifecycle requirement asks. Full history remains queryable for the dashboard's version timeline.

## Scale design (50k / 250k / 500k reports per crisis)

- **Two-resolution H3 indexing** is the core decision: viewport and aggregation queries group on indexed `h3_r8` cells (a national crisis is a few thousand R8 cells, regardless of report count); building-level queries hit `h3_r12`. Raw geometry scans (GIST on `location`) are reserved for exact polygon containment.
- **B-tree indexes** cover every dashboard filter path: damage level, submission time, crisis, building, version chain (+`is_latest` composite).
- **Writes are append-only** (reports are never updated by users — corrections are new chain versions), so insert throughput scales linearly and the burst profile of a crisis's first 48 hours is absorbed by Lambda + connection pooling.
- Measured timings at 500k synthetic reports: see `db/generate_scale_test.py` + `db/scale_test_queries.sql` (#200).

## Privacy properties (enforced at the schema level)

- No accounts, names, or phone numbers exist in any table.
- Photo URLs reference post-EXIF-strip objects only; raw uploads never persist.

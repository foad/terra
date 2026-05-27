# API Reference

Base URL: `https://<api-gateway-id>.execute-api.eu-west-2.amazonaws.com`

## GET /health

Health check endpoint.

**Response**

```json
{
  "status": "ok"
}
```

## POST /photos/upload

Generate a presigned S3 URL for photo upload. Call this before submitting a report.

**Request**

Empty body.

**Response**

```json
{
  "photo_key": "uploads/59a7cb76-0b9f-4f45-a91d-e237a3760a31.jpg",
  "upload_url": "https://terra-photos-*.s3.amazonaws.com/uploads/...?X-Amz-Algorithm=..."
}
```

**Upload the photo**

```
PUT <upload_url>
Content-Type: image/jpeg
Body: <image binary>
```

The presigned URL expires after 15 minutes.

**Server-side post-processing**

When a photo lands in `uploads/` an S3 PUT event triggers the `photo_processor` Lambda which:

1. Extracts EXIF GPS coordinates (if present) and stores them as S3 user-defined metadata (`exif-latitude`, `exif-longitude`) on the original object.
2. Generates a 300×300 JPEG thumbnail at `thumbnails/<uuid>.jpg` (always JPEG regardless of source format).
3. Strips EXIF/XMP/IPTC from the original by re-saving the pixels and marks the rewritten object with metadata `processed=true`.

The Lambda short-circuits when invoked again on an object with `processed=true`, so the post-strip re-upload doesn't recurse. Frontends should treat the original `photo_key` as stable — the object at that key is replaced in place with the sanitised version a few hundred ms after upload.

## POST /photos/classify

Run AI vision classification on an uploaded photo. Returns suggested damage level and infrastructure type with confidence scores. The frontend calls this asynchronously after photo upload; the result is purely additive (used to pre-select the AI's choices in the report flow).

**Request**

```json
{
  "photo_key": "uploads/59a7cb76-0b9f-4f45-a91d-e237a3760a31.jpg"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `photo_key` | string | yes | Key returned from `POST /photos/upload`. Format: `uploads/<uuid>.{jpg,png,webp}` |

**Response**

```json
{
  "damage_level": "partial",
  "damage_confidence": 0.85,
  "infrastructure_type": ["residential"],
  "infrastructure_confidence": 0.92
}
```

`damage_level` is one of `minimal | partial | complete`. `infrastructure_type` is a non-empty array drawn from `residential | commercial | government | utility | transport | community | publicSpaces`. Confidence values are 0.0–1.0.

**Errors**

| Status | Reason |
|--------|--------|
| 400 | Invalid `photo_key` format or unsupported image content-type |
| 404 | Photo not found in S3 |
| 502 | Bedrock returned an unexpected response |
| 503 | Bedrock throttling — retry later |

The frontend treats every error as a silent drop and lets the user proceed without AI assistance.

## GET /reports/export

Download the filtered report set as a file. Accepts the same filter parameters as `GET /reports` plus a required `format` selector. The response includes a `Content-Disposition: attachment` header to trigger a browser download.

**Query Parameters**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `format` | string | yes | `csv` or `geojson` |
| `west` / `south` / `east` / `north` | float | no | Bounding box filter (all four required together) |
| `h3` | string | no | H3 R8 cell filter |
| `damage_level` | string | no | Comma-separated: `minimal`, `partial`, `complete` |
| `infrastructure_type` | string | no | Pipe-separated infrastructure types |
| `crisis_nature` | string | no | Pipe-separated crisis types |
| `from` / `to` | string | no | ISO datetimes |
| `building_id` | string | no | Single-building filter — returns every version, not just the latest |

The export caps at **10 000 rows** in v1. Larger result sets will be truncated; tighten filters or split by date range.

**Formats**

- **CSV**: flat header row, list fields (`infrastructure_type`, `crisis_nature`, `pressing_needs`) joined with `|`, booleans as `true`/`false`. Photos are referenced by their stable `photo_key` (e.g. `uploads/<uuid>.jpg`); the thumbnail key follows the convention `thumbnails/<uuid>.jpg`. Look up photos via the dashboard for a fresh presigned URL.
- **GeoJSON**: standard `FeatureCollection` (same feature shape as `GET /reports` but with `photo_key` in place of `photo_url`/`thumbnail_url`, and without the `total` field).

GeoPackage and Shapefile are deferred — they require Fiona/GDAL in the Lambda zip; will follow up in Phase 3.

## GET /crisis-events

List all crisis events that have a `region` polygon, active and inactive. Used by the admin dashboard and the analyst map overlay.

**Response**

```json
{
  "events": [
    {
      "id": "59a7cb76-...",
      "name": "Kent Floods 2026",
      "crisis_type": "Flood",
      "region": { "type": "Polygon", "coordinates": [[[0, 50], ...]] },
      "is_active": true
    }
  ]
}
```

## POST /crisis-events

Create a crisis event.

**Request**

```json
{
  "name": "Kent Floods 2026",
  "crisis_type": "Flood",
  "is_active": true,
  "region": { "type": "Polygon", "coordinates": [[[0, 50], ...]] }
}
```

`crisis_type` must be one of: `Earthquake`, `Flood`, `Tsunami`, `Hurricane/Cyclone`, `Wildfire`, `Explosion`, `Chemical incident`, `Conflict`, `Civil unrest`. `region` must be a GeoJSON Polygon.

**Response**: `{ "id": "<uuid>" }`

## PUT /crisis-events/{id}

Same request shape as POST. 404 if the id is unknown.

## DELETE /crisis-events/{id}

Hard-delete. 404 if the id is unknown.

## GET /crisis-events/active

Return the active crisis event whose `region_bbox` contains the given point. Used by the PWA to pre-fill the survey's crisis nature field. 404 if no active event covers the point.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `lat` | float | Latitude (-90 to 90) |
| `lng` | float | Longitude (-180 to 180) |

**Response**

```json
{
  "id": "59a7cb76-...",
  "name": "Kent Floods 2026",
  "crisis_type": "Flood"
}
```

`crisis_type` matches the English display strings stored in `reports.crisis_nature`.

## GET /reports

Query reports. Returns a GeoJSON FeatureCollection.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `west`, `south`, `east`, `north` | float | Bounding box filter (all four required) |
| `h3` | string | H3 R8 cell filter |
| `damage_level` | string | Comma-separated: `minimal`, `partial`, `complete` |
| `infrastructure_type` | string | Pipe-separated infrastructure types (values contain commas) |
| `from` | string | ISO datetime, reports submitted after |
| `to` | string | ISO datetime, reports submitted before |
| `building_id` | string | Building ID — returns all versions, not just latest |
| `limit` | int | Max results (default 500, max 1000) |
| `offset` | int | Pagination offset |

**Example request**

```
GET /reports?west=36.1&south=36.1&east=36.3&north=36.3&damage_level=partial,complete
```

**Response**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [36.16, 36.2] },
      "properties": {
        "id": "59a7cb76-...",
        "building_id": "u10k7d2q",
        "damage_level": "partial",
        "infrastructure_type": ["Residential Infrastructure (Houses and apartments)"],
        "submitted_at": "2026-04-17T15:35:47+00:00",
        "version_chain_id": "a34b724b-...",
        "is_latest": true,
        "version_count": 1
      }
    }
  ],
  "total": 1
}
```

When `building_id` is provided, all versions for that building are returned (not just `is_latest`), ordered by `submitted_at` descending.

## POST /reports

Submit a damage assessment report.

**Request**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `latitude` | float | yes | GPS latitude (-90 to 90) |
| `longitude` | float | yes | GPS longitude (-180 to 180) |
| `damage_level` | string | yes | `minimal`, `partial`, or `complete` |
| `infrastructure_type` | string[] | yes | At least one type |
| `crisis_nature` | string[] | yes | At least one nature |
| `building_id` | string | no | Building identifier from VIDA PMTiles |
| `photo_key` | string | no | Key returned from POST /photos/upload |
| `ai_damage_level` | string | no | AI-suggested damage level |
| `ai_infrastructure_type` | string[] | no | AI-suggested infrastructure type(s) |
| `ai_confidence` | float | no | AI confidence score (0-1) |
| `infrastructure_type_other` | string | no | Free text when "Other" selected |
| `infrastructure_description` | string | no | Free-text description of the infrastructure and its damage (max 2000 chars) |
| `debris_present` | boolean | no | Whether debris requires clearing |
| `electricity_status` | string | no | Electricity infrastructure condition |
| `health_status` | string | no | Health services functioning level |
| `pressing_needs` | string[] | no | Most pressing needs (multi-select) |
| `pressing_needs_other` | string | no | Free text when "Other" selected |
| `device_id` | string | no | Anonymous device identifier |
| `offline_queue_id` | string | no | Client-generated ID for offline dedup |

**Example request**

```json
{
  "latitude": 51.5074,
  "longitude": -0.1278,
  "building_id": "u10k7d2q",
  "damage_level": "partial",
  "photo_key": "uploads/59a7cb76-0b9f-4f45-a91d-e237a3760a31.jpg",
  "infrastructure_type": ["Residential Infrastructure (Houses and apartments)"],
  "crisis_nature": ["Earthquake"],
  "debris_present": true,
  "electricity_status": "Minor damage (service disruptions but quickly repairable)",
  "health_status": "Partially functional",
  "pressing_needs": ["Food assistance and safe drinking water"]
}
```

**Response (created)**

```json
{
  "id": "59a7cb76-0b9f-4f45-a91d-e237a3760a31",
  "status": "created",
  "area_report_count": 12,
  "version_chain_id": "a34b724b-c715-4e37-a81c-8b5ca7ef4d25"
}
```

**Response (duplicate)**

Returned when `offline_queue_id` matches an existing report:

```json
{
  "id": "59a7cb76-0b9f-4f45-a91d-e237a3760a31",
  "status": "duplicate",
  "message": "Report already submitted from offline queue"
}
```

**Version chaining**

When a report is submitted for a building that already has reports (matched by `building_id` or H3 R12 cell), the new report joins the existing version chain. Previous reports in the chain are marked `is_latest = false` via a database trigger.

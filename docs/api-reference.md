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

## GET /reports

Query reports. Returns a GeoJSON FeatureCollection.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `west`, `south`, `east`, `north` | float | Bounding box filter (all four required) |
| `h3` | string | H3 R8 cell filter |
| `damage_level` | string | Comma-separated: `minimal`, `partial`, `complete` |
| `infrastructure_type` | string | Filter by infrastructure type |
| `from` | string | ISO datetime, reports submitted after |
| `to` | string | ISO datetime, reports submitted before |
| `s2_id` | string | Building ID — returns all versions, not just latest |
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
        "s2_id": "4899916394579099648",
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

When `s2_id` is provided, all versions for that building are returned (not just `is_latest`), ordered by `submitted_at` descending.

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
| `s2_id` | string | no | Building identifier from VIDA PMTiles |
| `location_description` | string | no | Text description when GPS/building unavailable |
| `photo_key` | string | no | Key returned from POST /photos/upload |
| `ai_damage_level` | string | no | AI-suggested damage level |
| `ai_confidence` | float | no | AI confidence score (0-1) |
| `infrastructure_type_other` | string | no | Free text when "Other" selected |
| `infrastructure_name` | string | no | Name of the infrastructure |
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
  "s2_id": "4899916394579099648",
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

When a report is submitted for a building that already has reports (matched by `s2_id` or H3 R12 cell), the new report joins the existing version chain. Previous reports in the chain are marked `is_latest = false` via a database trigger.

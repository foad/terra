import os
import uuid
from datetime import datetime, timedelta, timezone

import boto3
import h3
from aws_lambda_powertools import Logger
from pydantic import BaseModel, ConfigDict, Field

from src.utils.db import get_connection

logger = Logger()
s3 = boto3.client("s3")

PHOTO_URL_EXPIRY_SECONDS = 3600

# Duplicate detection thresholds
DUPLICATE_TIME_WINDOW_SECONDS = 120  # 2 minutes
DUPLICATE_DISTANCE_METERS = 15  # 15m radius


def _presigned(uri: str | None) -> str | None:
    if not uri or not uri.startswith("s3://"):
        return None
    bucket, _, key = uri[5:].partition("/")
    if not bucket or not key:
        return None
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=PHOTO_URL_EXPIRY_SECONDS,
    )


class ReportSubmission(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    building_id: str | None = Field(None, max_length=32)
    damage_level: str = Field(pattern="^(minimal|partial|complete)$")
    photo_key: str | None = Field(None, pattern=r"^uploads/[a-f0-9-]+\.(jpg|png|webp)$")
    ai_damage_level: str | None = Field(None, pattern="^(minimal|partial|complete)$")
    ai_infrastructure_type: list[str] | None = None
    ai_confidence: float | None = Field(None, ge=0, le=1)
    infrastructure_type: list[str] = Field(min_length=1, max_length=10)
    infrastructure_type_other: str | None = Field(None, max_length=200)
    infrastructure_description: str | None = Field(None, max_length=2000)
    crisis_nature: list[str] = Field(min_length=1, max_length=10)
    debris_present: bool | None = None
    electricity_status: str | None = Field(None, max_length=200)
    health_status: str | None = Field(None, max_length=200)
    pressing_needs: list[str] = Field(default_factory=list, max_length=20)
    pressing_needs_other: str | None = Field(None, max_length=500)
    device_id: str | None = Field(None, max_length=128)
    offline_queue_id: str | None = Field(None, max_length=64, pattern=r"^[a-zA-Z0-9-]+$")


class ReportsQueryParams(BaseModel):
    """Validated query params for GET /reports."""

    model_config = ConfigDict(populate_by_name=True)

    west: float | None = Field(None, ge=-180, le=180)
    south: float | None = Field(None, ge=-90, le=90)
    east: float | None = Field(None, ge=-180, le=180)
    north: float | None = Field(None, ge=-90, le=90)
    h3: str | None = Field(None, max_length=64, pattern=r"^[0-9a-f]+$")
    damage_level: str | None = Field(None, max_length=64)
    infrastructure_type: str | None = Field(None, max_length=2000)
    crisis_nature: str | None = Field(None, max_length=500)
    from_: datetime | None = Field(None, alias="from")
    to: datetime | None = None
    building_id: str | None = Field(None, max_length=32)
    limit: int = Field(500, ge=1, le=1000)
    offset: int = Field(0, ge=0)


def _check_for_duplicates(conn, submission: ReportSubmission, h3_r12: str) -> dict:
    """
    Check for duplicate or reassessment reports.

    Returns dict with keys:
    - duplicate_status: None | 'possible_duplicate' | 'reassessment'
    - related_report_id: UUID of related report (if any)

    Logic:
    1. If same building_id → reassessment (intentional re-assessment)
    2. Else if same location + recent → possible_duplicate (accidental double-submit)
    3. Else → no flag

    Note: reassessment takes precedence over duplicate (building_id is explicit intent).
    """
    with conn.cursor() as cur:
        # Check 1: Same building → reassessment
        if submission.building_id:
            cur.execute(
                """
                SELECT id FROM reports
                WHERE building_id = %s
                ORDER BY submitted_at DESC
                LIMIT 1
                """,
                (submission.building_id,),
            )
            result = cur.fetchone()
            if result:
                return {
                    "duplicate_status": "reassessment",
                    "related_report_id": str(result[0]),
                }

        # Check 2: Same location + recent (within 2 minutes, 15m radius)
        # This catches accidental double-submits
        time_threshold = datetime.now(timezone.utc) - timedelta(seconds=DUPLICATE_TIME_WINDOW_SECONDS)
        cur.execute(
            f"""
            SELECT id FROM reports
            WHERE ST_DWithin(
                location,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                {DUPLICATE_DISTANCE_METERS}
            )
            AND submitted_at > %s
            ORDER BY submitted_at DESC
            LIMIT 1
            """,
            (submission.longitude, submission.latitude, time_threshold),
        )
        result = cur.fetchone()
        if result:
            return {
                "duplicate_status": "possible_duplicate",
                "related_report_id": str(result[0]),
            }

    return {"duplicate_status": None, "related_report_id": None}


def create_report(body: dict) -> dict:
    submission = ReportSubmission(**body)

    # Check for offline dedup
    if submission.offline_queue_id:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM reports WHERE offline_queue_id = %s",
                (submission.offline_queue_id,),
            )
            existing = cur.fetchone()
            if existing:
                return {
                    "id": str(existing[0]),
                    "status": "duplicate",
                    "message": "Report already submitted from offline queue",
                }

    # Compute H3 indexes
    h3_r12 = h3.latlng_to_cell(submission.latitude, submission.longitude, 12)
    h3_r8 = h3.latlng_to_cell(submission.latitude, submission.longitude, 8)

    # Determine version chain
    version_chain_id = _find_version_chain(submission.building_id, h3_r12)

    # Build photo URL from key. Thumbnail follows convention written by the
    # photo_processor Lambda: uploads/<uuid>.<ext> -> thumbnails/<uuid>.jpg.
    photos_bucket = os.environ.get("PHOTOS_BUCKET", "")
    photo_url = f"s3://{photos_bucket}/{submission.photo_key}" if submission.photo_key else None
    thumbnail_url = None
    if submission.photo_key and submission.photo_key.startswith("uploads/"):
        stem = submission.photo_key[len("uploads/"):].rsplit(".", 1)[0]
        thumbnail_url = f"s3://{photos_bucket}/thumbnails/{stem}.jpg"

    # Check for duplicates/reassessments
    conn = get_connection()
    duplicate_check = _check_for_duplicates(conn, submission, h3_r12)

    # Insert report
    report_id = str(uuid.uuid4())
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO reports (
                id, location, h3_r12, h3_r8, building_id,
                damage_level, ai_damage_level, ai_infrastructure_type, ai_confidence,
                photo_url, thumbnail_url, infrastructure_type, infrastructure_description,
                crisis_nature, debris_present, electricity_status,
                health_status, pressing_needs, version_chain_id,
                device_id, offline_queue_id, duplicate_status, related_report_id
            ) VALUES (
                %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                report_id,
                submission.longitude,
                submission.latitude,
                h3_r12,
                h3_r8,
                submission.building_id,
                submission.damage_level,
                submission.ai_damage_level,
                submission.ai_infrastructure_type,
                submission.ai_confidence,
                photo_url,
                thumbnail_url,
                submission.infrastructure_type,
                submission.infrastructure_description,
                submission.crisis_nature,
                submission.debris_present,
                submission.electricity_status,
                submission.health_status,
                submission.pressing_needs,
                str(version_chain_id),
                submission.device_id,
                submission.offline_queue_id,
                duplicate_check["duplicate_status"],
                duplicate_check["related_report_id"],
            ),
        )

        # Get area report count
        cur.execute(
            "SELECT COUNT(*) FROM reports WHERE h3_r8 = %s",
            (h3_r8,),
        )
        area_count = cur.fetchone()[0]

    conn.commit()

    return {
        "id": report_id,
        "status": "created",
        "area_report_count": area_count,
        "version_chain_id": str(version_chain_id),
        "duplicate_status": duplicate_check["duplicate_status"],
        "related_report_id": duplicate_check["related_report_id"],
    }


def build_filter_clause(q: "ReportsQueryParams | object") -> tuple[str, list]:
    """Build the WHERE clause + params for any query honouring the standard report filters."""
    conditions = ["is_latest = true"]
    values: list = []

    if all(v is not None for v in (q.west, q.south, q.east, q.north)):
        conditions.append("ST_Intersects(location, ST_MakeEnvelope(%s, %s, %s, %s, 4326))")
        values.extend([q.west, q.south, q.east, q.north])

    if q.h3:
        conditions.append("h3_r8 = %s")
        values.append(q.h3)

    if q.damage_level:
        levels = q.damage_level.split(",")
        placeholders = ",".join(["%s"] * len(levels))
        conditions.append(f"damage_level IN ({placeholders})")
        values.extend(levels)

    if q.infrastructure_type:
        types = q.infrastructure_type.split("|")
        placeholders = " OR ".join(["%s = ANY(infrastructure_type)"] * len(types))
        conditions.append(f"({placeholders})")
        values.extend(types)

    if q.crisis_nature:
        natures = q.crisis_nature.split("|")
        placeholders = " OR ".join(["%s = ANY(crisis_nature)"] * len(natures))
        conditions.append(f"({placeholders})")
        values.extend(natures)

    if q.from_:
        conditions.append("submitted_at >= %s")
        values.append(q.from_)
    if q.to:
        conditions.append("submitted_at <= %s")
        values.append(q.to)

    # When querying by building_id, show all versions not just latest
    if q.building_id:
        conditions = [c for c in conditions if c != "is_latest = true"]
        conditions.append("building_id = %s")
        values.append(q.building_id)

    return " AND ".join(conditions), values


def query_reports(params: dict) -> dict:
    """Query reports with spatial, temporal, and attribute filters. Returns GeoJSON."""
    q = ReportsQueryParams(**params)
    conn = get_connection()
    where, values = build_filter_clause(q)

    limit = q.limit
    offset = q.offset

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                id, ST_X(location) as lng, ST_Y(location) as lat,
                building_id, damage_level,
                ai_damage_level, ai_infrastructure_type, ai_confidence,
                photo_url, thumbnail_url,
                infrastructure_type, infrastructure_description,
                crisis_nature, debris_present, electricity_status,
                health_status, pressing_needs, version_chain_id,
                is_latest, submitted_at,
                duplicate_status, related_report_id,
                (SELECT COUNT(*) FROM reports r2
                 WHERE r2.version_chain_id = reports.version_chain_id) as version_count
            FROM reports
            WHERE {where}
            ORDER BY submitted_at DESC
            LIMIT %s OFFSET %s
            """,
            (*values, limit, offset),
        )
        rows = cur.fetchall()

        cur.execute(
            f"SELECT COUNT(*) FROM reports WHERE {where}",
            tuple(values),
        )
        total = cur.fetchone()[0]

    features = []
    for row in rows:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [row[1], row[2]],
            },
            "properties": {
                "id": str(row[0]),
                "building_id": row[3],
                "damage_level": row[4],
                "ai_damage_level": row[5],
                "ai_infrastructure_type": row[6],
                "ai_confidence": row[7],
                "photo_url": _presigned(row[8]),
                "thumbnail_url": _presigned(row[9]),
                "infrastructure_type": row[10],
                "infrastructure_description": row[11],
                "crisis_nature": row[12],
                "debris_present": row[13],
                "electricity_status": row[14],
                "health_status": row[15],
                "pressing_needs": row[16],
                "version_chain_id": str(row[17]),
                "is_latest": row[18],
                "submitted_at": row[19].isoformat() if row[19] else None,
                "duplicate_status": row[20],
                "related_report_id": row[21],
                "version_count": row[22],
            },
        })

    return {
        "type": "FeatureCollection",
        "features": features,
        "total": total,
    }


def _find_version_chain(building_id: str | None, h3_r12: str) -> uuid.UUID:
    """Find existing version chain for this building, or create a new one."""
    conn = get_connection()
    with conn.cursor() as cur:
        if building_id:
            cur.execute(
                "SELECT version_chain_id FROM reports WHERE building_id = %s AND is_latest = true LIMIT 1",
                (building_id,),
            )
            row = cur.fetchone()
            if row:
                return uuid.UUID(row[0])
            return uuid.uuid4()

        cur.execute(
            "SELECT version_chain_id FROM reports WHERE h3_r12 = %s AND is_latest = true LIMIT 1",
            (h3_r12,),
        )
        row = cur.fetchone()
        if row:
            return uuid.UUID(row[0])

    # New chain
    return uuid.uuid4()

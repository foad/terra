import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import boto3
import h3
from aws_lambda_powertools import Logger
from pydantic import BaseModel, ConfigDict, Field

from src.handlers.pii_filter import redact_pii
from src.handlers.translate import translate_to_english
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
    follow_up_responses: dict | None = None


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


def _check_for_duplicates(conn, submission: ReportSubmission) -> dict:
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
        # Cast to geography so ST_DWithin uses meters, not degrees.
        time_threshold = datetime.now(timezone.utc) - timedelta(seconds=DUPLICATE_TIME_WINDOW_SECONDS)
        cur.execute(
            """
            SELECT id FROM reports
            WHERE ST_DWithin(
                location::geography,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                %s
            )
            AND submitted_at > %s
            ORDER BY submitted_at DESC
            LIMIT 1
            """,
            (submission.longitude, submission.latitude, DUPLICATE_DISTANCE_METERS, time_threshold),
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

    # Redact PII from user-submitted free-text. Best-effort: a Bedrock failure
    # falls through with the original text rather than blocking the submission.
    for _field in ("infrastructure_description", "infrastructure_type_other", "pressing_needs_other"):
        _raw = getattr(submission, _field)
        if _raw:
            _redacted, _entities = redact_pii(_raw)
            if _entities:
                setattr(submission, _field, _redacted)
                logger.info(
                    "pii_redacted",
                    extra={"field": _field, "entity_types": _entities, "count": len(_entities)},
                )

    # Translate user description to English. Runs on the post-PII-redacted text
    # so [REDACTION] placeholders are preserved. Fail-open: None on any failure.
    infrastructure_description_en: str | None = None
    if submission.infrastructure_description:
        infrastructure_description_en = translate_to_english(submission.infrastructure_description)
        if infrastructure_description_en:
            logger.info(
                "description_translated",
                extra={"original_length": len(submission.infrastructure_description)},
            )

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
        stem = submission.photo_key[len("uploads/") :].rsplit(".", 1)[0]
        thumbnail_url = f"s3://{photos_bucket}/thumbnails/{stem}.jpg"

    # Check for duplicates/reassessments
    conn = get_connection()
    duplicate_check = _check_for_duplicates(conn, submission)

    # Insert report. Named placeholders keep column/value mapping explicit so
    # adding a column doesn't require recounting %s positions.
    report_id = str(uuid.uuid4())
    insert_data = {
        "id": report_id,
        "lng": submission.longitude,
        "lat": submission.latitude,
        "h3_r12": h3_r12,
        "h3_r8": h3_r8,
        "building_id": submission.building_id,
        "damage_level": submission.damage_level,
        "ai_damage_level": submission.ai_damage_level,
        "ai_infrastructure_type": submission.ai_infrastructure_type,
        "ai_confidence": submission.ai_confidence,
        "photo_url": photo_url,
        "thumbnail_url": thumbnail_url,
        "infrastructure_type": submission.infrastructure_type,
        "infrastructure_description": submission.infrastructure_description,
        "infrastructure_description_en": infrastructure_description_en,
        "crisis_nature": submission.crisis_nature,
        "debris_present": submission.debris_present,
        "electricity_status": submission.electricity_status,
        "health_status": submission.health_status,
        "pressing_needs": submission.pressing_needs,
        "version_chain_id": str(version_chain_id),
        "device_id": submission.device_id,
        "offline_queue_id": submission.offline_queue_id,
        "duplicate_status": duplicate_check["duplicate_status"],
        "related_report_id": duplicate_check["related_report_id"],
        "follow_up_responses": (json.dumps(submission.follow_up_responses) if submission.follow_up_responses else None),
    }
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO reports (
                id, location, h3_r12, h3_r8, building_id,
                damage_level, ai_damage_level, ai_infrastructure_type, ai_confidence,
                photo_url, thumbnail_url, infrastructure_type, infrastructure_description,
                infrastructure_description_en,
                crisis_nature, debris_present, electricity_status,
                health_status, pressing_needs, version_chain_id,
                device_id, offline_queue_id, duplicate_status, related_report_id,
                follow_up_responses
            ) VALUES (
                %(id)s,
                ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326),
                %(h3_r12)s, %(h3_r8)s, %(building_id)s,
                %(damage_level)s, %(ai_damage_level)s, %(ai_infrastructure_type)s, %(ai_confidence)s,
                %(photo_url)s, %(thumbnail_url)s, %(infrastructure_type)s, %(infrastructure_description)s,
                %(infrastructure_description_en)s,
                %(crisis_nature)s, %(debris_present)s, %(electricity_status)s,
                %(health_status)s, %(pressing_needs)s, %(version_chain_id)s,
                %(device_id)s, %(offline_queue_id)s, %(duplicate_status)s, %(related_report_id)s,
                %(follow_up_responses)s
            )
            """,
            insert_data,
        )

    conn.commit()

    return {
        "id": report_id,
        "status": "created",
        "version_chain_id": str(version_chain_id),
        "duplicate_status": duplicate_check["duplicate_status"],
        "related_report_id": duplicate_check["related_report_id"],
    }


def build_filter_clause(q: "ReportsQueryParams | object") -> tuple[str, list]:
    """Build the WHERE clause + params for any query honouring the standard report filters."""
    conditions = [
        "is_latest = true",
        "(device_id IS NULL OR device_id NOT LIKE 'device-e2e-%%')",
    ]
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
        # Filter on the effective level: an analyst override (#169) supersedes
        # the community classification everywhere downstream.
        conditions.append(f"COALESCE(analyst_damage_level, damage_level) IN ({placeholders})")
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
        conditions.append("reports.building_id = %s")
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
                reports.building_id, COALESCE(analyst_damage_level, damage_level) as damage_level,
                ai_damage_level, ai_infrastructure_type, ai_confidence,
                photo_url, thumbnail_url,
                infrastructure_type, infrastructure_description,
                crisis_nature, debris_present, electricity_status,
                health_status, pressing_needs, version_chain_id,
                is_latest, submitted_at,
                duplicate_status, related_report_id,
                (SELECT COUNT(*) FROM reports r2
                 WHERE r2.version_chain_id = reports.version_chain_id) as version_count,
                follow_up_responses,
                damage_level, analyst_damage_level, flag_status, flag_reason,
                infrastructure_description_en,
                (pb.building_id IS NOT NULL) AS priority_flag
            FROM reports
            LEFT JOIN priority_buildings pb ON reports.building_id = pb.building_id
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
        features.append(
            {
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
                    "related_report_id": str(row[21]) if row[21] else None,
                    "version_count": row[22],
                    "follow_up_responses": row[23],
                    "community_damage_level": row[24],
                    "analyst_damage_level": row[25],
                    "flag_status": row[26],
                    "flag_reason": row[27],
                    "infrastructure_description_en": row[28],
                    "priority_flag": row[29],
                },
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
        "total": total,
    }


def query_coverage(params: dict) -> dict:
    """Public minimal-payload view for the community PWA

    Returns a FeatureCollection with only (id, building_id, damage_level,
    submitted_at) per row
    """
    q = ReportsQueryParams(**params)
    where, values = build_filter_clause(q)

    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                id, ST_X(location) as lng, ST_Y(location) as lat,
                reports.building_id, COALESCE(analyst_damage_level, damage_level) as damage_level,
                submitted_at, (pb.building_id IS NOT NULL) AS priority_flag
            FROM reports
            LEFT JOIN priority_buildings pb ON reports.building_id = pb.building_id
            WHERE {where}
            ORDER BY submitted_at DESC
            LIMIT %s OFFSET %s
            """,
            (*values, q.limit, q.offset),
        )
        rows = cur.fetchall()

        cur.execute(
            f"SELECT COUNT(*) FROM reports WHERE {where}",
            tuple(values),
        )
        total = cur.fetchone()[0]

    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [row[1], row[2]]},
            "properties": {
                "id": str(row[0]),
                "building_id": row[3],
                "damage_level": row[4],
                "submitted_at": row[5].isoformat() if row[5] else None,
                "priority_flag": row[6],
            },
        }
        for row in rows
    ]

    return {
        "type": "FeatureCollection",
        "features": features,
        "total": total,
    }


REVIEW_DAMAGE_LEVELS = {"minimal", "partial", "complete"}
REVIEW_FLAG_STATUSES = {"suspect", "invalid"}


def review_report(report_id: str, body: dict) -> dict:
    """Analyst review actions (#169, #170): set or clear a damage-level
    override and/or a flag. The community's original classification is never
    overwritten — overrides live in analyst_damage_level and all queries read
    the effective level via COALESCE.

    Accepts any of: analyst_damage_level (level or null to clear),
    flag_status ('suspect' | 'invalid' | null to clear), flag_reason (text).
    """
    updates = []
    values: list = []

    if "analyst_damage_level" in body:
        level = body["analyst_damage_level"]
        if level is not None and level not in REVIEW_DAMAGE_LEVELS:
            raise ValueError(f"analyst_damage_level must be one of {sorted(REVIEW_DAMAGE_LEVELS)} or null")
        updates.append("analyst_damage_level = %s")
        values.append(level)

    if "flag_status" in body:
        status = body["flag_status"]
        if status is not None and status not in REVIEW_FLAG_STATUSES:
            raise ValueError(f"flag_status must be one of {sorted(REVIEW_FLAG_STATUSES)} or null")
        updates.append("flag_status = %s")
        values.append(status)
        if status is None:
            updates.append("flag_reason = NULL")

    if "flag_reason" in body:
        reason = body["flag_reason"]
        if reason is not None:
            if len(reason) > 500:
                raise ValueError("flag_reason must be 500 characters or fewer")
            if "flag_status" not in body:
                raise ValueError("flag_reason requires flag_status to be set in the same request")
        updates.append("flag_reason = %s")
        values.append(reason)

    if not updates:
        raise ValueError("Provide at least one of: analyst_damage_level, flag_status, flag_reason")

    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE reports
            SET {", ".join(updates)}, updated_at = now()
            WHERE id = %s
            RETURNING id, COALESCE(analyst_damage_level, damage_level),
                      damage_level, analyst_damage_level, flag_status, flag_reason
            """,
            (*values, report_id),
        )
        row = cur.fetchone()
    conn.commit()
    if row is None:
        raise ValueError(f"No report with id {report_id}")

    return {
        "id": str(row[0]),
        "damage_level": row[1],
        "community_damage_level": row[2],
        "analyst_damage_level": row[3],
        "flag_status": row[4],
        "flag_reason": row[5],
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


def get_priority_buildings() -> dict:
    """Return all building IDs currently flagged for more photos."""
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT building_id FROM priority_buildings ORDER BY flagged_at DESC")
        rows = cur.fetchall()
    return {"building_ids": [row[0] for row in rows]}


def set_building_priority(building_id: str, flagged: bool) -> dict:
    """Upsert or delete a building from priority_buildings."""
    if not building_id or len(building_id) > 64:
        raise ValueError("building_id must be 1–64 characters")
    conn = get_connection()
    with conn.cursor() as cur:
        if flagged:
            cur.execute(
                """
                INSERT INTO priority_buildings (building_id)
                VALUES (%s)
                ON CONFLICT (building_id) DO NOTHING
                """,
                (building_id,),
            )
        else:
            cur.execute(
                "DELETE FROM priority_buildings WHERE building_id = %s",
                (building_id,),
            )
    conn.commit()
    return {"building_id": building_id, "priority_flag": flagged}

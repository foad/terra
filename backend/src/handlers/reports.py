import os
import uuid
import h3
from pydantic import BaseModel, Field
from aws_lambda_powertools import Logger

from src.utils.db import get_connection

logger = Logger()


class ReportSubmission(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    s2_id: str | None = None
    location_description: str | None = None
    damage_level: str = Field(pattern="^(minimal|partial|complete)$")
    photo_key: str | None = None
    ai_damage_level: str | None = None
    ai_confidence: float | None = None
    infrastructure_type: list[str] = Field(min_length=1)
    infrastructure_type_other: str | None = None
    infrastructure_name: str | None = None
    crisis_nature: list[str] = Field(min_length=1)
    debris_present: bool | None = None
    electricity_status: str | None = None
    health_status: str | None = None
    pressing_needs: list[str] = []
    pressing_needs_other: str | None = None
    device_id: str | None = None
    offline_queue_id: str | None = None


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
    version_chain_id = _find_version_chain(submission.s2_id, h3_r12)

    # Build photo URL from key
    photos_bucket = os.environ.get("PHOTOS_BUCKET", "")
    photo_url = f"s3://{photos_bucket}/{submission.photo_key}" if submission.photo_key else None

    # Insert report
    report_id = str(uuid.uuid4())
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO reports (
                id, location, h3_r12, h3_r8, s2_id, location_description,
                damage_level, ai_damage_level, ai_confidence,
                photo_url, infrastructure_type, infrastructure_name,
                crisis_nature, debris_present, electricity_status,
                health_status, pressing_needs, version_chain_id,
                device_id, offline_queue_id
            ) VALUES (
                %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                report_id,
                submission.longitude,
                submission.latitude,
                h3_r12,
                h3_r8,
                submission.s2_id,
                submission.location_description,
                submission.damage_level,
                submission.ai_damage_level,
                submission.ai_confidence,
                photo_url,
                submission.infrastructure_type,
                submission.infrastructure_name,
                submission.crisis_nature,
                submission.debris_present,
                submission.electricity_status,
                submission.health_status,
                submission.pressing_needs,
                str(version_chain_id),
                submission.device_id,
                submission.offline_queue_id,
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
    }


def _find_version_chain(s2_id: str | None, h3_r12: str) -> uuid.UUID:
    """Find existing version chain for this building, or create a new one."""
    conn = get_connection()
    with conn.cursor() as cur:
        # Match by s2_id first
        if s2_id:
            cur.execute(
                "SELECT version_chain_id FROM reports WHERE s2_id = %s AND is_latest = true LIMIT 1",
                (s2_id,),
            )
            row = cur.fetchone()
            if row:
                return uuid.UUID(row[0])

        # Fallback: match by H3 R12 cell
        cur.execute(
            "SELECT version_chain_id FROM reports WHERE h3_r12 = %s AND is_latest = true LIMIT 1",
            (h3_r12,),
        )
        row = cur.fetchone()
        if row:
            return uuid.UUID(row[0])

    # New chain
    return uuid.uuid4()

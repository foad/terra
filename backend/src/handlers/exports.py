import csv
import io
import json
from datetime import UTC, datetime
from typing import Literal

from aws_lambda_powertools import Logger
from pydantic import BaseModel, ConfigDict, Field

from src.handlers.reports import build_filter_clause
from src.utils.db import get_connection

logger = Logger()

EXPORT_ROW_CAP = 10000

CSV_HEADER = [
    "id",
    "submitted_at",
    "latitude",
    "longitude",
    "building_id",
    "damage_level",
    "infrastructure_type",
    "infrastructure_description",
    "crisis_nature",
    "debris_present",
    "electricity_status",
    "health_status",
    "pressing_needs",
    "ai_damage_level",
    "ai_confidence",
    "location_description",
    "photo_key",
    "version_chain_id",
    "is_latest",
]


def _s3_key(uri: str | None) -> str | None:
    if not uri or not uri.startswith("s3://"):
        return None
    _, _, key = uri[5:].partition("/")
    return key or None


class ExportParams(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    format: Literal["csv", "geojson"]
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


def export_reports(params: dict) -> tuple[str, str, str]:
    """Return (body, content_type, filename) for the requested export."""
    q = ExportParams(**params)
    where, values = build_filter_clause(q)

    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                id, ST_X(location) as lng, ST_Y(location) as lat,
                building_id, location_description, damage_level,
                ai_damage_level, ai_confidence,
                photo_url, thumbnail_url,
                infrastructure_type, infrastructure_description,
                crisis_nature, debris_present, electricity_status,
                health_status, pressing_needs, version_chain_id,
                is_latest, submitted_at
            FROM reports
            WHERE {where}
            ORDER BY submitted_at DESC
            LIMIT %s
            """,
            (*values, EXPORT_ROW_CAP),
        )
        rows = cur.fetchall()

    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    if q.format == "csv":
        return _to_csv(rows), "text/csv", f"terra-reports-{stamp}.csv"
    return _to_geojson(rows), "application/geo+json", f"terra-reports-{stamp}.geojson"


def _to_csv(rows: list) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(CSV_HEADER)
    for r in rows:
        writer.writerow([
            str(r[0]),
            r[19].isoformat() if r[19] else "",
            r[2],
            r[1],
            r[3] or "",
            r[5],
            "|".join(r[10] or []),
            r[11] or "",
            "|".join(r[12] or []),
            "" if r[13] is None else ("true" if r[13] else "false"),
            r[14] or "",
            r[15] or "",
            "|".join(r[16] or []),
            r[6] or "",
            "" if r[7] is None else r[7],
            r[4] or "",
            _s3_key(r[8]) or "",
            str(r[17]),
            "true" if r[18] else "false",
        ])
    return buf.getvalue()


def _to_geojson(rows: list) -> str:
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [r[1], r[2]]},
            "properties": {
                "id": str(r[0]),
                "building_id": r[3],
                "location_description": r[4],
                "damage_level": r[5],
                "ai_damage_level": r[6],
                "ai_confidence": r[7],
                "photo_key": _s3_key(r[8]),
                "infrastructure_type": r[10],
                "infrastructure_description": r[11],
                "crisis_nature": r[12],
                "debris_present": r[13],
                "electricity_status": r[14],
                "health_status": r[15],
                "pressing_needs": r[16],
                "version_chain_id": str(r[17]),
                "is_latest": r[18],
                "submitted_at": r[19].isoformat() if r[19] else None,
            },
        }
        for r in rows
    ]
    return json.dumps({"type": "FeatureCollection", "features": features}, default=str)

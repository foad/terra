import json
import uuid

from aws_lambda_powertools import Logger
from pydantic import BaseModel, ConfigDict, Field

from src.utils.db import get_connection

logger = Logger()

CRISIS_TYPES = (
    "Earthquake",
    "Flood",
    "Tsunami",
    "Hurricane/Cyclone",
    "Wildfire",
    "Explosion",
    "Chemical incident",
    "Conflict",
    "Civil unrest",
)


class ActiveCrisisQuery(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class CrisisEventInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    crisis_type: str
    is_active: bool = True
    region: dict


def _validate_crisis_type(value: str) -> None:
    if value not in CRISIS_TYPES:
        raise ValueError(f"crisis_type must be one of {CRISIS_TYPES}")


def _validate_polygon(geom: dict) -> None:
    if geom.get("type") != "Polygon":
        raise ValueError("region must be a GeoJSON Polygon")
    coords = geom.get("coordinates")
    if not isinstance(coords, list) or not coords:
        raise ValueError("region must have non-empty coordinates")


def get_active_crisis(params: dict) -> dict | None:
    q = ActiveCrisisQuery(**params)
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, crisis_type
            FROM crisis_events
            WHERE is_active = true
              AND region IS NOT NULL
              AND ST_Contains(region, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
            LIMIT 1
            """,
            (q.lng, q.lat),
        )
        row = cur.fetchone()

    if not row:
        return None
    return {
        "id": str(row[0]),
        "name": row[1],
        "crisis_type": row[2],
    }


def list_active_crises() -> dict:
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, crisis_type, ST_AsGeoJSON(region), is_active
            FROM crisis_events
            WHERE region IS NOT NULL
            ORDER BY name
            """,
        )
        rows = cur.fetchall()
    return {
        "events": [
            {
                "id": str(row[0]),
                "name": row[1],
                "crisis_type": row[2],
                "region": json.loads(row[3]),
                "is_active": row[4],
            }
            for row in rows
        ],
    }


def create_crisis(body: dict) -> dict:
    payload = CrisisEventInput(**(body or {}))
    _validate_crisis_type(payload.crisis_type)
    _validate_polygon(payload.region)

    event_id = str(uuid.uuid4())
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO crisis_events (id, name, crisis_type, region, is_active)
            VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326), %s)
            """,
            (
                event_id,
                payload.name,
                payload.crisis_type,
                json.dumps(payload.region),
                payload.is_active,
            ),
        )
    conn.commit()
    return {"id": event_id}


def update_crisis(event_id: str, body: dict) -> dict:
    payload = CrisisEventInput(**(body or {}))
    _validate_crisis_type(payload.crisis_type)
    _validate_polygon(payload.region)

    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE crisis_events
            SET name = %s,
                crisis_type = %s,
                region = ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326),
                is_active = %s
            WHERE id = %s
            """,
            (
                payload.name,
                payload.crisis_type,
                json.dumps(payload.region),
                payload.is_active,
                event_id,
            ),
        )
        if cur.rowcount == 0:
            raise FileNotFoundError(f"Crisis event {event_id} not found")
    conn.commit()
    return {"id": event_id}


def delete_crisis(event_id: str) -> None:
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM crisis_events WHERE id = %s", (event_id,))
        if cur.rowcount == 0:
            raise FileNotFoundError(f"Crisis event {event_id} not found")
    conn.commit()

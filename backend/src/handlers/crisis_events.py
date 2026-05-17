import json

from aws_lambda_powertools import Logger
from pydantic import BaseModel, ConfigDict, Field

from src.utils.db import get_connection

logger = Logger()


class ActiveCrisisQuery(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


def get_active_crisis(params: dict) -> dict | None:
    q = ActiveCrisisQuery(**params)
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, crisis_type
            FROM crisis_events
            WHERE is_active = true
              AND region_bbox IS NOT NULL
              AND ST_Contains(region_bbox, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
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
            SELECT id, name, crisis_type, ST_AsGeoJSON(region_bbox)
            FROM crisis_events
            WHERE is_active = true
              AND region_bbox IS NOT NULL
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
                "region_bbox": json.loads(row[3]),
            }
            for row in rows
        ],
    }

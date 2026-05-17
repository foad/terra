import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from src.handlers.exports import CSV_HEADER, export_reports


def _row(**overrides):
    base = {
        "id": "report-1",
        "lng": 0.5,
        "lat": 51.4,
        "building_id": "u10k7d2q",
        "location_description": None,
        "damage_level": "partial",
        "ai_damage_level": "partial",
        "ai_confidence": 0.85,
        "photo_url": "s3://terra-photos/uploads/abc.jpg",
        "thumbnail_url": "s3://terra-photos/thumbnails/abc.jpg",
        "infrastructure_type": ["Residential Infrastructure (Houses and apartments)"],
        "infrastructure_name": "Test building",
        "crisis_nature": ["Flood"],
        "debris_present": True,
        "electricity_status": "Minor damage (service disruptions but quickly repairable)",
        "health_status": "Fully functional",
        "pressing_needs": ["Food assistance and safe drinking water"],
        "version_chain_id": "chain-1",
        "is_latest": True,
        "submitted_at": datetime(2026, 5, 7, 14, 30, tzinfo=timezone.utc),
    }
    base.update(overrides)
    return (
        base["id"], base["lng"], base["lat"], base["building_id"],
        base["location_description"], base["damage_level"],
        base["ai_damage_level"], base["ai_confidence"],
        base["photo_url"], base["thumbnail_url"],
        base["infrastructure_type"], base["infrastructure_name"],
        base["crisis_nature"], base["debris_present"],
        base["electricity_status"], base["health_status"],
        base["pressing_needs"], base["version_chain_id"],
        base["is_latest"], base["submitted_at"],
    )


def _mock_conn(rows):
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = rows
    mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return mock_conn, mock_cursor


class TestExportReports:
    @patch("src.handlers.exports.get_connection")
    def test_geojson_format(self, mock_get_conn):
        mock_get_conn.return_value, _ = _mock_conn([_row()])

        body, content_type, filename = export_reports({"format": "geojson"})

        assert content_type == "application/geo+json"
        assert filename.startswith("terra-reports-") and filename.endswith(".geojson")
        parsed = json.loads(body)
        assert parsed["type"] == "FeatureCollection"
        assert len(parsed["features"]) == 1
        feat = parsed["features"][0]
        assert feat["geometry"]["coordinates"] == [0.5, 51.4]
        assert feat["properties"]["damage_level"] == "partial"
        assert feat["properties"]["photo_key"] == "uploads/abc.jpg"
        assert "photo_url" not in feat["properties"]
        assert "thumbnail_url" not in feat["properties"]

    @patch("src.handlers.exports.get_connection")
    def test_csv_format_header_and_row(self, mock_get_conn):
        mock_get_conn.return_value, _ = _mock_conn([_row()])

        body, content_type, filename = export_reports({"format": "csv"})

        assert content_type == "text/csv"
        assert filename.startswith("terra-reports-") and filename.endswith(".csv")
        lines = body.strip().split("\r\n")
        assert lines[0].split(",") == CSV_HEADER
        assert "photo_key" in CSV_HEADER
        assert "photo_url" not in CSV_HEADER
        assert "uploads/abc.jpg" in lines[1]
        assert "partial" in lines[1]
        assert "u10k7d2q" in lines[1]

    @patch("src.handlers.exports.get_connection")
    def test_csv_pipe_joins_list_fields(self, mock_get_conn):
        mock_get_conn.return_value, _ = _mock_conn([
            _row(crisis_nature=["Earthquake", "Flood"]),
        ])

        body, _, _ = export_reports({"format": "csv"})

        assert "Earthquake|Flood" in body

    @patch("src.handlers.exports.get_connection")
    def test_csv_serialises_booleans_and_nulls(self, mock_get_conn):
        mock_get_conn.return_value, _ = _mock_conn([
            _row(debris_present=False, ai_confidence=None),
        ])

        body, _, _ = export_reports({"format": "csv"})
        row = body.strip().split("\r\n")[1]
        cells = row.split(",")
        # debris_present is at index 9
        assert cells[9] == "false"

    def test_unknown_format_rejected(self):
        with pytest.raises(ValidationError):
            export_reports({"format": "xml"})

    def test_missing_format_rejected(self):
        with pytest.raises(ValidationError):
            export_reports({})

    @patch("src.handlers.exports.get_connection")
    def test_invalid_h3_rejected(self, mock_get_conn):
        with pytest.raises(ValidationError):
            export_reports({"format": "csv", "h3": "DROP TABLE"})
        mock_get_conn.assert_not_called()

    @patch("src.handlers.exports.get_connection")
    def test_caps_to_export_row_cap(self, mock_get_conn):
        mock_conn, mock_cursor = _mock_conn([])
        mock_get_conn.return_value = mock_conn

        export_reports({"format": "csv"})

        # LIMIT is the last bound param
        params = mock_cursor.execute.call_args[0][1]
        assert params[-1] == 10000

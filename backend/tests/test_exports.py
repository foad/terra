import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from src.handlers.exports import CSV_HEADER, _to_csv, _to_geojson, export_reports


def _row(**overrides):
    base = {
        "id": "report-1",
        "lng": 0.5,
        "lat": 51.4,
        "building_id": "u10k7d2q",
        "damage_level": "partial",
        "ai_damage_level": "partial",
        "ai_confidence": 0.85,
        "photo_url": "s3://terra-photos/uploads/abc.jpg",
        "thumbnail_url": "s3://terra-photos/thumbnails/abc.jpg",
        "infrastructure_type": ["Residential Infrastructure (Houses and apartments)"],
        "infrastructure_description": "Test building",
        "infrastructure_description_en": None,
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
        base["damage_level"],
        base["ai_damage_level"], base["ai_confidence"],
        base["photo_url"], base["thumbnail_url"],
        base["infrastructure_type"], base["infrastructure_description"],
        base["infrastructure_description_en"],
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
    @patch("src.handlers.exports.s3")
    @patch("src.handlers.exports.get_connection")
    def test_returns_presigned_download_url(self, mock_get_conn, mock_s3):
        mock_get_conn.return_value, _ = _mock_conn([_row(), _row(id="report-2")])
        mock_s3.generate_presigned_url.return_value = "https://example/exports/x.geojson?sig=abc"

        result = export_reports({"format": "geojson"})

        assert result["download_url"] == "https://example/exports/x.geojson?sig=abc"
        assert result["total_rows"] == 2
        assert result["filename"].startswith("terra-reports-")
        assert result["filename"].endswith(".geojson")
        assert "expires_at" in result

    @patch("src.handlers.exports.s3")
    @patch("src.handlers.exports.get_connection")
    def test_uploads_geojson_body_to_s3(self, mock_get_conn, mock_s3):
        mock_get_conn.return_value, _ = _mock_conn([_row()])
        mock_s3.generate_presigned_url.return_value = "https://example"

        export_reports({"format": "geojson"})

        put = mock_s3.put_object.call_args.kwargs
        assert put["ContentType"] == "application/geo+json"
        assert put["Key"].startswith("exports/")
        assert put["Key"].endswith(".geojson")
        body = json.loads(put["Body"].decode("utf-8"))
        assert body["type"] == "FeatureCollection"
        assert body["features"][0]["properties"]["damage_level"] == "partial"
        assert body["features"][0]["properties"]["photo_key"] == "uploads/abc.jpg"
        assert "photo_url" not in body["features"][0]["properties"]

    @patch("src.handlers.exports.s3")
    @patch("src.handlers.exports.get_connection")
    def test_uploads_csv_body_to_s3(self, mock_get_conn, mock_s3):
        mock_get_conn.return_value, _ = _mock_conn([_row()])
        mock_s3.generate_presigned_url.return_value = "https://example"

        export_reports({"format": "csv"})

        put = mock_s3.put_object.call_args.kwargs
        assert put["ContentType"] == "text/csv"
        assert put["Key"].endswith(".csv")
        body = put["Body"].decode("utf-8")
        lines = body.strip().split("\r\n")
        assert lines[0].split(",") == CSV_HEADER
        assert "uploads/abc.jpg" in lines[1]
        assert "partial" in lines[1]

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

    @patch("src.handlers.exports.s3")
    @patch("src.handlers.exports.get_connection")
    def test_query_caps_at_ceiling(self, mock_get_conn, mock_s3):
        mock_conn, mock_cursor = _mock_conn([])
        mock_get_conn.return_value = mock_conn
        mock_s3.generate_presigned_url.return_value = "x"

        export_reports({"format": "csv"})

        # LIMIT is the last bound param
        params = mock_cursor.execute.call_args[0][1]
        assert params[-1] == 1_000_000

    @patch("src.handlers.exports.s3")
    @patch("src.handlers.exports.get_connection")
    def test_excludes_flagged_reports(self, mock_get_conn, mock_s3):
        mock_conn, mock_cursor = _mock_conn([])
        mock_get_conn.return_value = mock_conn
        mock_s3.generate_presigned_url.return_value = "x"

        export_reports({"format": "csv"})

        sql = mock_cursor.execute.call_args[0][0]
        assert "flag_status IS NULL" in sql


class TestSerializers:
    def test_csv_pipe_joins_list_fields(self):
        body = _to_csv([_row(crisis_nature=["Earthquake", "Flood"])])
        assert "Earthquake|Flood" in body

    def test_csv_serialises_booleans_and_nulls(self):
        body = _to_csv([_row(debris_present=False, ai_confidence=None)])
        row = body.strip().split("\r\n")[1]
        cells = row.split(",")
        # debris_present is at index 10
        assert cells[10] == "false"

    def test_geojson_strips_photo_url_and_thumbnail_url(self):
        body = json.loads(_to_geojson([_row()]))
        props = body["features"][0]["properties"]
        assert "photo_url" not in props
        assert "thumbnail_url" not in props
        assert props["photo_key"] == "uploads/abc.jpg"

import uuid
from unittest.mock import MagicMock, patch

from src.handlers.reports import (
    ReportSubmission,
    _find_version_chain,
    create_report,
    query_coverage,
    query_reports,
)


def _valid_body(**overrides):
    base = {
        "latitude": 51.5074,
        "longitude": -0.1278,
        "building_id": "u10k7d2q",
        "damage_level": "partial",
        "infrastructure_type": ["Residential Infrastructure (Houses and apartments)"],
        "crisis_nature": ["Earthquake"],
        "debris_present": True,
        "electricity_status": "Minor damage (service disruptions but quickly repairable)",
        "health_status": "Partially functional",
        "pressing_needs": ["Food assistance and safe drinking water"],
    }
    base.update(overrides)
    return base


class TestReportSubmissionValidation:
    def test_valid_submission(self):
        sub = ReportSubmission(**_valid_body())
        assert sub.damage_level == "partial"
        assert len(sub.infrastructure_type) == 1

    def test_invalid_damage_level(self):
        import pytest
        with pytest.raises(Exception):
            ReportSubmission(**_valid_body(damage_level="severe"))

    def test_invalid_latitude(self):
        import pytest
        with pytest.raises(Exception):
            ReportSubmission(**_valid_body(latitude=91))

    def test_invalid_longitude(self):
        import pytest
        with pytest.raises(Exception):
            ReportSubmission(**_valid_body(longitude=181))

    def test_empty_infrastructure_type(self):
        import pytest
        with pytest.raises(Exception):
            ReportSubmission(**_valid_body(infrastructure_type=[]))

    def test_empty_crisis_nature(self):
        import pytest
        with pytest.raises(Exception):
            ReportSubmission(**_valid_body(crisis_nature=[]))

    def test_optional_fields_default_none(self):
        sub = ReportSubmission(**_valid_body())
        assert sub.photo_key is None
        assert sub.ai_damage_level is None
        assert sub.device_id is None
        assert sub.offline_queue_id is None

    def test_all_damage_levels_valid(self):
        for level in ["minimal", "partial", "complete"]:
            sub = ReportSubmission(**_valid_body(damage_level=level))
            assert sub.damage_level == level

    def test_infrastructure_description_too_long_rejected(self):
        import pytest
        with pytest.raises(Exception):
            ReportSubmission(**_valid_body(infrastructure_description="a" * 2001))

    def test_invalid_photo_key_pattern_rejected(self):
        import pytest
        with pytest.raises(Exception):
            ReportSubmission(**_valid_body(photo_key="../etc/passwd"))

    def test_offline_queue_id_with_special_chars_rejected(self):
        import pytest
        with pytest.raises(Exception):
            ReportSubmission(**_valid_body(offline_queue_id="abc; DROP TABLE reports;"))

    def test_ai_confidence_out_of_range_rejected(self):
        import pytest
        with pytest.raises(Exception):
            ReportSubmission(**_valid_body(ai_confidence=1.5))

    def test_too_many_infrastructure_types_rejected(self):
        import pytest
        with pytest.raises(Exception):
            ReportSubmission(**_valid_body(infrastructure_type=["x"] * 11))


class TestCreateReport:
    @patch("src.handlers.reports.get_connection")
    def test_creates_report(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        # _find_version_chain (building lookup) → None (new chain)
        # duplicate building check → None (no reassessment)
        # duplicate location check → None (no duplicate)
        # area count → 1
        mock_cursor.fetchone.side_effect = [None, None, None, (1,)]
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = create_report(_valid_body())

        assert result["status"] == "created"
        assert "id" in result
        assert "area_report_count" in result
        assert "version_chain_id" in result
        mock_conn.commit.assert_called_once()

    @patch("src.handlers.reports.get_connection")
    def test_dedup_by_offline_queue_id(self, mock_get_conn):
        existing_id = str(uuid.uuid4())
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = (existing_id,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = create_report(_valid_body(offline_queue_id="offline-123"))

        assert result["status"] == "duplicate"
        assert result["id"] == existing_id

    @patch("src.handlers.reports.get_connection")
    def test_includes_photo_url_when_key_provided(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        # _find_version_chain (building lookup) → None (new chain)
        # duplicate building check → None (no reassessment)
        # duplicate location check → None (no duplicate)
        # area count → 1
        mock_cursor.fetchone.side_effect = [None, None, None, (1,)]
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        photo_key = "uploads/12345678-1234-1234-1234-123456789abc.jpg"
        result = create_report(_valid_body(photo_key=photo_key))

        assert result["status"] == "created"
        # Verify the INSERT was called with photo_url containing the key.
        # Named placeholders mean params is now a dict, not a tuple.
        insert_call = mock_cursor.execute.call_args_list[-2]
        params = insert_call[0][1]
        assert photo_key in params["photo_url"]


class TestQueryReports:
    @patch("src.handlers.reports.get_connection")
    def test_returns_geojson(self, mock_get_conn):
        from datetime import datetime, timezone
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            (
                "report-id-1", 36.16, 36.2,
                "u10k7d2q", "partial",
                None, None, None, None, None,
                ["Residential Infrastructure (Houses and apartments)"], None,
                ["Earthquake"], True, None,
                None, ["Food assistance and safe drinking water"],
                "chain-id-1", True,
                datetime(2026, 4, 17, tzinfo=timezone.utc),
                None, None,  # duplicate_status, related_report_id
                1,
                None,  # follow_up_responses
            )
        ]
        mock_cursor.fetchone.return_value = (1,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = query_reports({})

        assert result["type"] == "FeatureCollection"
        assert len(result["features"]) == 1
        assert result["total"] == 1
        feature = result["features"][0]
        assert feature["geometry"]["coordinates"] == [36.16, 36.2]
        assert feature["properties"]["damage_level"] == "partial"

    @patch("src.handlers.reports.get_connection")
    def test_empty_results(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = (0,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = query_reports({"west": "0", "south": "0", "east": "1", "north": "1"})

        assert result["type"] == "FeatureCollection"
        assert result["features"] == []
        assert result["total"] == 0

    @patch("src.handlers.reports.get_connection")
    def test_building_id_filter_includes_all_versions(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = (0,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        query_reports({"building_id": "test-building"})

        # Verify the main WHERE clause does not filter by is_latest
        sql = mock_cursor.execute.call_args_list[0][0][0]
        # The main WHERE is the last one (after the subquery)
        main_where = sql.split("WHERE")[-1].split("ORDER BY")[0]
        assert "is_latest = true" not in main_where
        assert "building_id = %s" in main_where

    def test_limit_over_1000_rejected(self):
        import pytest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            query_reports({"limit": "5000"})

    def test_non_numeric_limit_rejected(self):
        import pytest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            query_reports({"limit": "abc"})

    def test_invalid_h3_pattern_rejected(self):
        import pytest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            query_reports({"h3": "DROP TABLE reports"})

    def test_lat_out_of_range_rejected(self):
        import pytest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            query_reports({"north": "200"})

    @patch("src.handlers.reports.get_connection")
    def test_damage_level_filter(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = (0,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        query_reports({"damage_level": "partial,complete"})

        sql = mock_cursor.execute.call_args_list[0][0][0]
        main_where = sql.split("WHERE")[-1].split("ORDER BY")[0]
        assert "COALESCE(analyst_damage_level, damage_level) IN" in main_where
        params = mock_cursor.execute.call_args_list[0][0][1]
        assert "partial" in params
        assert "complete" in params

    @patch("src.handlers.reports.get_connection")
    def test_infrastructure_type_filter_pipe_separated(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = (0,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        query_reports({
            "infrastructure_type": "Residential Infrastructure (Houses and apartments)|Commercial Infrastructure (Markets, malls, shops, hotels, banks, industries, etc.)"
        })

        sql = mock_cursor.execute.call_args_list[0][0][0]
        main_where = sql.split("WHERE")[-1].split("ORDER BY")[0]
        assert "ANY(infrastructure_type)" in main_where
        params = mock_cursor.execute.call_args_list[0][0][1]
        assert "Residential Infrastructure (Houses and apartments)" in params
        assert "Commercial Infrastructure (Markets, malls, shops, hotels, banks, industries, etc.)" in params

    @patch("src.handlers.reports.get_connection")
    def test_crisis_nature_filter_pipe_separated(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = (0,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        query_reports({"crisis_nature": "Earthquake|Flood"})

        sql = mock_cursor.execute.call_args_list[0][0][0]
        main_where = sql.split("WHERE")[-1].split("ORDER BY")[0]
        assert "ANY(crisis_nature)" in main_where
        params = mock_cursor.execute.call_args_list[0][0][1]
        assert "Earthquake" in params
        assert "Flood" in params

    @patch("src.handlers.reports.get_connection")
    def test_date_range_filter(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = (0,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        query_reports({"from": "2026-04-10", "to": "2026-04-15"})

        sql = mock_cursor.execute.call_args_list[0][0][0]
        main_where = sql.split("WHERE")[-1].split("ORDER BY")[0]
        assert "submitted_at >=" in main_where
        assert "submitted_at <=" in main_where

    @patch("src.handlers.reports.get_connection")
    def test_h3_filter(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = (0,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        query_reports({"h3": "882da16751fffff"})

        sql = mock_cursor.execute.call_args_list[0][0][0]
        main_where = sql.split("WHERE")[-1].split("ORDER BY")[0]
        assert "h3_r8 = %s" in main_where

    @patch("src.handlers.reports.get_connection")
    def test_multiple_filters_combined(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = (0,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        query_reports({
            "damage_level": "complete",
            "crisis_nature": "Earthquake",
            "from": "2026-04-10",
        })

        sql = mock_cursor.execute.call_args_list[0][0][0]
        main_where = sql.split("WHERE")[-1].split("ORDER BY")[0]
        assert "COALESCE(analyst_damage_level, damage_level) IN" in main_where
        assert "ANY(crisis_nature)" in main_where
        assert "submitted_at >=" in main_where


class TestFindVersionChain:
    @patch("src.handlers.reports.get_connection")
    def test_matches_by_building_id(self, mock_get_conn):
        chain_id = str(uuid.uuid4())
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = (chain_id,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = _find_version_chain("u10k7d2q", "8a2a1072b59ffff")
        assert result == uuid.UUID(chain_id)

    @patch("src.handlers.reports.get_connection")
    def test_falls_back_to_h3_only_when_building_id_absent(self, mock_get_conn):
        chain_id = str(uuid.uuid4())
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.side_effect = [(chain_id,)]
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = _find_version_chain(None, "8a2a1072b59ffff")
        assert result == uuid.UUID(chain_id)

    @patch("src.handlers.reports.get_connection")
    def test_unknown_building_id_does_not_chain_via_h3(self, mock_get_conn):
        existing_chain = str(uuid.uuid4())
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.side_effect = [None, (existing_chain,)]
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = _find_version_chain("u10k7d2q", "8a2a1072b59ffff")
        assert result != uuid.UUID(existing_chain)

    @patch("src.handlers.reports.get_connection")
    def test_creates_new_chain_when_no_match(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = _find_version_chain(None, "8a2a1072b59ffff")
        assert isinstance(result, uuid.UUID)


class TestQueryCoverage:
    @patch("src.handlers.reports.get_connection")
    def test_returns_minimal_feature_collection(self, mock_get_conn):
        from datetime import datetime, timezone
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        # SELECT id, lng, lat, building_id, damage_level, submitted_at
        mock_cursor.fetchall.return_value = [
            (
                "report-id-1",
                36.16,
                36.2,
                "u10k7d2q",
                "partial",
                datetime(2026, 4, 17, tzinfo=timezone.utc),
            )
        ]
        mock_cursor.fetchone.return_value = (1,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = query_coverage({})

        assert result["type"] == "FeatureCollection"
        assert result["total"] == 1
        assert len(result["features"]) == 1
        feature = result["features"][0]
        assert feature["geometry"]["coordinates"] == [36.16, 36.2]
        props = feature["properties"]
        assert props["id"] == "report-id-1"
        assert props["building_id"] == "u10k7d2q"
        assert props["damage_level"] == "partial"
        assert props["submitted_at"] == "2026-04-17T00:00:00+00:00"

    @patch("src.handlers.reports.get_connection")
    def test_response_excludes_sensitive_fields(self, mock_get_conn):
        """Privacy regression — coverage must never leak detail fields."""
        from datetime import datetime, timezone
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            (
                "report-id-1", 36.16, 36.2, "u10k7d2q", "partial",
                datetime(2026, 4, 17, tzinfo=timezone.utc),
            )
        ]
        mock_cursor.fetchone.return_value = (1,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = query_coverage({})

        props = result["features"][0]["properties"]
        for forbidden in (
            "photo_url",
            "thumbnail_url",
            "infrastructure_description",
            "infrastructure_type",
            "crisis_nature",
            "ai_damage_level",
            "ai_infrastructure_type",
            "ai_confidence",
            "follow_up_responses",
            "electricity_status",
            "health_status",
            "pressing_needs",
            "debris_present",
        ):
            assert forbidden not in props, (
                f"coverage response leaked '{forbidden}'"
            )

        # SQL itself only selects the minimal columns.
        sql = mock_cursor.execute.call_args_list[0][0][0]
        for forbidden_col in (
            "photo_url",
            "infrastructure_description",
            "follow_up_responses",
            "ai_confidence",
        ):
            assert forbidden_col not in sql, (
                f"coverage SELECT included '{forbidden_col}'"
            )

    @patch("src.handlers.reports.get_connection")
    def test_empty_results(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = (0,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = query_coverage(
            {"west": "0", "south": "0", "east": "1", "north": "1"}
        )

        assert result["type"] == "FeatureCollection"
        assert result["features"] == []
        assert result["total"] == 0

    @patch("src.handlers.reports.get_connection")
    def test_filters_apply(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = (0,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        query_coverage({"h3": "882da16601fffff", "damage_level": "complete"})

        sql = mock_cursor.execute.call_args_list[0][0][0]
        where = sql.split("WHERE")[-1].split("ORDER BY")[0]
        assert "h3_r8 = %s" in where
        assert "COALESCE(analyst_damage_level, damage_level) IN" in where

    @patch("src.handlers.reports.get_connection")
    def test_building_id_returns_all_versions(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = (0,)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        query_coverage({"building_id": "u10k7d2q"})

        sql = mock_cursor.execute.call_args_list[0][0][0]
        main_where = sql.split("WHERE")[-1].split("ORDER BY")[0]
        assert "is_latest = true" not in main_where
        assert "building_id = %s" in main_where

    def test_limit_over_1000_rejected(self):
        import pytest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            query_coverage({"limit": "5000"})

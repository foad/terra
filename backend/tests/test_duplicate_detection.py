import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from src.handlers.reports import create_report


def _valid_body(**overrides):
    base = {
        "latitude": 51.5074,
        "longitude": -0.1278,
        "building_id": None,
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


class TestDuplicateDetection:
    """Test duplicate and reassessment detection logic."""

    @patch("src.handlers.reports.get_connection")
    def test_same_location_and_recent_time_flagged_as_duplicate(self, mock_get_conn):
        """
        Report A: submitted at T=0, lat=51.5074, lng=-0.1278
        Report B: submitted at T=30 seconds, same location
        Expected: Report B flagged as "possible_duplicate" with related_report_id = A
        """
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        # building_id is None so building check is skipped
        # _find_version_chain (h3 lookup) → None (new chain)
        # location/time check → Report A
        # area count → 1
        mock_cursor.fetchone.side_effect = [None, ("report-a-id",), (1,)]

        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = create_report(_valid_body())

        assert result["status"] == "created"
        assert result["duplicate_status"] == "possible_duplicate"
        assert result["related_report_id"] == "report-a-id"

    @patch("src.handlers.reports.get_connection")
    def test_same_building_flagged_as_reassessment(self, mock_get_conn):
        """
        Report A: submitted for building X
        Report B: submitted for same building X
        Expected: Report B flagged as "reassessment" with related_report_id = A
        """
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        # _find_version_chain (building lookup) → None (new chain)
        # building check → Report A (reassessment, returns immediately)
        # area count → 1
        mock_cursor.fetchone.side_effect = [None, ("report-a-id",), (1,)]

        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = create_report(_valid_body(building_id="building-123"))

        assert result["status"] == "created"
        assert result["duplicate_status"] == "reassessment"
        assert result["related_report_id"] == "report-a-id"

    @patch("src.handlers.reports.get_connection")
    def test_reassessment_overrides_duplicate(self, mock_get_conn):
        """
        Report A: submitted for building X at location L, time T=0
        Report B: submitted for same building X, same location L, time T=30s
        Expected: Report B flagged as "reassessment" (building_id match takes precedence)
        """
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        # _find_version_chain (building lookup) → None (new chain)
        # building check → Report A (reassessment, returns immediately — location check skipped)
        # area count → 1
        mock_cursor.fetchone.side_effect = [None, ("report-a-id",), (1,)]

        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = create_report(
            _valid_body(building_id="building-123", latitude=51.5074, longitude=-0.1278)
        )

        assert result["status"] == "created"
        assert result["duplicate_status"] == "reassessment"
        assert result["related_report_id"] == "report-a-id"

    @patch("src.handlers.reports.get_connection")
    def test_different_location_no_flag(self, mock_get_conn):
        """
        Report A: submitted at location L1 (lat=51.5, lng=-0.1)
        Report B: submitted at different location L2 (lat=52.0, lng=0.0) - far away
        Expected: Report B has no duplicate_status
        """
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        # _find_version_chain (h3 lookup) → None (new chain)
        # location/time check → None (far enough away)
        # area count → 1
        mock_cursor.fetchone.side_effect = [None, None, (1,)]

        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = create_report(_valid_body(latitude=52.0, longitude=0.0))

        assert result["status"] == "created"
        assert result["duplicate_status"] is None
        assert result["related_report_id"] is None

    @patch("src.handlers.reports.get_connection")
    def test_outside_time_window_no_flag(self, mock_get_conn):
        """
        Report A: submitted at T=0 at location L
        Report B: submitted at T=150 seconds (2.5 minutes) at same location L
        Expected: Report B has no duplicate_status (outside 2-minute window)
        """
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        # _find_version_chain (h3 lookup) → None (new chain)
        # location/time check → None (outside time window)
        # area count → 1
        mock_cursor.fetchone.side_effect = [None, None, (1,)]

        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = create_report(_valid_body())

        assert result["status"] == "created"
        assert result["duplicate_status"] is None
        assert result["related_report_id"] is None

    @patch("src.handlers.reports.get_connection")
    def test_outside_distance_threshold_no_flag(self, mock_get_conn):
        """
        Report A: submitted at location L (lat=51.5074, lng=-0.1278)
        Report B: submitted at T=30 seconds, but ~50m away
        Expected: Report B has no duplicate_status (outside 15m radius)
        """
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        # _find_version_chain (h3 lookup) → None (new chain)
        # location/time check → None (outside distance threshold)
        # area count → 1
        mock_cursor.fetchone.side_effect = [None, None, (1,)]

        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = create_report(
            _valid_body(latitude=51.5074 + 0.0005, longitude=-0.1278 + 0.0005)  # ~50m away
        )

        assert result["status"] == "created"
        assert result["duplicate_status"] is None
        assert result["related_report_id"] is None

    @patch("src.handlers.reports.get_connection")
    def test_no_building_id_still_checks_location(self, mock_get_conn):
        """
        Report A: manual pin (building_id=None) at location L, time T=0
        Report B: manual pin (building_id=None) at same location L, time T=30s
        Expected: Report B flagged as "possible_duplicate" (location/time check applies)
        """
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        # _find_version_chain (h3 lookup) → None (new chain)
        # location/time check → Report A
        # area count → 1
        mock_cursor.fetchone.side_effect = [None, ("report-a-id",), (1,)]

        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = create_report(_valid_body(building_id=None))

        assert result["status"] == "created"
        assert result["duplicate_status"] == "possible_duplicate"
        assert result["related_report_id"] == "report-a-id"

    @patch("src.handlers.reports.get_connection")
    def test_duplicate_fields_in_api_response(self, mock_get_conn):
        """
        Verify that duplicate_status and related_report_id are included in API response.
        """
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        # _find_version_chain (building lookup) → None (new chain)
        # building check → Report A (reassessment)
        # area count → 5
        mock_cursor.fetchone.side_effect = [None, ("report-a-id",), (5,)]

        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = create_report(_valid_body(building_id="building-x"))

        assert "duplicate_status" in result
        assert "related_report_id" in result
        assert result["duplicate_status"] == "reassessment"
        assert result["related_report_id"] == "report-a-id"

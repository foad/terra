from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from src.handlers.crisis_events import get_active_crisis, list_active_crises


class TestGetActiveCrisis:
    @patch("src.handlers.crisis_events.get_connection")
    def test_returns_match(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = ("crisis-id-1", "Kent Floods 2026", "Flood")
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = get_active_crisis({"lat": "51.4", "lng": "0.5"})

        assert result == {
            "id": "crisis-id-1",
            "name": "Kent Floods 2026",
            "crisis_type": "Flood",
        }

    @patch("src.handlers.crisis_events.get_connection")
    def test_returns_none_when_no_match(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = get_active_crisis({"lat": "51.4", "lng": "0.5"})

        assert result is None

    @patch("src.handlers.crisis_events.get_connection")
    def test_passes_lat_lng_in_makepoint_order(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        get_active_crisis({"lat": "51.4", "lng": "0.5"})

        call_args = mock_cursor.execute.call_args
        assert call_args[0][1] == (0.5, 51.4)

    def test_missing_lat_rejected(self):
        with pytest.raises(ValidationError):
            get_active_crisis({"lng": "0.5"})

    def test_lat_out_of_range_rejected(self):
        with pytest.raises(ValidationError):
            get_active_crisis({"lat": "100", "lng": "0.5"})

    def test_lng_out_of_range_rejected(self):
        with pytest.raises(ValidationError):
            get_active_crisis({"lat": "51.4", "lng": "200"})

    def test_filters_by_is_active_and_st_contains(self):
        with patch("src.handlers.crisis_events.get_connection") as mock_get_conn:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchone.return_value = None
            mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
            mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
            mock_get_conn.return_value = mock_conn

            get_active_crisis({"lat": "51.4", "lng": "0.5"})

            sql = mock_cursor.execute.call_args[0][0]
            assert "is_active = true" in sql
            assert "ST_Contains" in sql


class TestListActiveCrises:
    @patch("src.handlers.crisis_events.get_connection")
    def test_returns_events_with_parsed_bbox(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            (
                "id-1",
                "Kent Floods 2026",
                "Flood",
                '{"type":"Polygon","coordinates":[[[-1,50.5],[1.5,50.5],[1.5,51.7],[-1,51.7],[-1,50.5]]]}',
            ),
        ]
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = list_active_crises()

        assert result == {
            "events": [
                {
                    "id": "id-1",
                    "name": "Kent Floods 2026",
                    "crisis_type": "Flood",
                    "region_bbox": {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [-1, 50.5],
                                [1.5, 50.5],
                                [1.5, 51.7],
                                [-1, 51.7],
                                [-1, 50.5],
                            ]
                        ],
                    },
                }
            ]
        }

    @patch("src.handlers.crisis_events.get_connection")
    def test_empty_list_when_none_active(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        assert list_active_crises() == {"events": []}

    @patch("src.handlers.crisis_events.get_connection")
    def test_filters_by_is_active_and_non_null_bbox(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        list_active_crises()

        sql = mock_cursor.execute.call_args[0][0]
        assert "is_active = true" in sql
        assert "region_bbox IS NOT NULL" in sql
        assert "ST_AsGeoJSON" in sql

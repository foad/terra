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
                True,
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
                    "region": {
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
                    "is_active": True,
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
    def test_filters_by_non_null_region(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        list_active_crises()

        sql = mock_cursor.execute.call_args[0][0]
        assert "region IS NOT NULL" in sql
        assert "ST_AsGeoJSON" in sql


_VALID_POLYGON = {
    "type": "Polygon",
    "coordinates": [
        [[-1, 50.5], [1.5, 50.5], [1.5, 51.7], [-1, 51.7], [-1, 50.5]],
    ],
}


def _mock_conn_for_write(rowcount: int = 1):
    from src.handlers import crisis_events as ce

    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.rowcount = rowcount
    mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return mock_conn, mock_cursor, ce


class TestCreateCrisis:
    @patch("src.handlers.crisis_events.get_connection")
    def test_creates_event(self, mock_get_conn):
        mock_conn, _, ce = _mock_conn_for_write()
        mock_get_conn.return_value = mock_conn

        result = ce.create_crisis(
            {
                "name": "Test Event",
                "crisis_type": "Flood",
                "region": _VALID_POLYGON,
            }
        )

        assert "id" in result
        mock_conn.commit.assert_called_once()

    def test_rejects_unknown_crisis_type(self):
        from src.handlers.crisis_events import create_crisis

        with pytest.raises(ValueError, match="crisis_type"):
            create_crisis(
                {
                    "name": "Test",
                    "crisis_type": "Asteroid",
                    "region": _VALID_POLYGON,
                }
            )

    def test_rejects_non_polygon_region(self):
        from src.handlers.crisis_events import create_crisis

        with pytest.raises(ValueError, match="GeoJSON Polygon"):
            create_crisis(
                {
                    "name": "Test",
                    "crisis_type": "Flood",
                    "region": {"type": "Point", "coordinates": [0, 0]},
                }
            )

    def test_rejects_empty_name(self):
        from src.handlers.crisis_events import create_crisis

        with pytest.raises(ValidationError):
            create_crisis(
                {"name": "", "crisis_type": "Flood", "region": _VALID_POLYGON}
            )


class TestUpdateCrisis:
    @patch("src.handlers.crisis_events.get_connection")
    def test_updates_event(self, mock_get_conn):
        mock_conn, _, ce = _mock_conn_for_write(rowcount=1)
        mock_get_conn.return_value = mock_conn

        result = ce.update_crisis(
            "abc-123",
            {
                "name": "Renamed",
                "crisis_type": "Flood",
                "region": _VALID_POLYGON,
            },
        )

        assert result == {"id": "abc-123"}
        mock_conn.commit.assert_called_once()

    @patch("src.handlers.crisis_events.get_connection")
    def test_raises_not_found_when_no_rows(self, mock_get_conn):
        mock_conn, _, ce = _mock_conn_for_write(rowcount=0)
        mock_get_conn.return_value = mock_conn

        with pytest.raises(FileNotFoundError):
            ce.update_crisis(
                "missing",
                {
                    "name": "Test",
                    "crisis_type": "Flood",
                    "region": _VALID_POLYGON,
                },
            )


class TestDeleteCrisis:
    @patch("src.handlers.crisis_events.get_connection")
    def test_deletes_event(self, mock_get_conn):
        mock_conn, _, ce = _mock_conn_for_write(rowcount=1)
        mock_get_conn.return_value = mock_conn

        ce.delete_crisis("abc-123")
        mock_conn.commit.assert_called_once()

    @patch("src.handlers.crisis_events.get_connection")
    def test_raises_not_found_when_no_rows(self, mock_get_conn):
        mock_conn, _, ce = _mock_conn_for_write(rowcount=0)
        mock_get_conn.return_value = mock_conn

        with pytest.raises(FileNotFoundError):
            ce.delete_crisis("missing")

"""Tests for follow-up questions on crisis events and follow-up responses on reports."""
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from src.handlers.crisis_events import (
    CrisisEventInput,
    _validate_follow_up_questions,
    create_crisis,
    get_active_crisis,
)
from src.handlers.reports import ReportSubmission


VALID_QUESTION = {
    "id": "q1",
    "question": "Are roads passable?",
    "options": ["Yes", "Partially", "No"],
    "allow_other": False,
}


class TestFollowUpQuestionsValidation:
    def test_valid_questions_accepted(self):
        _validate_follow_up_questions([VALID_QUESTION])

    def test_empty_list_accepted(self):
        _validate_follow_up_questions([])

    def test_missing_id_raises(self):
        with pytest.raises(ValueError, match="id"):
            _validate_follow_up_questions([{**VALID_QUESTION, "id": ""}])

    def test_missing_question_text_raises(self):
        with pytest.raises(ValueError, match="question"):
            _validate_follow_up_questions([{**VALID_QUESTION, "question": ""}])

    def test_fewer_than_two_options_raises(self):
        with pytest.raises(ValueError, match="2 options"):
            _validate_follow_up_questions([{**VALID_QUESTION, "options": ["Only one"]}])

    def test_max_three_questions_enforced_by_model(self):
        four_questions = [
            {**VALID_QUESTION, "id": f"q{i}", "question": f"Q{i}?"}
            for i in range(4)
        ]
        with pytest.raises(ValidationError):
            CrisisEventInput(
                name="Test",
                crisis_type="Earthquake",
                region={"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]},
                follow_up_questions=four_questions,
            )

    def test_three_questions_accepted_by_model(self):
        three_questions = [
            {**VALID_QUESTION, "id": f"q{i}", "question": f"Q{i}?"}
            for i in range(3)
        ]
        payload = CrisisEventInput(
            name="Test",
            crisis_type="Earthquake",
            region={"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]},
            follow_up_questions=three_questions,
        )
        assert len(payload.follow_up_questions) == 3


class TestGetActiveCrisisReturnsFollowUpQuestions:
    @patch("src.handlers.crisis_events.get_connection")
    def test_returns_follow_up_questions(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = (
            "crisis-id-1",
            "Kent Floods",
            "Flood",
            [VALID_QUESTION],
        )
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = get_active_crisis({"lat": "51.4", "lng": "0.5"})

        assert result["follow_up_questions"] == [VALID_QUESTION]

    @patch("src.handlers.crisis_events.get_connection")
    def test_returns_empty_list_when_none_configured(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = ("crisis-id-1", "Kent Floods", "Flood", None)
        mock_conn.cursor.return_value.__enter__ = lambda _: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = get_active_crisis({"lat": "51.4", "lng": "0.5"})

        assert result["follow_up_questions"] == []


class TestReportSubmissionFollowUpResponses:
    def _base_payload(self, **overrides):
        base = {
            "latitude": 51.5,
            "longitude": -0.1,
            "damage_level": "partial",
            "infrastructure_type": ["residential"],
            "crisis_nature": ["Flood"],
            "offline_queue_id": "test-queue-id-1",
        }
        return {**base, **overrides}

    def test_follow_up_responses_accepted(self):
        payload = ReportSubmission(**self._base_payload(
            follow_up_responses={"q1": "Yes", "q2": "Partially open"}
        ))
        assert payload.follow_up_responses == {"q1": "Yes", "q2": "Partially open"}

    def test_null_follow_up_responses_accepted(self):
        payload = ReportSubmission(**self._base_payload())
        assert payload.follow_up_responses is None

    def test_empty_dict_follow_up_responses_accepted(self):
        payload = ReportSubmission(**self._base_payload(follow_up_responses={}))
        assert payload.follow_up_responses == {}

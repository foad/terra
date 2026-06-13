from unittest.mock import patch

from botocore.exceptions import ClientError

from src.handlers.pii_filter import (
    _apply_redactions,
    _validate_redactions,
    redact_pii,
)


def _bedrock_response(redactions: list) -> dict:
    return {
        "output": {
            "message": {
                "role": "assistant",
                "content": [
                    {
                        "toolUse": {
                            "toolUseId": "tool-1",
                            "name": "report_pii_redactions",
                            "input": {"redactions": redactions},
                        }
                    }
                ],
            }
        },
        "stopReason": "tool_use",
    }


class TestApplyRedactions:
    def test_single_redaction_replaced(self):
        text = "Call John Smith at the school"
        redactions = [{"text": "John Smith", "entity_type": "PERSON_NAME"}]
        assert _apply_redactions(text, redactions) == "Call [PERSON_NAME] at the school"

    def test_multiple_redactions(self):
        text = "Contact John at 555-1234"
        redactions = [
            {"text": "John", "entity_type": "PERSON_NAME"},
            {"text": "555-1234", "entity_type": "PHONE_NUMBER"},
        ]
        assert _apply_redactions(text, redactions) == "Contact [PERSON_NAME] at [PHONE_NUMBER]"

    def test_longest_substring_first_prevents_overlap(self):
        # If "John" is processed before "John Smith", we'd corrupt the full
        # name. Longest-first sort prevents this.
        text = "John Smith and John are both reported"
        redactions = [
            {"text": "John", "entity_type": "PERSON_NAME"},
            {"text": "John Smith", "entity_type": "PERSON_NAME"},
        ]
        result = _apply_redactions(text, redactions)
        assert result == "[PERSON_NAME] and [PERSON_NAME] are both reported"

    def test_entire_text_redacted(self):
        text = "john@example.com"
        redactions = [{"text": "john@example.com", "entity_type": "EMAIL_ADDRESS"}]
        assert _apply_redactions(text, redactions) == "[EMAIL_ADDRESS]"

    def test_no_redactions_returns_original(self):
        assert _apply_redactions("nothing here", []) == "nothing here"


class TestValidateRedactions:
    def test_valid_redactions_pass_through(self):
        text = "John Smith called"
        redactions = [{"text": "John Smith", "entity_type": "PERSON_NAME"}]
        assert _validate_redactions(redactions, text) == redactions

    def test_drops_text_not_in_input(self):
        # Defensive against model hallucination: if the returned substring
        # isn't actually in the input, drop it.
        text = "Some report text"
        redactions = [{"text": "Made Up Name", "entity_type": "PERSON_NAME"}]
        assert _validate_redactions(redactions, text) == []

    def test_drops_empty_text(self):
        redactions = [{"text": "", "entity_type": "PERSON_NAME"}]
        assert _validate_redactions(redactions, "anything") == []

    def test_drops_unknown_entity_type(self):
        text = "John Smith"
        redactions = [{"text": "John Smith", "entity_type": "MADE_UP_TYPE"}]
        assert _validate_redactions(redactions, text) == []

    def test_drops_missing_fields(self):
        text = "anything"
        assert _validate_redactions([{"text": "anything"}], text) == []
        assert _validate_redactions([{"entity_type": "PERSON_NAME"}], text) == []

    def test_drops_non_dict(self):
        assert _validate_redactions(["not-a-dict", None], "anything") == []

    def test_mixed_valid_and_invalid(self):
        text = "John called 555-1234"
        redactions = [
            {"text": "John", "entity_type": "PERSON_NAME"},  # valid
            {"text": "Fake Name", "entity_type": "PERSON_NAME"},  # not in text
            {"text": "555-1234", "entity_type": "PHONE_NUMBER"},  # valid
        ]
        assert len(_validate_redactions(redactions, text)) == 2


class TestRedactPii:
    def test_empty_text_returns_empty(self):
        assert redact_pii("") == ("", [])
        assert redact_pii("   ") == ("   ", [])

    @patch("src.handlers.pii_filter.bedrock")
    def test_no_pii_returns_original(self, mock_bedrock):
        mock_bedrock.converse.return_value = _bedrock_response([])
        text = "South wall collapsed, roof intact"
        assert redact_pii(text) == (text, [])

    @patch("src.handlers.pii_filter.bedrock")
    def test_detects_and_redacts_pii(self, mock_bedrock):
        text = "Owner is John Smith"
        mock_bedrock.converse.return_value = _bedrock_response([
            {"text": "John Smith", "entity_type": "PERSON_NAME"},
        ])
        redacted, entities = redact_pii(text)
        assert redacted == "Owner is [PERSON_NAME]"
        assert entities == ["PERSON_NAME"]

    @patch("src.handlers.pii_filter.bedrock")
    def test_bedrock_error_falls_through(self, mock_bedrock):
        mock_bedrock.converse.side_effect = ClientError(
            {"Error": {"Code": "ThrottlingException"}}, "Converse"
        )
        text = "Some description"
        # Failure must not block submission — return original text untouched.
        assert redact_pii(text) == (text, [])

    @patch("src.handlers.pii_filter.bedrock")
    def test_model_did_not_call_tool_falls_through(self, mock_bedrock):
        mock_bedrock.converse.return_value = {
            "output": {"message": {"role": "assistant", "content": [{"text": "ok"}]}},
            "stopReason": "end_turn",
        }
        text = "Some description"
        assert redact_pii(text) == (text, [])

    @patch("src.handlers.pii_filter.bedrock")
    def test_hallucinated_redactions_dropped(self, mock_bedrock):
        text = "Short text with no PII"
        mock_bedrock.converse.return_value = _bedrock_response([
            {"text": "Some Name That Is Not Here", "entity_type": "PERSON_NAME"},
        ])
        # Hallucinated span → not in text → dropped → original returned
        assert redact_pii(text) == (text, [])

    @patch("src.handlers.pii_filter.bedrock")
    def test_arabic_text(self, mock_bedrock):
        text = "الاتصال بـ أحمد علي"
        mock_bedrock.converse.return_value = _bedrock_response([
            {"text": "أحمد علي", "entity_type": "PERSON_NAME"},
        ])
        redacted, entities = redact_pii(text)
        assert redacted == "الاتصال بـ [PERSON_NAME]"
        assert entities == ["PERSON_NAME"]

    @patch("src.handlers.pii_filter.bedrock")
    def test_japanese_text(self, mock_bedrock):
        # Character-offset-based redaction was failing on multibyte scripts;
        # string-replace must handle Japanese without corruption.
        text = "管理人の田中健太、電話番号 090-1234-5678。"
        mock_bedrock.converse.return_value = _bedrock_response([
            {"text": "田中健太", "entity_type": "PERSON_NAME"},
            {"text": "090-1234-5678", "entity_type": "PHONE_NUMBER"},
        ])
        redacted, entities = redact_pii(text)
        assert redacted == "管理人の[PERSON_NAME]、電話番号 [PHONE_NUMBER]。"
        assert sorted(entities) == ["PERSON_NAME", "PHONE_NUMBER"]

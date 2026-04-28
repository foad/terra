import os
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from src.handlers.classify import (
    BedrockFailedError,
    BedrockThrottledError,
    classify_photo,
)

VALID_KEY = "uploads/12345678-1234-1234-1234-123456789abc.jpg"


def _s3_response(content_type: str = "image/jpeg", body: bytes = b"fake-image"):
    return {
        "Body": MagicMock(read=lambda: body),
        "ContentType": content_type,
    }


def _bedrock_tool_response(input_data: dict) -> dict:
    return {
        "output": {
            "message": {
                "role": "assistant",
                "content": [
                    {
                        "toolUse": {
                            "toolUseId": "tool-1",
                            "name": "submit_classification",
                            "input": input_data,
                        }
                    }
                ],
            }
        },
        "stopReason": "tool_use",
    }


VALID_INPUT = {
    "damage_level": "partial",
    "damage_confidence": 0.85,
    "infrastructure_type": ["residential"],
    "infrastructure_confidence": 0.92,
}


class TestClassifyPhoto:
    @patch("src.handlers.classify.bedrock")
    @patch("src.handlers.classify.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket"})
    def test_returns_classification(self, mock_s3, mock_bedrock):
        mock_s3.get_object.return_value = _s3_response()
        mock_bedrock.converse.return_value = _bedrock_tool_response(VALID_INPUT)

        result = classify_photo({"photo_key": VALID_KEY})

        assert result == VALID_INPUT

    @patch("src.handlers.classify.bedrock")
    @patch("src.handlers.classify.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket"})
    def test_passes_image_to_bedrock_in_correct_format(self, mock_s3, mock_bedrock):
        mock_s3.get_object.return_value = _s3_response(content_type="image/png", body=b"png-bytes")
        mock_bedrock.converse.return_value = _bedrock_tool_response(VALID_INPUT)

        classify_photo({"photo_key": "uploads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png"})

        call_args = mock_bedrock.converse.call_args
        message_content = call_args.kwargs["messages"][0]["content"]
        image_block = next(c for c in message_content if "image" in c)
        assert image_block["image"]["format"] == "png"
        assert image_block["image"]["source"]["bytes"] == b"png-bytes"

    @patch("src.handlers.classify.bedrock")
    @patch("src.handlers.classify.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket", "BEDROCK_MODEL_ID": "custom-model"})
    def test_uses_model_id_from_env(self, mock_s3, mock_bedrock):
        mock_s3.get_object.return_value = _s3_response()
        mock_bedrock.converse.return_value = _bedrock_tool_response(VALID_INPUT)

        classify_photo({"photo_key": VALID_KEY})

        assert mock_bedrock.converse.call_args.kwargs["modelId"] == "custom-model"

    def test_invalid_photo_key_format_raises_value_error(self):
        with pytest.raises(ValueError, match="Invalid request"):
            classify_photo({"photo_key": "not-a-valid-key.txt"})

    def test_missing_photo_key_raises_value_error(self):
        with pytest.raises(ValueError, match="Invalid request"):
            classify_photo({})

    @patch("src.handlers.classify.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket"})
    def test_photo_not_found_raises_file_not_found(self, mock_s3):
        mock_s3.get_object.side_effect = ClientError(
            error_response={"Error": {"Code": "NoSuchKey", "Message": "The specified key does not exist."}},
            operation_name="GetObject",
        )

        with pytest.raises(FileNotFoundError):
            classify_photo({"photo_key": VALID_KEY})

    @patch("src.handlers.classify.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket"})
    def test_unsupported_content_type_raises_value_error(self, mock_s3):
        mock_s3.get_object.return_value = _s3_response(content_type="image/heic")

        with pytest.raises(ValueError, match="Unsupported image type"):
            classify_photo({"photo_key": VALID_KEY})

    @patch("src.handlers.classify.bedrock")
    @patch("src.handlers.classify.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket"})
    def test_bedrock_throttling_raises_bedrock_throttled(self, mock_s3, mock_bedrock):
        mock_s3.get_object.return_value = _s3_response()
        mock_bedrock.converse.side_effect = ClientError(
            error_response={"Error": {"Code": "ThrottlingException", "Message": "Throttled"}},
            operation_name="Converse",
        )

        with pytest.raises(BedrockThrottledError):
            classify_photo({"photo_key": VALID_KEY})

    @patch("src.handlers.classify.bedrock")
    @patch("src.handlers.classify.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket"})
    def test_bedrock_other_error_raises_bedrock_failed(self, mock_s3, mock_bedrock):
        mock_s3.get_object.return_value = _s3_response()
        mock_bedrock.converse.side_effect = ClientError(
            error_response={"Error": {"Code": "ValidationException", "Message": "Bad input"}},
            operation_name="Converse",
        )

        with pytest.raises(BedrockFailedError):
            classify_photo({"photo_key": VALID_KEY})

    @patch("src.handlers.classify.bedrock")
    @patch("src.handlers.classify.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket"})
    def test_bedrock_returns_no_tool_use_raises_bedrock_failed(self, mock_s3, mock_bedrock):
        mock_s3.get_object.return_value = _s3_response()
        mock_bedrock.converse.return_value = {
            "output": {"message": {"role": "assistant", "content": [{"text": "I cannot classify."}]}},
            "stopReason": "end_turn",
        }

        with pytest.raises(BedrockFailedError, match="did not return a classification"):
            classify_photo({"photo_key": VALID_KEY})

    @patch("src.handlers.classify.bedrock")
    @patch("src.handlers.classify.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket"})
    def test_bedrock_returns_invalid_damage_level_raises_bedrock_failed(self, mock_s3, mock_bedrock):
        mock_s3.get_object.return_value = _s3_response()
        mock_bedrock.converse.return_value = _bedrock_tool_response(
            {**VALID_INPUT, "damage_level": "catastrophic"}
        )

        with pytest.raises(BedrockFailedError, match="Invalid classification structure"):
            classify_photo({"photo_key": VALID_KEY})

    @patch("src.handlers.classify.bedrock")
    @patch("src.handlers.classify.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket"})
    def test_bedrock_returns_empty_infrastructure_raises_bedrock_failed(self, mock_s3, mock_bedrock):
        mock_s3.get_object.return_value = _s3_response()
        mock_bedrock.converse.return_value = _bedrock_tool_response(
            {**VALID_INPUT, "infrastructure_type": []}
        )

        with pytest.raises(BedrockFailedError, match="Invalid classification structure"):
            classify_photo({"photo_key": VALID_KEY})

    @patch("src.handlers.classify.bedrock")
    @patch("src.handlers.classify.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket"})
    def test_uses_tool_choice_to_force_tool_use(self, mock_s3, mock_bedrock):
        mock_s3.get_object.return_value = _s3_response()
        mock_bedrock.converse.return_value = _bedrock_tool_response(VALID_INPUT)

        classify_photo({"photo_key": VALID_KEY})

        tool_config = mock_bedrock.converse.call_args.kwargs["toolConfig"]
        assert tool_config["toolChoice"] == {"tool": {"name": "submit_classification"}}
        assert len(tool_config["tools"]) == 1
        assert tool_config["tools"][0]["toolSpec"]["name"] == "submit_classification"

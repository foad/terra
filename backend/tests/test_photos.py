import os
from unittest.mock import patch

from src.handlers.photos import get_upload_url


class TestGetUploadUrl:
    @patch("src.handlers.photos.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket"})
    def test_returns_presigned_url_and_key(self, mock_s3):
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/presigned"

        result = get_upload_url()

        assert "photo_key" in result
        assert result["photo_key"].startswith("uploads/")
        assert result["photo_key"].endswith(".jpg")
        assert result["upload_url"] == "https://s3.example.com/presigned"

    @patch("src.handlers.photos.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket"})
    def test_presigned_url_called_with_correct_params(self, mock_s3):
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/presigned"

        result = get_upload_url()

        mock_s3.generate_presigned_url.assert_called_once_with(
            "put_object",
            Params={
                "Bucket": "test-bucket",
                "Key": result["photo_key"],
                "ContentType": "image/jpeg",
            },
            ExpiresIn=900,
        )

    @patch("src.handlers.photos.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket"})
    def test_generates_unique_keys(self, mock_s3):
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/presigned"

        result1 = get_upload_url()
        result2 = get_upload_url()

        assert result1["photo_key"] != result2["photo_key"]

    @patch("src.handlers.photos.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket"})
    def test_png_content_type(self, mock_s3):
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/presigned"

        result = get_upload_url({"content_type": "image/png"})

        assert result["photo_key"].endswith(".png")
        mock_s3.generate_presigned_url.assert_called_once_with(
            "put_object",
            Params={
                "Bucket": "test-bucket",
                "Key": result["photo_key"],
                "ContentType": "image/png",
            },
            ExpiresIn=900,
        )

    @patch("src.handlers.photos.s3")
    @patch.dict(os.environ, {"PHOTOS_BUCKET": "test-bucket"})
    def test_invalid_content_type_defaults_to_jpeg(self, mock_s3):
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/presigned"

        result = get_upload_url({"content_type": "application/pdf"})

        assert result["photo_key"].endswith(".jpg")

    def test_oversized_content_type_rejected(self):
        import pytest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            get_upload_url({"content_type": "x" * 100})

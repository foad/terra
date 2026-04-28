import io
from unittest.mock import MagicMock, patch

import piexif
from PIL import Image

from src.handlers.photo_processor import (
    PROCESSED_MARKER,
    _parse_gps,
    _thumbnail_key,
    process_photo,
)


def _make_jpeg(width: int = 600, height: int = 400, exif_bytes: bytes | None = None) -> bytes:
    img = Image.new("RGB", (width, height), color=(120, 120, 120))
    buf = io.BytesIO()
    if exif_bytes is not None:
        img.save(buf, format="JPEG", exif=exif_bytes)
    else:
        img.save(buf, format="JPEG")
    return buf.getvalue()


def _make_jpeg_with_gps(lat: float, lon: float) -> bytes:
    def to_dms(value: float) -> tuple[tuple[int, int], tuple[int, int], tuple[int, int]]:
        absval = abs(value)
        deg = int(absval)
        minutes_full = (absval - deg) * 60
        minutes = int(minutes_full)
        seconds = round((minutes_full - minutes) * 60 * 100)
        return ((deg, 1), (minutes, 1), (seconds, 100))

    gps = {
        piexif.GPSIFD.GPSLatitudeRef: b"N" if lat >= 0 else b"S",
        piexif.GPSIFD.GPSLatitude: to_dms(lat),
        piexif.GPSIFD.GPSLongitudeRef: b"E" if lon >= 0 else b"W",
        piexif.GPSIFD.GPSLongitude: to_dms(lon),
    }
    exif = {"GPS": gps, "0th": {}, "Exif": {}, "1st": {}, "thumbnail": None}
    return _make_jpeg(exif_bytes=piexif.dump(exif))


def _s3_get_response(body: bytes, content_type: str = "image/jpeg", metadata: dict | None = None):
    return {
        "Body": MagicMock(read=lambda: body),
        "ContentType": content_type,
        "Metadata": metadata or {},
    }


class TestThumbnailKey:
    def test_jpg_to_jpg(self):
        assert _thumbnail_key("uploads/abc.jpg") == "thumbnails/abc.jpg"

    def test_png_to_jpg(self):
        assert _thumbnail_key("uploads/abc.png") == "thumbnails/abc.jpg"

    def test_uuid_with_dots(self):
        assert _thumbnail_key("uploads/123e4567-e89b.webp") == "thumbnails/123e4567-e89b.jpg"


class TestParseGps:
    def test_north_east_decimal(self):
        gps_ifd = {1: "N", 2: (51.0, 30.0, 0.0), 3: "E", 4: (0.0, 7.0, 0.0)}
        result = _parse_gps(gps_ifd)
        assert result is not None
        assert abs(result[0] - 51.5) < 1e-6
        assert abs(result[1] - (7 / 60)) < 1e-6

    def test_south_west_negative(self):
        gps_ifd = {1: "S", 2: (33.0, 51.0, 0.0), 3: "W", 4: (151.0, 12.0, 0.0)}
        result = _parse_gps(gps_ifd)
        assert result is not None
        assert result[0] < 0
        assert result[1] < 0

    def test_missing_keys_returns_none(self):
        assert _parse_gps({1: "N"}) is None


class TestProcessPhoto:
    @patch("src.handlers.photo_processor.s3")
    def test_skips_non_uploads_key(self, mock_s3):
        process_photo("bucket", "thumbnails/foo.jpg")
        mock_s3.get_object.assert_not_called()

    @patch("src.handlers.photo_processor.s3")
    def test_skips_already_processed(self, mock_s3):
        mock_s3.get_object.return_value = _s3_get_response(
            _make_jpeg(),
            metadata={"processed": PROCESSED_MARKER},
        )
        process_photo("bucket", "uploads/abc.jpg")
        mock_s3.put_object.assert_not_called()

    @patch("src.handlers.photo_processor.s3")
    def test_writes_thumbnail(self, mock_s3):
        mock_s3.get_object.return_value = _s3_get_response(_make_jpeg())
        process_photo("bucket", "uploads/abc.jpg")

        thumb_call = next(
            c for c in mock_s3.put_object.call_args_list if c.kwargs["Key"] == "thumbnails/abc.jpg"
        )
        assert thumb_call.kwargs["ContentType"] == "image/jpeg"
        thumb_img = Image.open(io.BytesIO(thumb_call.kwargs["Body"]))
        assert max(thumb_img.size) <= 300

    @patch("src.handlers.photo_processor.s3")
    def test_strips_exif_and_marks_processed(self, mock_s3):
        original = _make_jpeg_with_gps(51.5, 7 / 60)
        mock_s3.get_object.return_value = _s3_get_response(original)

        process_photo("bucket", "uploads/abc.jpg")

        upload_call = next(
            c for c in mock_s3.put_object.call_args_list if c.kwargs["Key"] == "uploads/abc.jpg"
        )
        assert upload_call.kwargs["Metadata"]["processed"] == PROCESSED_MARKER

        # The re-uploaded body must not retain EXIF data.
        rewritten = Image.open(io.BytesIO(upload_call.kwargs["Body"]))
        rewritten.load()
        exif = rewritten.getexif()
        assert dict(exif) == {} or len(exif) == 0

    @patch("src.handlers.photo_processor.s3")
    def test_persists_exif_gps_as_metadata(self, mock_s3):
        original = _make_jpeg_with_gps(lat=51.5, lon=-0.12)
        mock_s3.get_object.return_value = _s3_get_response(original)

        process_photo("bucket", "uploads/abc.jpg")

        upload_call = next(
            c for c in mock_s3.put_object.call_args_list if c.kwargs["Key"] == "uploads/abc.jpg"
        )
        meta = upload_call.kwargs["Metadata"]
        assert "exif-latitude" in meta
        assert "exif-longitude" in meta
        assert abs(float(meta["exif-latitude"]) - 51.5) < 0.01
        assert abs(float(meta["exif-longitude"]) - -0.12) < 0.01

    @patch("src.handlers.photo_processor.s3")
    def test_no_gps_metadata_when_exif_absent(self, mock_s3):
        mock_s3.get_object.return_value = _s3_get_response(_make_jpeg())

        process_photo("bucket", "uploads/abc.jpg")

        upload_call = next(
            c for c in mock_s3.put_object.call_args_list if c.kwargs["Key"] == "uploads/abc.jpg"
        )
        meta = upload_call.kwargs["Metadata"]
        assert "exif-latitude" not in meta
        assert "exif-longitude" not in meta
        assert meta["processed"] == PROCESSED_MARKER

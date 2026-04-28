import io

import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from PIL import ExifTags, Image, ImageOps

logger = Logger()
s3 = boto3.client("s3")

UPLOADS_PREFIX = "uploads/"
THUMBNAILS_PREFIX = "thumbnails/"
THUMBNAIL_SIZE = (300, 300)
THUMBNAIL_QUALITY = 80
PROCESSED_MARKER = "true"

PIL_FORMAT_BY_CONTENT_TYPE = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}

GPS_INFO_TAG_ID = next(k for k, v in ExifTags.TAGS.items() if v == "GPSInfo")
GPS_TAGS_BY_ID = {v: k for k, v in ExifTags.GPSTAGS.items()}


@logger.inject_lambda_context
def handler(event: dict, _context: LambdaContext):
    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = record["s3"]["object"]["key"]
        try:
            process_photo(bucket, key)
        except Exception:
            logger.exception("photo processing failed", extra={"bucket": bucket, "key": key})
            # Don't re-raise — failing one record shouldn't block others.


def process_photo(bucket: str, key: str) -> None:
    if not key.startswith(UPLOADS_PREFIX):
        logger.debug("skipping non-uploads key", extra={"key": key})
        return

    obj = s3.get_object(Bucket=bucket, Key=key)
    metadata = obj.get("Metadata") or {}
    if metadata.get("processed") == PROCESSED_MARKER:
        logger.debug("already processed, skipping", extra={"key": key})
        return

    body = obj["Body"].read()
    content_type = obj.get("ContentType", "image/jpeg")
    pil_format = PIL_FORMAT_BY_CONTENT_TYPE.get(content_type, "JPEG")

    img = Image.open(io.BytesIO(body))
    img.load()
    # Bake EXIF orientation into pixels before stripping metadata, so photos
    # taken in portrait don't render sideways once their EXIF is gone.
    oriented = ImageOps.exif_transpose(img) or img

    # EXIF GPS — extract before stripping so the location signal is preserved
    # as S3 metadata for downstream use even after the bytes are sanitised.
    gps_metadata: dict[str, str] = {}
    exif = img.getexif() if hasattr(img, "getexif") else None
    if exif:
        gps_ifd = exif.get_ifd(GPS_INFO_TAG_ID) if GPS_INFO_TAG_ID in exif else None
        coords = _parse_gps(gps_ifd) if gps_ifd else None
        if coords is not None:
            gps_metadata["exif-latitude"] = str(coords[0])
            gps_metadata["exif-longitude"] = str(coords[1])

    # Thumbnail
    thumb_key = _thumbnail_key(key)
    thumb_buf = io.BytesIO()
    thumb = oriented.copy()
    if thumb.mode not in ("RGB", "L"):
        thumb = thumb.convert("RGB")
    thumb.thumbnail(THUMBNAIL_SIZE)
    thumb.save(thumb_buf, format="JPEG", quality=THUMBNAIL_QUALITY)
    s3.put_object(
        Bucket=bucket,
        Key=thumb_key,
        Body=thumb_buf.getvalue(),
        ContentType="image/jpeg",
    )

    # Strip EXIF by re-saving the orientation-corrected pixels without passing
    # the source Exif block. PIL drops EXIF/XMP/IPTC chunks unless explicitly
    # passed through.
    out_buf = io.BytesIO()
    save_kwargs: dict = {"format": pil_format}
    if pil_format == "JPEG":
        save_kwargs["quality"] = 90
    oriented.save(out_buf, **save_kwargs)

    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=out_buf.getvalue(),
        ContentType=content_type,
        Metadata={**gps_metadata, "processed": PROCESSED_MARKER},
    )

    logger.info(
        "photo processed",
        extra={
            "key": key,
            "thumbnail_key": thumb_key,
            "has_gps": bool(gps_metadata),
        },
    )


def _thumbnail_key(upload_key: str) -> str:
    """uploads/<uuid>.<ext> -> thumbnails/<uuid>.jpg"""
    rest = upload_key[len(UPLOADS_PREFIX):]
    stem = rest.rsplit(".", 1)[0]
    return f"{THUMBNAILS_PREFIX}{stem}.jpg"


def _parse_gps(gps_ifd: dict) -> tuple[float, float] | None:
    """Convert PIL GPSInfo IFD to decimal (lat, lon) — None if incomplete."""
    try:
        lat_ref = gps_ifd[GPS_TAGS_BY_ID["GPSLatitudeRef"]]
        lat = gps_ifd[GPS_TAGS_BY_ID["GPSLatitude"]]
        lon_ref = gps_ifd[GPS_TAGS_BY_ID["GPSLongitudeRef"]]
        lon = gps_ifd[GPS_TAGS_BY_ID["GPSLongitude"]]
    except KeyError:
        return None

    lat_decimal = _dms_to_decimal(lat) * (-1 if lat_ref in ("S", b"S") else 1)
    lon_decimal = _dms_to_decimal(lon) * (-1 if lon_ref in ("W", b"W") else 1)
    return lat_decimal, lon_decimal


def _dms_to_decimal(dms: tuple) -> float:
    """(degrees, minutes, seconds) — each may be float or PIL Rational — to decimal."""
    return float(dms[0]) + float(dms[1]) / 60 + float(dms[2]) / 3600

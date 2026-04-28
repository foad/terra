import os
import uuid

import boto3
from aws_lambda_powertools import Logger
from pydantic import BaseModel, Field

logger = Logger()
s3 = boto3.client("s3")

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class UploadRequest(BaseModel):
    content_type: str = Field(default="image/jpeg", max_length=64)


def get_upload_url(body: dict | None = None) -> dict:
    request = UploadRequest(**(body or {}))
    bucket = os.environ.get("PHOTOS_BUCKET", "")

    content_type = request.content_type
    if content_type not in ALLOWED_TYPES:
        content_type = "image/jpeg"

    ext = ALLOWED_TYPES[content_type]
    photo_key = f"uploads/{uuid.uuid4()}{ext}"
    presigned_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": bucket,
            "Key": photo_key,
            "ContentType": content_type,
        },
        ExpiresIn=900,
    )

    return {
        "photo_key": photo_key,
        "upload_url": presigned_url,
    }

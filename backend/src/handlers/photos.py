import os
import uuid
import boto3
from aws_lambda_powertools import Logger

logger = Logger()
s3 = boto3.client("s3")

def get_upload_url() -> dict:
    bucket = os.environ.get("PHOTOS_BUCKET", "")
    photo_key = f"uploads/{uuid.uuid4()}.jpg"
    presigned_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": bucket,
            "Key": photo_key,
            "ContentType": "image/jpeg",
        },
        ExpiresIn=900,
    )

    return {
        "photo_key": photo_key,
        "upload_url": presigned_url,
    }

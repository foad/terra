import os

import boto3
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError
from pydantic import BaseModel, Field, ValidationError

logger = Logger()
s3 = boto3.client("s3")
bedrock = boto3.client("bedrock-runtime")

DEFAULT_MODEL_ID = "anthropic.claude-haiku-4-5-20251001-v1:0"

DAMAGE_LEVELS = ["minimal", "partial", "complete"]
INFRASTRUCTURE_TYPES = [
    "residential",
    "commercial",
    "government",
    "utility",
    "transport",
    "community",
    "publicSpaces",
]
CONTENT_TYPE_TO_FORMAT = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
}

SYSTEM_PROMPT = """You are an expert damage assessor reviewing a photo of infrastructure after a
sudden-onset crisis (earthquake, flood, conflict, etc.) for the UN's RAPIDA methodology.

Examine the photo and call the submit_classification tool with your assessment.

Damage levels:
- minimal: Structurally sound and functional; only cosmetic or no visible damage.
- partial: Repairable; remains usable with caution.
- complete: Structurally unsafe or destroyed.

Infrastructure types (one or more may apply):
- residential: houses, apartments
- commercial: markets, shops, hotels, banks, industrial buildings
- government: administrative buildings, courthouses, police/fire stations
- utility: water pumps, power plants, waste treatment
- transport: roads, bridges, cell towers, railway/bus stations
- community: schools, hospitals, community halls, public toilets
- publicSpaces: stadiums, playgrounds, religious buildings

Confidence calibration — use the full 0.0-1.0 range based on what the photo actually
shows. Treat each axis (damage_level, infrastructure_type) independently, because
one can be obvious while the other is not.

- 0.90+ when the answer is visually unambiguous and the relevant features are clearly framed.
- 0.60-0.85 when the answer is visible but partially obscured, distant, taken at a poor angle, or shows only a fragment
- 0.30-0.55 when you are inferring from limited evidence (e.g. only a wall fragment is visible.
- Below 0.30 when the photo does not show what is being asked about, for example:
  - a portrait or face
  - an interior shot with no structural cues
  - a landscape with no buildings/structures
  - a blurred or empty image
  Pick the most plausible enum value but mark confidence accordingly low so the human reporter overrides.

Always call the tool — do not respond in plain text."""

CLASSIFY_TOOL = {
    "toolSpec": {
        "name": "submit_classification",
        "description": "Submit damage and infrastructure classification for the photo.",
        "inputSchema": {
            "json": {
                "type": "object",
                "properties": {
                    "damage_level": {"type": "string", "enum": DAMAGE_LEVELS},
                    "damage_confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    "infrastructure_type": {
                        "type": "array",
                        "items": {"type": "string", "enum": INFRASTRUCTURE_TYPES},
                        "minItems": 1,
                    },
                    "infrastructure_confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": [
                    "damage_level",
                    "damage_confidence",
                    "infrastructure_type",
                    "infrastructure_confidence",
                ],
            }
        },
    }
}


class ClassifyRequest(BaseModel):
    photo_key: str = Field(pattern=r"^uploads/[a-f0-9-]+\.(jpg|png|webp)$")


class BedrockThrottledError(Exception):
    pass


class BedrockFailedError(Exception):
    pass


def classify_photo(body: dict | None) -> dict:
    try:
        request = ClassifyRequest(**(body or {}))
    except ValidationError as e:
        raise ValueError(f"Invalid request: {e.errors()[0]['msg']}") from e

    bucket = os.environ.get("PHOTOS_BUCKET", "")

    try:
        obj = s3.get_object(Bucket=bucket, Key=request.photo_key)
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("NoSuchKey", "404"):
            raise FileNotFoundError(f"Photo not found: {request.photo_key}") from e
        raise

    photo_bytes = obj["Body"].read()
    content_type = obj.get("ContentType", "image/jpeg")
    image_format = CONTENT_TYPE_TO_FORMAT.get(content_type)
    if image_format is None:
        raise ValueError(f"Unsupported image type: {content_type}")

    model_id = os.environ.get("BEDROCK_MODEL_ID", DEFAULT_MODEL_ID)
    try:
        response = bedrock.converse(
            modelId=model_id,
            system=[{"text": SYSTEM_PROMPT}],
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"image": {"format": image_format, "source": {"bytes": photo_bytes}}},
                        {"text": "Classify the damage and infrastructure in this photo."},
                    ],
                }
            ],
            toolConfig={
                "tools": [CLASSIFY_TOOL],
                "toolChoice": {"tool": {"name": "submit_classification"}},
            },
        )
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code == "ThrottlingException":
            raise BedrockThrottledError() from e
        logger.exception("bedrock invoke failed")
        raise BedrockFailedError(f"Bedrock error: {code}") from e

    content = response.get("output", {}).get("message", {}).get("content", [])
    tool_use = next((c["toolUse"] for c in content if "toolUse" in c), None)
    if not tool_use or tool_use.get("name") != "submit_classification":
        logger.error("bedrock did not call tool", extra={"stop_reason": response.get("stopReason")})
        raise BedrockFailedError("Model did not return a classification")

    result = tool_use.get("input", {})
    if not _is_valid_classification(result):
        logger.error("bedrock returned invalid classification", extra={"input": result})
        raise BedrockFailedError("Invalid classification structure")

    logger.info("classification", extra={"input": result, "stop_reason": response.get("stopReason")})
    return result


def _is_valid_classification(data: dict) -> bool:
    if data.get("damage_level") not in DAMAGE_LEVELS:
        return False
    if not isinstance(data.get("damage_confidence"), (int, float)):
        return False
    infra = data.get("infrastructure_type")
    if not isinstance(infra, list) or not infra:
        return False
    if not all(t in INFRASTRUCTURE_TYPES for t in infra):
        return False
    if not isinstance(data.get("infrastructure_confidence"), (int, float)):
        return False
    return True

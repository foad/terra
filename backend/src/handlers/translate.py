import os

import boto3
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError

logger = Logger()
bedrock = boto3.client("bedrock-runtime")

DEFAULT_MODEL_ID = "anthropic.claude-haiku-4-5-20251001-v1:0"

SYSTEM_PROMPT = """You are a translation assistant for a community crisis-reporting app. Users submit free-text descriptions of infrastructure damage; the text may be in any language.

Call the report_translation tool with your result.

Rules:
- Detect whether the text is already written in English (including mixed English with only minor foreign words).
- If the text is English: set is_english to true and translation to null.
- If the text is not English: set is_english to false and provide the full English translation.

Translation guidelines:
- Translate faithfully; preserve the meaning and level of detail.
- Keep technical and damage-related terminology precise (e.g. "partial collapse", "structural crack", "debris blocking road").
- Preserve proper nouns — building names, place names, landmark references — exactly as written. Do not anglicise or translate them.
- Preserve redaction placeholders such as [PERSON_NAME] or [PHONE_NUMBER] verbatim. They are opaque tokens inserted by a prior processing step; do not translate or modify them.
- Do not add commentary, explanation, or metadata — output only the translated text.

Always call the tool — do not respond in plain text."""

TRANSLATION_TOOL = {
    "toolSpec": {
        "name": "report_translation",
        "description": "Report whether the text is already English, and provide a translation if not.",
        "inputSchema": {
            "json": {
                "type": "object",
                "properties": {
                    "is_english": {
                        "type": "boolean",
                        "description": "True if the input text is already written in English.",
                    },
                    "translation": {
                        "type": ["string", "null"],
                        "description": "English translation of the text, or null if the text is already English.",
                    },
                },
                "required": ["is_english", "translation"],
            },
        },
    }
}


def translate_to_english(text: str) -> str | None:
    """Return an English translation of text, or None if already English or on Bedrock failure.

    Fail-open: a Bedrock failure must not block legitimate submissions.
    """
    if not text or not text.strip():
        return None

    model_id = os.environ.get("BEDROCK_MODEL_ID", DEFAULT_MODEL_ID)
    try:
        response = bedrock.converse(
            modelId=model_id,
            system=[{"text": SYSTEM_PROMPT}],
            messages=[{"role": "user", "content": [{"text": text}]}],
            toolConfig={
                "tools": [TRANSLATION_TOOL],
                "toolChoice": {"tool": {"name": "report_translation"}},
            },
        )
    except ClientError:
        logger.exception("translation bedrock call failed")
        return None
    except Exception:
        logger.exception("translation unexpected error")
        return None

    content = response.get("output", {}).get("message", {}).get("content", [])
    tool_use = next((c["toolUse"] for c in content if "toolUse" in c), None)
    if not tool_use or tool_use.get("name") != "report_translation":
        logger.warning("translation model did not call tool")
        return None

    result = tool_use.get("input", {})
    if result.get("is_english"):
        return None

    translation = result.get("translation")
    if not isinstance(translation, str) or not translation.strip():
        logger.warning("translation model returned empty translation")
        return None

    return translation.strip()

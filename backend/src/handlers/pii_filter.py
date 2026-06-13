import os

import boto3
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError

logger = Logger()
bedrock = boto3.client("bedrock-runtime")

DEFAULT_MODEL_ID = "anthropic.claude-haiku-4-5-20251001-v1:0"

PII_ENTITY_TYPES = [
    "PERSON_NAME",
    "PHONE_NUMBER",
    "EMAIL_ADDRESS",
    "ID_NUMBER",
    "FINANCIAL_INFO",
    "OTHER_PII",
]

SYSTEM_PROMPT = """You identify personally identifiable information (PII) in user-submitted free
text from a community crisis-reporting app. The text may be in any language.

Call the report_pii_redactions tool with each PII span you find — copying the
EXACT substring as it appears in the input (character-for-character, including
spaces and punctuation) plus the entity type. Do not paraphrase, translate, or
adjust the substring. The redaction step is a literal string replacement.

PII to identify:
- PERSON_NAME: full or first+last names of specific individuals
- PHONE_NUMBER: telephone numbers in any format
- EMAIL_ADDRESS: email addresses
- ID_NUMBER: national ID, passport, driver licence numbers
- FINANCIAL_INFO: bank account numbers, credit cards, IBANs
- OTHER_PII: clear PII not covered above (e.g. social media handles)

Do NOT flag:
- Addresses or postal addresses — the location of damaged infrastructure is
  the intended content of this field
- Building names ("Al-Noor School", "City Hospital", "Hatay Bus Terminal")
- Landmark references ("near the central market", "behind the school")
- Generic role descriptions ("the imam", "the headmaster", "the caretaker")
- Vehicle make/model
- Damage descriptions
- Generic place names (cities, neighbourhoods)

If no PII is present, call the tool with an empty redactions array.
Always call the tool — do not respond in plain text."""

PII_TOOL = {
    "toolSpec": {
        "name": "report_pii_redactions",
        "description": "Report the exact substrings to redact and their entity types.",
        "inputSchema": {
            "json": {
                "type": "object",
                "properties": {
                    "redactions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "text": {
                                    "type": "string",
                                    "description": "The exact substring from the input, copied verbatim.",
                                },
                                "entity_type": {"type": "string", "enum": PII_ENTITY_TYPES},
                            },
                            "required": ["text", "entity_type"],
                        },
                    },
                },
                "required": ["redactions"],
            },
        },
    }
}


def redact_pii(text: str) -> tuple[str, list[str]]:
    """Return (redacted_text, entity_types_found).

    Falls back to (text, []) on Bedrock failure — PII filter unavailability
    must not block legitimate submissions.
    """
    if not text or not text.strip():
        return text, []

    redactions = _detect_pii_redactions(text)
    if not redactions:
        return text, []

    return _apply_redactions(text, redactions), [r["entity_type"] for r in redactions]


def _detect_pii_redactions(text: str) -> list[dict]:
    model_id = os.environ.get("BEDROCK_MODEL_ID", DEFAULT_MODEL_ID)
    try:
        response = bedrock.converse(
            modelId=model_id,
            system=[{"text": SYSTEM_PROMPT}],
            messages=[{"role": "user", "content": [{"text": text}]}],
            toolConfig={
                "tools": [PII_TOOL],
                "toolChoice": {"tool": {"name": "report_pii_redactions"}},
            },
        )
    except ClientError:
        logger.exception("pii detection bedrock call failed")
        return []
    except Exception:
        logger.exception("pii detection unexpected error")
        return []

    content = response.get("output", {}).get("message", {}).get("content", [])
    tool_use = next((c["toolUse"] for c in content if "toolUse" in c), None)
    if not tool_use or tool_use.get("name") != "report_pii_redactions":
        logger.warning("pii detection model did not call tool")
        return []

    raw = tool_use.get("input", {}).get("redactions", [])
    return _validate_redactions(raw, text)


def _validate_redactions(redactions: list, text: str) -> list[dict]:
    valid = []
    for r in redactions:
        if not isinstance(r, dict):
            continue
        pii_text = r.get("text")
        entity = r.get("entity_type")
        if not isinstance(pii_text, str) or not pii_text:
            continue
        if entity not in PII_ENTITY_TYPES:
            continue
        # Drop hallucinated spans — the model occasionally returns text that
        # isn't actually in the input. str.replace would no-op anyway, but
        # filtering here keeps the returned entity_types accurate.
        if pii_text not in text:
            continue
        valid.append({"text": pii_text, "entity_type": entity})
    return valid


def _apply_redactions(text: str, redactions: list[dict]) -> str:
    # Apply longest substrings first so a shorter PII span that's a substring
    # of a longer one (e.g. "John" inside "John Smith") doesn't over-redact.
    sorted_redactions = sorted(redactions, key=lambda r: len(r["text"]), reverse=True)
    result = text
    for r in sorted_redactions:
        result = result.replace(r["text"], f"[{r['entity_type']}]")
    return result

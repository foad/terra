from typing import Any


def get_user_id(event: Any) -> str | None:
    """Return the Cognito user sub from a JWT-authorized event, or None"""
    request_context = getattr(event, "request_context", None) or {}
    if hasattr(request_context, "get"):
        ctx = request_context
    else:
        ctx = getattr(request_context, "raw_event", {}) or {}
    authorizer = ctx.get("authorizer", {}) if isinstance(ctx, dict) else {}
    claims = authorizer.get("jwt", {}).get("claims", {}) if isinstance(authorizer, dict) else {}
    sub = claims.get("sub") if isinstance(claims, dict) else None
    return sub if isinstance(sub, str) and sub else None

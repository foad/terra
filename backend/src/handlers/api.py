import json

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver, Response
from aws_lambda_powertools.event_handler.exceptions import (
    BadRequestError,
    NotFoundError,
    ServiceError,
)
from aws_lambda_powertools.logging import correlation_paths
from pydantic import ValidationError

from src.handlers.classify import BedrockFailedError, BedrockThrottledError, classify_photo
from src.handlers.crisis_events import get_active_crisis
from src.handlers.exports import export_reports
from src.handlers.photos import get_upload_url
from src.handlers.reports import create_report, query_reports

logger = Logger()
tracer = Tracer()

# CORS is configured at the API Gateway level (see infra/api_gateway.tf) — the
# gateway handles preflight and adds response headers, so no Lambda-side CORS
# config is needed.
app = APIGatewayHttpResolver()

MAX_BODY_BYTES = 32 * 1024  # 32 KiB — JSON-only API; photos go straight to S3.


@app.get("/health")
@tracer.capture_method
def health():
    return {"status": "ok"}


@app.post("/photos/upload")
@tracer.capture_method
def post_photo_upload():
    body = app.current_event.json_body if app.current_event.body else None
    try:
        return get_upload_url(body)
    except ValidationError as e:
        raise BadRequestError(_first_validation_message(e)) from e


@app.post("/photos/classify")
@tracer.capture_method
def post_photo_classify():
    body = app.current_event.json_body if app.current_event.body else None
    try:
        return classify_photo(body)
    except ValueError as e:
        raise BadRequestError(str(e)) from e
    except FileNotFoundError as e:
        raise NotFoundError(str(e)) from e
    except BedrockThrottledError as e:
        raise ServiceError(503, "Classifier temporarily unavailable") from e
    except BedrockFailedError as e:
        raise ServiceError(502, str(e)) from e


@app.get("/reports")
@tracer.capture_method
def get_reports():
    params = app.current_event.query_string_parameters or {}
    try:
        return query_reports(params)
    except ValidationError as e:
        raise BadRequestError(_first_validation_message(e)) from e


@app.get("/reports/export")
@tracer.capture_method
def get_reports_export():
    params = app.current_event.query_string_parameters or {}
    try:
        body, content_type, filename = export_reports(params)
    except ValidationError as e:
        raise BadRequestError(_first_validation_message(e)) from e
    return Response(
        status_code=200,
        content_type=content_type,
        body=body,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/crisis-events/active")
@tracer.capture_method
def get_active_crisis_event():
    params = app.current_event.query_string_parameters or {}
    try:
        result = get_active_crisis(params)
    except ValidationError as e:
        raise BadRequestError(_first_validation_message(e)) from e
    if result is None:
        raise NotFoundError("No active crisis event at this location")
    return result


@app.post("/reports")
@tracer.capture_method
def post_report():
    body = app.current_event.json_body
    try:
        return create_report(body)
    except ValidationError as e:
        raise BadRequestError(_first_validation_message(e)) from e


@app.exception_handler(Exception)
def handle_unhandled(exc: Exception):
    """Catch-all so opaque AWS internal errors never reach the client."""
    request_id = getattr(app.current_event.request_context, "request_id", None)
    logger.exception("unhandled exception", extra={"request_id": request_id})
    return {
        "statusCode": 500,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"error": "Internal server error", "request_id": request_id}),
    }


def _first_validation_message(err: ValidationError) -> str:
    errors = err.errors()
    if not errors:
        return "Invalid request"
    first = errors[0]
    loc = ".".join(str(p) for p in first.get("loc", []))
    msg = first.get("msg", "Invalid")
    return f"{loc}: {msg}" if loc else msg


@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_HTTP)
@tracer.capture_lambda_handler
def handler(event, context):
    body = event.get("body") or ""
    if isinstance(body, str) and len(body.encode("utf-8")) > MAX_BODY_BYTES:
        return {
            "statusCode": 413,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Request body too large"}),
        }
    return app.resolve(event, context)

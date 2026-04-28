from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver
from aws_lambda_powertools.event_handler.api_gateway import CORSConfig
from aws_lambda_powertools.event_handler.exceptions import (
    BadRequestError,
    NotFoundError,
    ServiceError,
)
from aws_lambda_powertools.logging import correlation_paths

from src.handlers.classify import BedrockFailedError, BedrockThrottledError, classify_photo
from src.handlers.photos import get_upload_url
from src.handlers.reports import create_report, query_reports

logger = Logger()
tracer = Tracer()
cors = CORSConfig(allow_origin="*", max_age=3600)
app = APIGatewayHttpResolver(cors=cors)


@app.get("/health")
@tracer.capture_method
def health():
    return {"status": "ok"}


@app.post("/photos/upload")
@tracer.capture_method
def post_photo_upload():
    body = app.current_event.json_body if app.current_event.body else None
    return get_upload_url(body)


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
    return query_reports(params)


@app.post("/reports")
@tracer.capture_method
def post_report():
    body = app.current_event.json_body
    return create_report(body)


@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_HTTP)
@tracer.capture_lambda_handler
def handler(event, context):
    return app.resolve(event, context)

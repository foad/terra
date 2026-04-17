from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver
from aws_lambda_powertools.logging import correlation_paths

from src.handlers.reports import create_report
from src.handlers.photos import get_upload_url

logger = Logger()
tracer = Tracer()
app = APIGatewayHttpResolver()


@app.get("/health")
@tracer.capture_method
def health():
    return {"status": "ok"}


@app.post("/photos/upload")
@tracer.capture_method
def post_photo_upload():
    return get_upload_url()


@app.post("/reports")
@tracer.capture_method
def post_report():
    body = app.current_event.json_body
    return create_report(body)


@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_HTTP)
@tracer.capture_lambda_handler
def handler(event, context):
    return app.resolve(event, context)

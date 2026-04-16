from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver
from aws_lambda_powertools.logging import correlation_paths

logger = Logger()
tracer = Tracer()
app = APIGatewayHttpResolver()


@app.get("/health")
@tracer.capture_method
def health():
    return {"status": "ok"}


@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_HTTP)
@tracer.capture_lambda_handler
def handler(event, context):
    return app.resolve(event, context)

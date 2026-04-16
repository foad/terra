from src.handlers.api import app


def test_health():
    event = {
        "requestContext": {
            "http": {"method": "GET", "path": "/health"},
            "stage": "$default",
        },
        "rawPath": "/health",
        "rawQueryString": "",
    }
    result = app.resolve(event, None)
    assert result["statusCode"] == 200

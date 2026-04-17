import json
from src.utils.response import success, error


class TestSuccess:
    def test_default_status_code(self):
        result = success({"key": "value"})
        assert result["statusCode"] == 200

    def test_custom_status_code(self):
        result = success({"key": "value"}, status_code=201)
        assert result["statusCode"] == 201

    def test_json_body(self):
        result = success({"key": "value"})
        body = json.loads(result["body"])
        assert body == {"key": "value"}

    def test_content_type_header(self):
        result = success({})
        assert result["headers"]["Content-Type"] == "application/json"


class TestError:
    def test_default_status_code(self):
        result = error("something went wrong")
        assert result["statusCode"] == 400

    def test_custom_status_code(self):
        result = error("not found", status_code=404)
        assert result["statusCode"] == 404

    def test_error_body(self):
        result = error("bad request")
        body = json.loads(result["body"])
        assert body == {"error": "bad request"}

#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$SCRIPT_DIR/.build"

echo "Packaging backend..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Install dependencies into build dir
uv pip install --target "$BUILD_DIR/package" -r <(uv pip compile "$SCRIPT_DIR/pyproject.toml" --quiet)

# Copy source code
cp -r "$SCRIPT_DIR/src" "$BUILD_DIR/package/"

# Create zip
cd "$BUILD_DIR/package"
zip -rq "$BUILD_DIR/lambda.zip" . -x "*.pyc" "__pycache__/*"

echo "Deploying terra-api..."
aws lambda update-function-code \
  --function-name terra-api \
  --zip-file "fileb://$BUILD_DIR/lambda.zip" \
  --query 'FunctionName' \
  --output text

echo "Deploying terra-photo-processor..."
aws lambda update-function-code \
  --function-name terra-photo-processor \
  --zip-file "fileb://$BUILD_DIR/lambda.zip" \
  --query 'FunctionName' \
  --output text

API_ENDPOINT=$(terraform -chdir="$REPO_ROOT/infra" output -raw api_endpoint)
API_ENDPOINT="${API_ENDPOINT%/}"
echo ""
echo "Deployed. Test with:"
echo "  curl $API_ENDPOINT/health"

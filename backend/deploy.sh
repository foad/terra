#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$SCRIPT_DIR/.build"

echo "Packaging backend..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Install dependencies into build dir (targeting Lambda's Amazon Linux)
uv pip install --target "$BUILD_DIR/package" --python-platform x86_64-unknown-linux-gnu --python-version 3.13 --only-binary :all: -r <(uv pip compile "$SCRIPT_DIR/pyproject.toml" --quiet)

# Copy source code
cp -r "$SCRIPT_DIR/src" "$BUILD_DIR/package/"

# Create zip
cd "$BUILD_DIR/package"
zip -rq "$BUILD_DIR/lambda.zip" . -x "*.pyc" "__pycache__/*"

# Stage in S3 — direct UpdateFunctionCode caps at ~70MB and Pillow/shapely
# pushed us over. S3-based deploy supports up to 250MB unzipped.
DEPLOY_BUCKET=$(terraform -chdir="$REPO_ROOT/infra" output -raw assets_bucket)
DEPLOY_KEY="lambda-deploy/$(date +%Y%m%d-%H%M%S).zip"
echo "Uploading to s3://$DEPLOY_BUCKET/$DEPLOY_KEY..."
aws s3 cp "$BUILD_DIR/lambda.zip" "s3://$DEPLOY_BUCKET/$DEPLOY_KEY"

echo "Deploying terra-api..."
aws lambda update-function-code \
  --function-name terra-api \
  --s3-bucket "$DEPLOY_BUCKET" \
  --s3-key "$DEPLOY_KEY" \
  --query 'FunctionName' \
  --output text

echo "Deploying terra-photo-processor..."
aws lambda update-function-code \
  --function-name terra-photo-processor \
  --s3-bucket "$DEPLOY_BUCKET" \
  --s3-key "$DEPLOY_KEY" \
  --query 'FunctionName' \
  --output text

API_ENDPOINT=$(terraform -chdir="$REPO_ROOT/infra" output -raw api_endpoint)
API_ENDPOINT="${API_ENDPOINT%/}"
echo ""
echo "Deployed. Test with:"
echo "  curl $API_ENDPOINT/health"

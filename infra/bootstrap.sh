#!/bin/bash
# Bootstrap the Terraform state backend (run once before terraform init)
set -euo pipefail

REGION="eu-west-2"

# Generate a unique bucket name using AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET="terra-tfstate-${ACCOUNT_ID}"

echo "Creating S3 state bucket: $BUCKET"
aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION" \
  2>/dev/null || echo "Bucket already exists"

aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled \
  --region "$REGION"

aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true \
  --region "$REGION"

echo "Done. State bucket: $BUCKET"
echo "Update infra/providers.tf backend bucket to: $BUCKET"
echo "Then run: cd infra && terraform init"

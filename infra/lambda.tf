# Lambda execution role
resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# CloudWatch Logs
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# S3 access for photos and exports
resource "aws_iam_policy" "lambda_s3" {
  name = "${var.project_name}-lambda-s3"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
      ]
      Resource = [
        aws_s3_bucket.photos.arn,
        "${aws_s3_bucket.photos.arn}/*",
        aws_s3_bucket.exports.arn,
        "${aws_s3_bucket.exports.arn}/*",
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_s3" {
  role       = aws_iam_role.lambda.name
  policy_arn = aws_iam_policy.lambda_s3.arn
}

# Bedrock access for AI features
resource "aws_iam_policy" "lambda_bedrock" {
  name = "${var.project_name}-lambda-bedrock"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "bedrock:InvokeModel",
      ]
      Resource = "arn:aws:bedrock:${var.aws_region}::foundation-model/*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_bedrock" {
  role       = aws_iam_role.lambda.name
  policy_arn = aws_iam_policy.lambda_bedrock.arn
}

# Lambda Powertools layer (AWS-managed, published by account 017000801446)
locals {
  powertools_layer_arn = "arn:aws:lambda:${var.aws_region}:017000801446:layer:AWSLambdaPowertoolsPythonV3-python313-x86_64:7"
}

# Placeholder zip for initial deployment
data "archive_file" "lambda_placeholder" {
  type        = "zip"
  output_path = "${path.module}/.build/placeholder.zip"

  source {
    content  = "def handler(event, context): return {'statusCode': 200, 'body': 'TERRA API'}"
    filename = "handler.py"
  }
}

# Main API Lambda function
resource "aws_lambda_function" "api" {
  function_name = "${var.project_name}-api"
  role          = aws_iam_role.lambda.arn
  handler       = "handler.handler"
  runtime       = "python3.13"
  timeout       = 30
  memory_size   = 512

  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256

  layers = [local.powertools_layer_arn]

  environment {
    variables = {
      POWERTOOLS_SERVICE_NAME  = var.project_name
      POWERTOOLS_PARAMETERS_SSM_PREFIX = "/${var.project_name}"
      LOG_LEVEL                = "INFO"
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

# CloudWatch log group with retention
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${aws_lambda_function.api.function_name}"
  retention_in_days = 14
}

# Photo processing Lambda (S3 trigger for EXIF stripping, thumbnails)
resource "aws_lambda_function" "photo_processor" {
  function_name = "${var.project_name}-photo-processor"
  role          = aws_iam_role.lambda.arn
  handler       = "handler.handler"
  runtime       = "python3.13"
  timeout       = 60
  memory_size   = 1024

  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256

  environment {
    variables = {
      POWERTOOLS_SERVICE_NAME  = "${var.project_name}-photo-processor"
      POWERTOOLS_PARAMETERS_SSM_PREFIX = "/${var.project_name}"
      LOG_LEVEL                = "INFO"
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_cloudwatch_log_group" "photo_processor" {
  name              = "/aws/lambda/${aws_lambda_function.photo_processor.function_name}"
  retention_in_days = 14
}

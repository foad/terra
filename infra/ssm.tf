# SSM Parameter Store for secrets — values populated manually via AWS CLI
# Lambda reads these at cold start via Powertools Parameters

resource "aws_ssm_parameter" "database_url" {
  name  = "/${var.project_name}/database_url"
  type  = "SecureString"
  value = "placeholder"

  lifecycle {
    ignore_changes = [value]
  }
}

# IAM policy for Lambda to read SSM parameters
resource "aws_iam_policy" "lambda_ssm" {
  name = "${var.project_name}-lambda-ssm"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssm:GetParameter",
        "ssm:GetParameters",
      ]
      Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/${var.project_name}/*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_ssm" {
  role       = aws_iam_role.lambda.name
  policy_arn = aws_iam_policy.lambda_ssm.arn
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-2"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "terra"
}

variable "bedrock_model_id" {
  description = "Bedrock model ID or inference profile for AI damage classification"
  type        = string
  default     = "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
}


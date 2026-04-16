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

variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  sensitive   = true
}

variable "supabase_service_key" {
  description = "Supabase service role key"
  type        = string
  sensitive   = true
}

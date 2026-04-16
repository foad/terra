locals {
  account_id = "018043257032"
}

# Photos bucket — private, presigned URL access only
resource "aws_s3_bucket" "photos" {
  bucket = "${var.project_name}-photos-${local.account_id}"
}

resource "aws_s3_bucket_public_access_block" "photos" {
  bucket                  = aws_s3_bucket.photos.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# Static assets bucket — PMTiles, basemap tiles, building footprints
resource "aws_s3_bucket" "assets" {
  bucket = "${var.project_name}-assets-${local.account_id}"
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Exports bucket — presigned URL access for GeoJSON, CSV, Shapefile downloads
resource "aws_s3_bucket" "exports" {
  bucket = "${var.project_name}-exports-${local.account_id}"
}

resource "aws_s3_bucket_public_access_block" "exports" {
  bucket                  = aws_s3_bucket.exports.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "exports" {
  bucket = aws_s3_bucket.exports.id

  rule {
    id     = "expire-exports"
    status = "Enabled"

    expiration {
      days = 7
    }
  }
}

# Frontend hosting bucket — PWA static files
resource "aws_s3_bucket" "frontend" {
  bucket = "${var.project_name}-frontend-${local.account_id}"
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Outputs
output "photos_bucket" {
  value = aws_s3_bucket.photos.id
}

output "assets_bucket" {
  value = aws_s3_bucket.assets.id
}

output "exports_bucket" {
  value = aws_s3_bucket.exports.id
}

output "frontend_bucket" {
  value = aws_s3_bucket.frontend.id
}

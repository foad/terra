data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-rds"
  subnet_ids = data.aws_subnets.default.ids
}

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds"
  description = "Postgres ingress"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "main" {
  identifier                  = "${var.project_name}-db"
  engine                      = "postgres"
  engine_version              = "17.10"
  instance_class              = "db.t4g.micro"
  allocated_storage           = 20
  storage_type                = "gp3"
  storage_encrypted           = true
  db_name                     = "terra"
  username                    = "terra"
  manage_master_user_password = true
  publicly_accessible         = true
  multi_az                    = false
  db_subnet_group_name        = aws_db_subnet_group.main.name
  vpc_security_group_ids      = [aws_security_group.rds.id]
  backup_retention_period     = 0
  skip_final_snapshot         = true
  deletion_protection         = false
  apply_immediately           = true
}

output "rds_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "rds_master_user_secret_arn" {
  value = aws_db_instance.main.master_user_secret[0].secret_arn
}

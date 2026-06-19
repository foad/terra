# Scale test (#200)

500k synthetic reports against disposable RDS Postgres 17 + PostGIS. Throwaway instance, destroy after.

## Provision

```bash
cd infra
terraform apply
```

`infra/rds.tf` creates a single `db.t4g.medium` / 20GB / Single-AZ / no-backup instance, publicly accessible, SG open on 5432. Master password in AWS Secrets Manager.

```bash
RDS_HOST=$(terraform output -raw rds_endpoint)
SECRET_ARN=$(terraform output -raw rds_master_user_secret_arn)
RDS_PASS=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query SecretString --output text | jq -r .password)
export PGURL="postgresql://terra:${RDS_PASS}@${RDS_HOST}/terra?sslmode=require"
```

## Schema

```bash
cd /home/dan/code/terra
psql "$PGURL" -v ON_ERROR_STOP=1 -f db/001_initial_schema.sql
```

## Load 500k rows

```bash
cd backend
uv run --with h3 ../db/generate_scale_test.py --rows 500000 --out /tmp/scale.csv
```

```bash
psql "$PGURL" -c "ALTER TABLE reports DISABLE TRIGGER trg_update_version_chain;"
psql "$PGURL" -c "\copy reports (id, location, h3_r12, h3_r8, building_id, damage_level, infrastructure_type, infrastructure_description, crisis_nature, debris_present, electricity_status, health_status, pressing_needs, version_chain_id, is_latest, device_id, submitted_at) FROM '/tmp/scale.csv' WITH (FORMAT csv)"
psql "$PGURL" -c "ALTER TABLE reports ENABLE TRIGGER trg_update_version_chain;"
psql "$PGURL" -c "VACUUM ANALYZE reports;"
```

## Read-path timings

```bash
psql "$PGURL" -f db/scale_test_queries.sql 2>&1 | tee scale_read_$(date +%Y%m%d-%H%M%S).log
```

Run each of the commented `EXPLAIN (ANALYZE, BUFFERS)` blocks at the bottom of the file when capturing plans for the writeup.

## Write-path timings

Point Lambdas at the test DB:

```bash
aws ssm put-parameter --name /terra/database_url --value "$PGURL" --overwrite --type SecureString
cd backend && ./deploy.sh   # forces cold start so new SSM value is read
```

Two runs:

```bash
python db/scale_test_writepath.py --mode db-only --url https://api.terra.foad.dev
python db/scale_test_writepath.py --mode full --url https://api.terra.foad.dev --photo-key uploads/<existing-uuid>.jpg
```

## Teardown

```bash
psql "$PGURL" -c "DELETE FROM reports WHERE device_id LIKE 'device-scale-%';"
cd infra && terraform destroy
```

-- AI-suggested infrastructure type from Bedrock vision classifier (issue #41)
ALTER TABLE reports ADD COLUMN ai_infrastructure_type TEXT[];

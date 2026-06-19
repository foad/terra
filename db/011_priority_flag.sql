-- Analyst priority flag: request more photos for specific buildings (#235)
-- Analyst sets priority_flag = true on a report; the community map highlights
-- that building with an amber outline to direct crowd coverage.
ALTER TABLE reports ADD COLUMN priority_flag BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_reports_priority_flag ON reports (building_id) WHERE priority_flag = true;

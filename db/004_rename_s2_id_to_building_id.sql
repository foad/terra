ALTER TABLE reports RENAME COLUMN s2_id TO building_id;
ALTER INDEX idx_reports_s2_id RENAME TO idx_reports_building_id;

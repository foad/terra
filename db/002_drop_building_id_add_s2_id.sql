-- Replace building_id FK with s2_id from VIDA PMTiles
-- s2_id is the direct building identifier, no need for an intermediate table reference
ALTER TABLE reports DROP COLUMN building_id;
ALTER TABLE reports ADD COLUMN s2_id TEXT;
CREATE INDEX idx_reports_s2_id ON reports (s2_id);

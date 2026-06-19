-- Analyst priority flag: request more photos for specific buildings (#235)
-- Separate table so any building can be flagged regardless of whether it has
-- a report yet — analyst directs the crowd to unassessed buildings too.
CREATE TABLE priority_buildings (
    building_id TEXT PRIMARY KEY,
    flagged_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

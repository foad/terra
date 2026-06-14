-- Analyst trust tools: damage reclassification (#169) and report flagging (#170)
-- The community's original damage_level is never overwritten — the override
-- lives alongside it and queries read COALESCE(analyst_damage_level, damage_level).
ALTER TABLE reports ADD COLUMN analyst_damage_level TEXT
    CHECK (analyst_damage_level IN ('minimal', 'partial', 'complete'));
ALTER TABLE reports ADD COLUMN flag_status TEXT
    CHECK (flag_status IN ('suspect', 'invalid'));
ALTER TABLE reports ADD COLUMN flag_reason TEXT;

CREATE INDEX idx_reports_flag_status ON reports (flag_status) WHERE flag_status IS NOT NULL;

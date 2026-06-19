-- GIN indexes on the TEXT[] columns the dashboard filters via `= ANY(arr)`.
-- Without these, the planner falls back to seq-scan at 500k rows.
CREATE INDEX idx_reports_infrastructure_type_gin ON reports USING GIN (infrastructure_type);
CREATE INDEX idx_reports_crisis_nature_gin ON reports USING GIN (crisis_nature);
CREATE INDEX idx_reports_pressing_needs_gin ON reports USING GIN (pressing_needs);

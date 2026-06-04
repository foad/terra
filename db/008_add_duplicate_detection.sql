-- Add duplicate and reassessment detection fields
ALTER TABLE reports ADD COLUMN duplicate_status TEXT;
ALTER TABLE reports ADD COLUMN related_report_id UUID REFERENCES reports(id);

-- Create indexes for efficient querying
CREATE INDEX idx_reports_duplicate_status ON reports(duplicate_status);
CREATE INDEX idx_reports_related_report ON reports(related_report_id);

-- Create index on (submitted_at, location) for duplicate detection queries
CREATE INDEX idx_reports_submitted_location ON reports(submitted_at, location);

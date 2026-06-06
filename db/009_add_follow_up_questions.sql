ALTER TABLE crisis_events
  ADD COLUMN follow_up_questions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE reports
  ADD COLUMN follow_up_responses JSONB;

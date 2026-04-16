-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;

-- Crisis events
CREATE TABLE crisis_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    crisis_type     TEXT NOT NULL,
    region_bbox     GEOMETRY(Polygon, 4326),
    config          JSONB DEFAULT '{}',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_crisis_events_active ON crisis_events (is_active);

-- Building footprints (imported from VIDA FlatGeobuf)
CREATE TABLE building_footprints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crisis_event_id UUID REFERENCES crisis_events(id),
    geometry        GEOMETRY(Polygon, 4326) NOT NULL,
    h3_r12          TEXT,
    properties      JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_building_footprints_geom ON building_footprints USING GIST (geometry);
CREATE INDEX idx_building_footprints_h3_r12 ON building_footprints (h3_r12);
CREATE INDEX idx_building_footprints_crisis ON building_footprints (crisis_event_id);

-- Admin boundaries (OCHA COD)
CREATE TABLE admin_boundaries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crisis_event_id UUID REFERENCES crisis_events(id),
    admin_level     INTEGER NOT NULL,
    name            TEXT NOT NULL,
    geometry        GEOMETRY(MultiPolygon, 4326) NOT NULL,
    properties      JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admin_boundaries_geom ON admin_boundaries USING GIST (geometry);
CREATE INDEX idx_admin_boundaries_crisis_level ON admin_boundaries (crisis_event_id, admin_level);

-- Damage reports
CREATE TABLE reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crisis_event_id     UUID REFERENCES crisis_events(id),
    building_id         UUID REFERENCES building_footprints(id),

    -- Location
    location            GEOMETRY(Point, 4326) NOT NULL,
    h3_r12              TEXT NOT NULL,
    h3_r8               TEXT NOT NULL,
    location_description TEXT,

    -- Damage assessment
    damage_level        TEXT NOT NULL CHECK (damage_level IN ('minimal', 'partial', 'complete')),
    ai_damage_level     TEXT CHECK (ai_damage_level IN ('minimal', 'partial', 'complete')),
    ai_confidence       REAL,

    -- Photo
    photo_url           TEXT,
    thumbnail_url       TEXT,

    -- Survey fields
    infrastructure_type TEXT[] NOT NULL,
    infrastructure_name TEXT,
    crisis_nature       TEXT[] NOT NULL,
    debris_present      BOOLEAN,
    electricity_status  TEXT,
    health_status       TEXT,
    pressing_needs      TEXT[],

    -- Versioning
    version_chain_id    UUID NOT NULL,
    is_latest           BOOLEAN DEFAULT true,

    -- Metadata
    device_id           TEXT,
    offline_queue_id    TEXT,
    submitted_at        TIMESTAMPTZ DEFAULT now(),
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reports_geom ON reports USING GIST (location);
CREATE INDEX idx_reports_h3_r12 ON reports (h3_r12);
CREATE INDEX idx_reports_h3_r8 ON reports (h3_r8);
CREATE INDEX idx_reports_building ON reports (building_id);
CREATE INDEX idx_reports_crisis ON reports (crisis_event_id);
CREATE INDEX idx_reports_version_chain ON reports (version_chain_id, is_latest);
CREATE INDEX idx_reports_damage_level ON reports (damage_level);
CREATE INDEX idx_reports_submitted_at ON reports (submitted_at);
CREATE INDEX idx_reports_offline_queue ON reports (offline_queue_id);

-- Trigger to update is_latest on new report in same version chain
CREATE OR REPLACE FUNCTION update_version_chain()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE reports
    SET is_latest = false, updated_at = now()
    WHERE version_chain_id = NEW.version_chain_id
      AND id != NEW.id
      AND is_latest = true;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_version_chain
    AFTER INSERT ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_version_chain();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crisis_events_updated_at
    BEFORE UPDATE ON crisis_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

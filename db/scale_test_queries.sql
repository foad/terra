-- Scale-test query set (#200). Run with \timing on against the test
-- instance loaded by generate_scale_test.py. Record each timing for the
-- Feasibility section. NEVER run the teardown against the demo DB.

\timing on

-- 1. Total count (dashboard header stat)
SELECT count(*) FROM reports WHERE is_latest = true;

-- 2. Damage-level filter (dashboard filter)
SELECT count(*) FROM reports
WHERE is_latest = true AND damage_level = 'complete';

-- 3. H3 R8 cell lookup (area aggregation path)
SELECT h3_r8, count(*), mode() WITHIN GROUP (ORDER BY damage_level)
FROM reports
WHERE is_latest = true
GROUP BY h3_r8
ORDER BY count(*) DESC
LIMIT 20;

-- 4. Bounding-box spatial query (map viewport fetch)
SELECT count(*) FROM reports
WHERE is_latest = true
  AND location && ST_MakeEnvelope(36.14, 36.19, 36.18, 36.23, 4326);

-- 5. Paginated viewport page (what GET /reports actually does)
SELECT id, damage_level, ST_AsGeoJSON(location)
FROM reports
WHERE is_latest = true
ORDER BY submitted_at DESC
LIMIT 1000 OFFSET 0;

-- 6. Export query at the current cap (exports.py, EXPORT_ROW_CAP = 10000)
SELECT id, damage_level, infrastructure_type, ST_AsGeoJSON(location), submitted_at
FROM reports
WHERE is_latest = true
ORDER BY submitted_at DESC
LIMIT 10000;

-- Teardown (test instance only!):
-- DELETE FROM reports WHERE device_id LIKE 'device-scale-%';

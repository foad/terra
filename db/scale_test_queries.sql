-- Scale-test query set (#200). Run with \timing on against the test
-- instance loaded by generate_scale_test.py. Record each timing for the
-- Feasibility section. NEVER run the teardown against the demo DB.

\timing on

-- 1. Total count (dashboard header stat)
SELECT count(*) FROM reports WHERE is_latest = true;

-- 2. Damage-level filter (dashboard filter)
SELECT count(*) FROM reports
WHERE is_latest = true AND damage_level = 'complete';

-- 3. GIN: crisis_nature filter (post-#236; dashboard multi-select)
SELECT count(*) FROM reports
WHERE is_latest = true
  AND crisis_nature && ARRAY['Earthquake']::text[];

-- 4. GIN: infrastructure_type filter (post-#236; dashboard multi-select)
SELECT count(*) FROM reports
WHERE is_latest = true
  AND infrastructure_type && ARRAY['Residential Infrastructure (Houses and apartments)']::text[];

-- 5. H3 R8 cell aggregate (heatmap path)
SELECT h3_r8, count(*), mode() WITHIN GROUP (ORDER BY damage_level)
FROM reports
WHERE is_latest = true
GROUP BY h3_r8
ORDER BY count(*) DESC
LIMIT 20;

-- 6. Bounding-box spatial query (map viewport count). 0.005° square ~ 500 m,
-- typical zoom-15 viewport — selective enough that the planner picks GIST.
SELECT count(*) FROM reports
WHERE is_latest = true
  AND location && ST_MakeEnvelope(36.155, 36.215, 36.160, 36.220, 4326);

-- 7. /reports/coverage row return (public PWA, post-#156). Same bbox as Q6.
SELECT id, building_id, damage_level, submitted_at
FROM reports
WHERE is_latest = true
  AND location && ST_MakeEnvelope(36.155, 36.215, 36.160, 36.220, 4326)
LIMIT 5000;

-- 8. building_id filter (reassessment-status lookup)
SELECT id, damage_level, submitted_at
FROM reports
WHERE building_id = (SELECT building_id FROM reports WHERE building_id IS NOT NULL LIMIT 1)
ORDER BY submitted_at DESC;

-- 9. Version-chain lookup (history timeline)
SELECT id, damage_level, is_latest, submitted_at
FROM reports
WHERE version_chain_id = (SELECT version_chain_id FROM reports LIMIT 1)
ORDER BY submitted_at DESC;

-- 10. Paginated viewport page (GET /reports — frontend dashboard load)
SELECT id, damage_level, ST_AsGeoJSON(location)
FROM reports
WHERE is_latest = true
ORDER BY submitted_at DESC
LIMIT 1000 OFFSET 0;

-- 11. Full export (post-#238; bounded by EXPORT_ROW_CEILING = 1_000_000)
SELECT id, damage_level, infrastructure_type, ST_AsGeoJSON(location), submitted_at
FROM reports
WHERE is_latest = true
ORDER BY submitted_at DESC
LIMIT 1000000;


-- EXPLAIN (ANALYZE, BUFFERS) variants — capture plans for the index-usage
-- writeup. Run each manually; comment back in as needed.

-- EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM reports WHERE is_latest = true AND crisis_nature && ARRAY['Earthquake']::text[];
-- EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM reports WHERE is_latest = true AND infrastructure_type && ARRAY['Residential Infrastructure (Houses and apartments)']::text[];
-- EXPLAIN (ANALYZE, BUFFERS) SELECT h3_r8, count(*) FROM reports WHERE is_latest = true GROUP BY h3_r8 ORDER BY count(*) DESC LIMIT 20;
-- EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM reports WHERE is_latest = true AND location && ST_MakeEnvelope(36.14, 36.19, 36.18, 36.23, 4326);
-- EXPLAIN (ANALYZE, BUFFERS) SELECT id, damage_level, ST_AsGeoJSON(location) FROM reports WHERE is_latest = true ORDER BY submitted_at DESC LIMIT 1000;

-- Teardown (test instance only!):
-- DELETE FROM reports WHERE device_id LIKE 'device-scale-%';

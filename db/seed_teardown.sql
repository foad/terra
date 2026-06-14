-- Remove all seed data (identified by device_id prefix)
DELETE FROM reports WHERE device_id LIKE 'device-seed-%';
DELETE FROM crisis_events WHERE name = 'Cyclone response — Pemba, Mozambique';

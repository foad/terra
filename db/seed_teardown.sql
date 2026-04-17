-- Remove all seed data (identified by device_id prefix)
DELETE FROM reports WHERE device_id LIKE 'device-seed-%';

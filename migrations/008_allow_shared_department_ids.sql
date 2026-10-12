-- Department IDs identify a shared department, not a unique user.
-- Multiple approved accounts must be able to belong to PO1/PO2/PO3/PO4.
ALTER TABLE app_profiles DROP CONSTRAINT IF EXISTS app_profiles_department_id_key;
DROP INDEX IF EXISTS app_profiles_department_id_key;
DROP INDEX IF EXISTS app_profiles_department_id_unique;
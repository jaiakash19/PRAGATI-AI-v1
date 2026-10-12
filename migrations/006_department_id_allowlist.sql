CREATE TABLE IF NOT EXISTS allowed_department_ids (department_id TEXT PRIMARY KEY, active BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO allowed_department_ids (department_id) VALUES ('PO1') ON CONFLICT (department_id) DO NOTHING;
INSERT INTO allowed_department_ids (department_id) VALUES ('PO2') ON CONFLICT (department_id) DO NOTHING;
INSERT INTO allowed_department_ids (department_id) VALUES ('PO3') ON CONFLICT (department_id) DO NOTHING;
INSERT INTO allowed_department_ids (department_id) VALUES ('PO4') ON CONFLICT (department_id) DO NOTHING;
CREATE UNIQUE INDEX IF NOT EXISTS app_profiles_department_id_unique ON app_profiles (upper(department_id)) WHERE department_id IS NOT NULL;
-- SI division assignments: one approved SI email may manage only its assigned division's stations.
CREATE TABLE IF NOT EXISTS station_si_assignments (
  station_code TEXT PRIMARY KEY REFERENCES police_stations(station_code),
  department_id TEXT NOT NULL UNIQUE,
  assigned_email TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-EB-001','SI1','jaiakash1910@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-EB-002','SI2','jaiakash1910@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-EB-003','SI3','jaiakash1910@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-EB-004','SI4','jaiakash1910@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-EB-005','SI5','jaiakash1910@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-WB-001','SI6','jaiakash1910@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-WB-002','SI7','jaiakash1910@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-WB-003','SI8','jaiakash1910@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-WB-004','SI9','jaiakash1910@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-WB-005','SI10','jaiakash1910@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-WB-006','SI11','jaiakash1910@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-NB-001','SI12','jaiakash1915@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-NB-002','SI13','jaiakash1915@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-NB-003','SI14','jaiakash1915@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-NB-004','SI15','jaiakash1915@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-NB-005','SI16','jaiakash1915@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-SB-001','SI17','jaiakash1915@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-SB-002','SI18','jaiakash1915@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-SB-003','SI19','jaiakash1915@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-SB-004','SI20','jaiakash1915@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-SB-005','SI21','jaiakash1915@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-SPEC-001','SI22','jaiakash1915@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-SPEC-002','SI23','jaiakash1915@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO station_si_assignments (station_code, department_id, assigned_email)
VALUES ('PY-SPEC-003','SI24','jaiakash1915@gmail.com') ON CONFLICT (station_code) DO UPDATE SET department_id=EXCLUDED.department_id,assigned_email=EXCLUDED.assigned_email,active=TRUE;
INSERT INTO allowed_department_ids (department_id, active)
SELECT 'SI' || n, TRUE FROM generate_series(1,24) AS n
ON CONFLICT (department_id) DO UPDATE SET active=TRUE;
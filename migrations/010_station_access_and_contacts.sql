CREATE TABLE IF NOT EXISTS police_stations (
  station_code TEXT PRIMARY KEY,
  station_name TEXT NOT NULL UNIQUE,
  division TEXT NOT NULL,
  landline TEXT,
  cug_phone TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO police_stations (station_code,station_name,division,landline,cug_phone) VALUES
('PY-EB-001','Grand Bazaar Police Station','East','0413-2338876','9489205018'),
('PY-EB-002','Orleanpet Police Station','East','0413-2205657','9489205020'),
('PY-EB-003','Muthialpet Police Station','East','0413-2336066','9489205052'),
('PY-EB-004','Kalapet Police Station','East','0413-2655142','9489205077'),
('PY-EB-005','Odiansalai Police Station','East','0413-2228067','9489205040'),
('PY-WB-001','Villianur Police Station','West','0413-2666321','9489205024'),
('PY-WB-002','Mangalam Police Station','West',NULL,'9489205146'),
('PY-WB-003','Nettapakkam Police Station','West','0413-2699426','9489205027'),
('PY-WB-004','Thirubuvanai Police Station','West',NULL,'9489205139'),
('PY-WB-005','Thirukkanur Police Station','West',NULL,'9489205028'),
('PY-WB-006','Katterikuppam Police Station','West',NULL,'9489205218'),
('PY-NB-001','Lawspet Police Station','North',NULL,'9489205019'),
('PY-NB-002','D Nagar Police Station','North',NULL,'9489205022'),
('PY-NB-003','Mettupalayam Police Station','North',NULL,'9489205065'),
('PY-NB-004','Reddiarpalayam Police Station','North',NULL,'9489205223'),
('PY-NB-005','Sedurapet Police Station','North',NULL,'9489205068'),
('PY-SB-001','Mudaliarpet Police Station','South',NULL,'9489205023'),
('PY-SB-002','Ariyankuppam Police Station','South',NULL,'9489205025'),
('PY-SB-003','Thavalakuppam Police Station','South',NULL,'9489205123'),
('PY-SB-004','Kirumampakkam Police Station','South',NULL,'9489205188'),
('PY-SB-005','Bahour Police Station','South',NULL,'9489205026'),
('PY-SPEC-001','All Women Police Station - Puducherry','Specialized','0413-2336178',NULL),
('PY-SPEC-002','All Women Police Station - Villianur','Specialized','0413-2660385',NULL),
('PY-SPEC-003','Cyber Crime Cell','Specialized',NULL,'1930')
ON CONFLICT (station_code) DO NOTHING;

ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS station_code TEXT REFERENCES police_stations(station_code);
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS police_rank TEXT;
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS contact_extension TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS station_code TEXT REFERENCES police_stations(station_code);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS common_report BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE app_profiles DROP CONSTRAINT IF EXISTS app_profiles_role_check;
ALTER TABLE app_profiles ADD CONSTRAINT app_profiles_role_check CHECK (role IN ('Admin','Submitter','Reviewer','Approving Officer','Implementation Officer','SI','SHO / Inspector','ASI','Head Constable','Police Constable'));
CREATE INDEX IF NOT EXISTS proposals_station_created_idx ON proposals(station_code, created_at DESC);
CREATE INDEX IF NOT EXISTS profiles_station_idx ON app_profiles(station_code);
-- SI pre-approves member emails before first sign-in. Pending invitations count against the 50-member station cap.
CREATE TABLE IF NOT EXISTS station_member_invites (
  email TEXT PRIMARY KEY,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'Police Constable',
  station_code TEXT NOT NULL REFERENCES police_stations(station_code),
  department_id TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS station_member_invites_station_idx ON station_member_invites(station_code, active);

CREATE OR REPLACE FUNCTION enforce_station_active_member_cap()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active_count INTEGER;
BEGIN
  IF NEW.station_code IS NULL OR NEW.active IS NOT TRUE THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.station_code));
  SELECT
    (SELECT COUNT(*) FROM app_profiles p WHERE p.station_code=NEW.station_code AND p.active=TRUE AND p.user_id<>NEW.user_id)
    +
    (SELECT COUNT(*) FROM station_member_invites i WHERE i.station_code=NEW.station_code AND i.active=TRUE AND LOWER(i.email)<>LOWER(COALESCE(NEW.email,'')))
  INTO active_count;
  IF active_count >= 50 THEN
    RAISE EXCEPTION 'Station % already has 50 active members or pending invitations', NEW.station_code USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_station_invite_cap()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active_count INTEGER;
BEGIN
  IF NEW.station_code IS NULL OR NEW.active IS NOT TRUE THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.station_code));
  SELECT
    (SELECT COUNT(*) FROM app_profiles p WHERE p.station_code=NEW.station_code AND p.active=TRUE AND LOWER(p.email)<>LOWER(NEW.email))
    +
    (SELECT COUNT(*) FROM station_member_invites i WHERE i.station_code=NEW.station_code AND i.active=TRUE AND LOWER(i.email)<>LOWER(NEW.email))
  INTO active_count;
  IF active_count >= 50 THEN
    RAISE EXCEPTION 'Station % already has 50 active members or pending invitations', NEW.station_code USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS station_member_invites_cap ON station_member_invites;
CREATE TRIGGER station_member_invites_cap BEFORE INSERT OR UPDATE OF station_code, active ON station_member_invites FOR EACH ROW EXECUTE FUNCTION enforce_station_invite_cap();
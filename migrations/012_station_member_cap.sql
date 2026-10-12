-- Database-level guard: serialize station membership changes and cap active profiles at 50 per station.
CREATE OR REPLACE FUNCTION enforce_station_active_member_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  active_count INTEGER;
BEGIN
  IF NEW.station_code IS NULL OR NEW.active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.station_code));

  SELECT COUNT(*) INTO active_count
  FROM app_profiles
  WHERE station_code = NEW.station_code
    AND active = TRUE
    AND user_id <> NEW.user_id;

  IF active_count >= 50 THEN
    RAISE EXCEPTION 'Station % already has 50 active members', NEW.station_code
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_profiles_station_member_cap ON app_profiles;
CREATE TRIGGER app_profiles_station_member_cap
BEFORE INSERT OR UPDATE OF station_code, active ON app_profiles
FOR EACH ROW
EXECUTE FUNCTION enforce_station_active_member_cap();
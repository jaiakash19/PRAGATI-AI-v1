-- Persist SI approval after a pending invitation becomes an active profile.
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS si_approved BOOLEAN NOT NULL DEFAULT FALSE;
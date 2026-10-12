-- Add structured summary fields used by proposal decisions and the impact brief.
-- Safe for existing databases; the previous schema may not have these columns.
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS decision TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS observations TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS outcome TEXT;
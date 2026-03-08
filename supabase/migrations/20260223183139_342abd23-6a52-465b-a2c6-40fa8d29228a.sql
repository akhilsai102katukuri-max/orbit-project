
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS interviewee_name text;

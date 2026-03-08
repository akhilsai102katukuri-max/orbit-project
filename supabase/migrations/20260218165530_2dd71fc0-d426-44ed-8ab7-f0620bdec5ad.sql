
-- Add session_code, scheduled_at, status to interviews
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS session_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'cancelled'));

-- Generate session code for existing rows that don't have one
UPDATE public.interviews SET session_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)) WHERE session_code IS NULL;

-- Make session_code not null after backfill
ALTER TABLE public.interviews ALTER COLUMN session_code SET NOT NULL;

-- Add score to interviewee_responses
ALTER TABLE public.interviewee_responses
  ADD COLUMN IF NOT EXISTS score INTEGER;

-- Create index for session_code lookups
CREATE INDEX IF NOT EXISTS idx_interviews_session_code ON public.interviews(session_code);

-- Add interviewee_name tracking column
ALTER TABLE public.interviewee_responses
  ADD COLUMN IF NOT EXISTS interviewee_name TEXT;

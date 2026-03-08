
-- Add feedback column to interviewee_responses
ALTER TABLE public.interviewee_responses ADD COLUMN IF NOT EXISTS feedback text;

-- Create interview_participants table
CREATE TABLE IF NOT EXISTS public.interview_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'joined',
  UNIQUE(interview_id, user_id)
);

ALTER TABLE public.interview_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies can view participants of own interviews"
  ON public.interview_participants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.interviews WHERE interviews.id = interview_participants.interview_id AND interviews.company_user_id = auth.uid()
  ));

CREATE POLICY "Interviewees can manage own participation"
  ON public.interview_participants FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for video recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('interview-recordings', 'interview-recordings', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'interview-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own recordings"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'interview-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Companies can view interview recordings"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'interview-recordings' AND EXISTS (
    SELECT 1 FROM public.interviews WHERE company_user_id = auth.uid()
  ));

-- Enable realtime for interviews and interviewee_responses
ALTER PUBLICATION supabase_realtime ADD TABLE public.interviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interviewee_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_participants;

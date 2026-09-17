-- Anyone (including anonymous visitors) can see who is currently working.
-- Only exposes user_id + started_at — no sensitive fields.
CREATE POLICY "Active timers are viewable by everyone"
  ON public.active_timers FOR SELECT
  USING (true);

GRANT SELECT ON public.active_timers TO anon;

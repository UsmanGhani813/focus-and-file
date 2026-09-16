-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- WORK SESSIONS
CREATE TABLE public.work_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  stopped_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX work_sessions_user_idx ON public.work_sessions (user_id);
CREATE INDEX work_sessions_stopped_idx ON public.work_sessions (stopped_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_sessions TO authenticated;
GRANT SELECT ON public.work_sessions TO anon;
GRANT ALL ON public.work_sessions TO service_role;
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public sessions are viewable by everyone" ON public.work_sessions FOR SELECT USING (is_public = true);
CREATE POLICY "Users can view own sessions" ON public.work_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.work_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.work_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.work_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER work_sessions_updated_at BEFORE UPDATE ON public.work_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ATTACHMENTS
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_session_id UUID NOT NULL REFERENCES public.work_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX attachments_session_idx ON public.attachments (work_session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT SELECT ON public.attachments TO anon;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attachments of public sessions are viewable" ON public.attachments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.work_sessions ws WHERE ws.id = work_session_id AND ws.is_public = true)
);
CREATE POLICY "Users can view own attachments" ON public.attachments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attachments" ON public.attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own attachments" ON public.attachments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ACTIVE TIMERS (one per user)
CREATE TABLE public.active_timers (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.active_timers TO authenticated;
GRANT ALL ON public.active_timers TO service_role;
ALTER TABLE public.active_timers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own timer" ON public.active_timers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER active_timers_updated_at BEFORE UPDATE ON public.active_timers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- STORAGE POLICIES for work-evidence bucket
CREATE POLICY "Users can upload own evidence" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'work-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can read own evidence" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'work-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own evidence" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'work-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
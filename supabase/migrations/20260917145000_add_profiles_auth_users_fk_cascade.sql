-- Clean up any orphan profile rows (auth.users deleted, profile left behind)
DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- Add FK constraint from profiles.id -> auth.users(id) with cascade delete.
-- From now on, deleting the auth.users row automatically wipes the profile too,
-- and profiles cascades further to work_sessions/attachments/active_timers.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

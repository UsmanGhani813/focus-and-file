-- Add DELETE policy on profiles for admins (fallback path)
CREATE POLICY "Admins can delete any profile"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role((select auth.uid()), 'admin'));

-- Function that fully deletes a user: auth.users row + all cascaded app data.
-- Runs as SECURITY DEFINER so it can touch auth.users, but checks caller is admin.
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account here';
  END IF;
  IF public.has_role(target_user_id, 'admin') THEN
    RAISE EXCEPTION 'Cannot delete another admin. Remove their admin role first.';
  END IF;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

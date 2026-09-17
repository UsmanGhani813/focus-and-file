-- Approval status enum
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'declined');

-- Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN approval_status public.approval_status NOT NULL DEFAULT 'pending',
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX profiles_approval_status_idx ON public.profiles (approval_status);

-- Auto-approve all existing users (they were using the app before this migration)
UPDATE public.profiles
SET approval_status = 'approved', approved_at = now();

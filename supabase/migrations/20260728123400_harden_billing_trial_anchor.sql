-- user_profiles.created_at anchors the app-level trial. Authenticated users
-- may update their profile, so preserve the server-created value on UPDATE.
CREATE OR REPLACE FUNCTION public.preserve_user_profile_created_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS preserve_user_profile_created_at
  ON public.user_profiles;
CREATE TRIGGER preserve_user_profile_created_at
  BEFORE UPDATE OF created_at ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_user_profile_created_at();

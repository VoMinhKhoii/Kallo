-- Backfill user_profiles for pre-existing auth.users rows after remote resets.
INSERT INTO public.user_profiles (user_id)
SELECT auth_user.id
FROM auth.users AS auth_user
LEFT JOIN public.user_profiles AS profile
  ON profile.user_id = auth_user.id
WHERE profile.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- The welcome offer becomes admin-configurable.
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- Seeds the single premium_settings row with today's behaviour (on, 14 days)
-- and rewrites the signup trigger to read it: switched off, past its
-- auto-off moment, or missing, a new account gets nothing; otherwise it gets
-- `welcome_days` of Premium from signup. Existing grants are never touched.
-- =============================================================================

INSERT INTO public.premium_settings (id, welcome_enabled, welcome_days)
VALUES (1, true, 14)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user_welcome_premium()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  offer public.premium_settings%ROWTYPE;
BEGIN
  SELECT * INTO offer FROM public.premium_settings WHERE id = 1;
  IF NOT FOUND
     OR NOT offer.welcome_enabled
     OR (offer.welcome_auto_off_at IS NOT NULL
         AND now() >= offer.welcome_auto_off_at) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.entitlement_grants (
    user_id, entitlement_key, source, environment, product_id,
    starts_at, expires_at, status, will_renew, external_ref
  )
  SELECT
    NEW.id, 'premium', 'promo', env.name, 'welcome_premium',
    now(), now() + make_interval(days => offer.welcome_days), 'active', false,
    'welcome:' || NEW.id::text
  FROM (VALUES ('production'), ('sandbox')) AS env(name)
  ON CONFLICT (source, external_ref, environment) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user_welcome_premium()
  FROM PUBLIC, anon, authenticated;

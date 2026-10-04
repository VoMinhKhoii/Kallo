-- =============================================================================
-- Welcome premium: 14 days of real Premium for every account.
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- Replaces the app-level free trial. Instead of a derived trial window, each
-- account holds an ordinary `entitlement_grants` row (source 'promo'), so it
-- reads as tier 'premium' everywhere: gating, settings, the expiry banner.
--
--   * Backfill — every existing account gets 14 days from when this applies.
--   * Trigger  — every new account gets 14 days from signup.
--
-- One grant per account per environment, ever: external_ref is
-- 'welcome:<user_id>' and the (source, external_ref, environment) unique key
-- makes both paths idempotent, so re-running the backfill never extends it.
-- A row is written for BOTH environments because prod and non-prod share this
-- database and each reads only its own environment's grants.
--
-- RevenueCat reconciliation only replaces source = 'revenuecat' rows, so a
-- purchase never deletes this grant; the furthest-out active grant wins.
-- To stop granting new signups, drop the trigger in a later migration.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.grant_welcome_premium(
  p_user_id uuid,
  p_starts_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.entitlement_grants (
    user_id, entitlement_key, source, environment, product_id,
    starts_at, expires_at, status, will_renew, external_ref
  )
  SELECT
    p_user_id, 'premium', 'promo', env.name, 'welcome_premium_14d',
    p_starts_at, p_starts_at + interval '14 days', 'active', false,
    'welcome:' || p_user_id::text
  FROM (VALUES ('production'), ('sandbox')) AS env(name)
  ON CONFLICT (source, external_ref, environment) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_welcome_premium(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user_welcome_premium()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.grant_welcome_premium(NEW.id, now());
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user_welcome_premium()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_welcome_premium ON auth.users;
CREATE TRIGGER on_auth_user_created_welcome_premium
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_welcome_premium();

-- Backfill: existing accounts start their 14 days now.
SELECT public.grant_welcome_premium(u.id, now()) FROM auth.users AS u;

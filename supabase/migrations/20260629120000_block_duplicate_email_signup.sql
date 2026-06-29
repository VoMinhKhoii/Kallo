-- One email = one account.
--
-- A `before_user_created` auth hook that rejects creating a NEW auth user when a
-- CONFIRMED user already owns the same email (under any provider). This closes
-- the Supabase order-dependent duplicate: signing in with Google/email first and
-- then Apple (or vice-versa) otherwise spawns a second account instead of
-- linking (supabase/auth#1109).
--
-- Confirmed-only matching is deliberate: an UNCONFIRMED email/password signup
-- must not be able to "squat" an address and lock the real owner out of their
-- Google/Apple sign-in.
--
-- Residual gap (cannot be fixed by email matching): Apple "Hide My Email" sends a
-- per-app relay address, so there is no shared email to match on — those remain a
-- separate account by Apple's design. Users connect Apple deliberately from
-- Settings → Account instead (manual linking).
--
-- The hook fires only on new-user creation, so same-provider re-sign-in is
-- unaffected, and the first signup for an email is always allowed.

create or replace function public.block_duplicate_email_signup(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(event->'user'->>'email');
begin
  -- No email to match on (e.g. phone-only signups) → allow.
  if v_email is null or v_email = '' then
    return '{}'::jsonb;
  end if;

  -- A confirmed account already owns this email → reject the new one.
  if exists (
    select 1
    from auth.users u
    where lower(u.email) = v_email
      and u.email_confirmed_at is not null
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 409,
        'message', 'An account already exists for this email. Please sign in with the method you used originally.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

-- Only the auth server may invoke the hook.
revoke execute on function public.block_duplicate_email_signup(jsonb) from authenticated, anon, public;
grant  execute on function public.block_duplicate_email_signup(jsonb) to supabase_auth_admin;

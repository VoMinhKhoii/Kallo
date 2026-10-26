'use client';

import type { AuthError } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import type { TurnstileState } from '@/hooks/auth/use-turnstile';
import {
  emailCodeRedirect,
  RESEND_COOLDOWN_SECONDS,
  sendEmailCode,
} from '@/lib/infra/auth/email-code';
import { createClient } from '@/lib/infra/supabase/client';

/**
 * "Send a new code" on the code step: waits out Supabase's per-address
 * cooldown, then sends with its own Turnstile token. One send at a time — a
 * token is single-use, and a second click while the first send is in flight
 * would spend it twice.
 */
export function useResendCode(input: {
  email: string | null;
  next: string | null;
  locale: string;
  turnstile: TurnstileState;
}) {
  const { email, next, locale, turnstile } = input;
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  /** Resolves to Supabase's error, or null once a new code is on its way. */
  const resend = async (): Promise<AuthError | null> => {
    if (!email) return null;
    setResending(true);
    const sendError = await sendEmailCode(createClient(), {
      email,
      emailRedirectTo: emailCodeRedirect(window.location.origin, next, locale),
      captchaToken: turnstile.token,
    });
    turnstile.reset();
    setResending(false);
    if (!sendError) setCooldown(RESEND_COOLDOWN_SECONDS);
    return sendError;
  };

  // As on the email step, a check that could not run leaves it to the server.
  const ready =
    cooldown === 0 &&
    !resending &&
    (!turnstile.required || !!turnstile.token || turnstile.failed);

  return { cooldown, ready, resend };
}

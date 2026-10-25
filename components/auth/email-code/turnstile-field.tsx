'use client';

import type { TurnstileState } from '@/hooks/auth/use-turnstile';
import { cn } from '@/lib/core/ui/cn';

/**
 * Where a form's Turnstile widget lives: in the DOM always (the check runs in
 * it), taking up room only while Cloudflare shows its checkbox — so for
 * nearly everyone the form looks exactly as it would without it.
 *
 * A check that fails to run says nothing here. The form still sends, and the
 * server decides: it accepts the request while Turnstile is only monitored,
 * and refuses with `captcha_failed` (shown as the form's own error) once it
 * is enforced.
 */
export function TurnstileField({ turnstile }: { turnstile: TurnstileState }) {
  if (!turnstile.required) return null;

  return (
    <div
      ref={turnstile.containerRef}
      className={cn(turnstile.interactive && 'mb-4')}
    />
  );
}

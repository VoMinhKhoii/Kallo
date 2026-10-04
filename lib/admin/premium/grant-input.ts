import { z } from 'zod';

// Shared by the admin form (client-side hints) and the server action (the
// real check). Bounds are deliberately tight: a typo should fail loudly, not
// hand out a decade of Premium or touch thousands of named accounts.
export const MAX_GRANT_DAYS = 365;
export const MAX_GRANT_EMAILS = 100;

const days = z.coerce
  .number()
  .int('Days must be a whole number.')
  .min(1, 'At least 1 day.')
  .max(MAX_GRANT_DAYS, `At most ${MAX_GRANT_DAYS} days.`);

export const grantPremiumInputSchema = z.discriminatedUnion('scope', [
  z.object({
    scope: z.literal('users'),
    days,
    emails: z
      .array(z.string().trim().toLowerCase().email('Not a valid email.'))
      .min(1, 'Add at least one email.')
      .max(MAX_GRANT_EMAILS, `At most ${MAX_GRANT_EMAILS} emails at once.`)
      .transform((list) => [...new Set(list)]),
  }),
  z.object({ scope: z.literal('everyone'), days }),
]);

export type GrantPremiumInput = z.input<typeof grantPremiumInputSchema>;
export type ParsedGrantPremiumInput = z.output<typeof grantPremiumInputSchema>;

/** Splits a pasted list on commas, semicolons, whitespace and newlines. */
export function splitEmailList(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

import { z } from 'zod';

// The welcome offer new signups get. Changing it never touches existing grants.
export const offerInputSchema = z.object({
  enabled: z.boolean(),
  days: z.coerce
    .number()
    .int('Days must be a whole number.')
    .min(1, 'At least 1 day.')
    .max(365, 'At most 365 days.'),
  // Optional calendar date; the offer stops at the start of that day (UTC).
  autoOffOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.')
    .nullable(),
  reason: z
    .string()
    .trim()
    .min(3, 'Say why, in a few words.')
    .max(300, 'Keep the reason under 300 characters.'),
});

export type OfferInput = z.input<typeof offerInputSchema>;
export type ParsedOfferInput = z.output<typeof offerInputSchema>;

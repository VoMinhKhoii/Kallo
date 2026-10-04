import { z } from 'zod';
import { whoSchema } from '@/lib/admin/premium/targets/who-input';

// Bounds are deliberately tight: a typo should fail loudly, not hand out a
// decade of Premium.
export const MAX_GRANT_DAYS = 365;

const reason = z
  .string()
  .trim()
  .min(3, 'Say why, in a few words.')
  .max(300, 'Keep the reason under 300 characters.');

const length = z.discriminatedUnion('unit', [
  z.object({
    unit: z.literal('days'),
    days: z.coerce
      .number()
      .int('Days must be a whole number.')
      .min(1, 'At least 1 day.')
      .max(MAX_GRANT_DAYS, `At most ${MAX_GRANT_DAYS} days.`),
  }),
  z.object({
    unit: z.literal('until'),
    // A calendar date; Premium runs to the end of that day (UTC).
    until: z.iso.date('Pick a real date.'),
  }),
]);

export const giveInputSchema = z
  .object({
    who: whoSchema,
    length,
    // extend: on top of any free time left; restart: from now.
    mode: z.enum(['extend', 'restart']),
    reason,
    // Typed by the admin; required to give everyone Premium.
    confirm: z.string().optional(),
  })
  .refine(
    (input) => input.who.kind !== 'everyone' || input.confirm === 'EVERYONE',
    { message: 'Type EVERYONE to give everyone Premium.', path: ['confirm'] }
  );

export const endInputSchema = z
  .object({
    who: whoSchema,
    reason,
    // Typed by the admin; required to end free Premium for everyone.
    confirm: z.string().optional(),
  })
  .refine((input) => input.who.kind !== 'everyone' || input.confirm === 'END', {
    message: 'Type END to end free Premium for everyone.',
    path: ['confirm'],
  });

export type GiveInput = z.input<typeof giveInputSchema>;
export type ParsedGiveInput = z.output<typeof giveInputSchema>;
export type EndInput = z.input<typeof endInputSchema>;
export type ParsedEndInput = z.output<typeof endInputSchema>;

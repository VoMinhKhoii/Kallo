import { z } from 'zod';

// Who an /admin/premium action applies to. Shared by the forms (hints) and
// the server actions (the real check).
export const MAX_PICKED_ACCOUNTS = 500;

// A real calendar day (rejects 2026-02-30), so Postgres never sees a bad date.
const isoDate = z.iso.date('Use a real date.').optional();

export const whoSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('users'),
    userIds: z
      .array(z.string().uuid())
      .min(1, 'Pick at least one account.')
      .max(MAX_PICKED_ACCOUNTS, `At most ${MAX_PICKED_ACCOUNTS} accounts.`)
      .transform((ids) => [...new Set(ids)]),
  }),
  z.object({
    kind: z.literal('group'),
    plan: z.enum(['free', 'complimentary', 'not_paying']),
    // Signup window, inclusive, as calendar dates (UTC).
    joinedFrom: isoDate,
    joinedTo: isoDate,
  }),
  z.object({ kind: z.literal('everyone') }),
]);

export type Who = z.output<typeof whoSchema>;
export type WhoInput = z.input<typeof whoSchema>;

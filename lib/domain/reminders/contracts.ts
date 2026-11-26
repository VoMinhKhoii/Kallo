import { z } from 'zod';

/** Body of `POST /api/v1/reminders/close-day`: the token the push carried. */
export const reminderCloseDayBodySchema = z.object({
  token: z.string().min(1).max(256),
});

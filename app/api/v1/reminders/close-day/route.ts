import { handleRouteError } from '@/lib/api/respond';
import { closeDayFromReminder } from '@/lib/domain/reminders/close-day';
import { reminderCloseDayBodySchema } from '@/lib/domain/reminders/contracts';
import { readBoundedJson } from '@/lib/infra/http/bounded-body';

/** `{ token }` — one signed string of well under 200 bytes. */
const MAX_BODY_BYTES = 1024;

/**
 * A reminder's lock-screen "That was all" / "I'm done for today" button. The
 * iOS app posts the token the push carried, from the background, with no
 * session: the signed token IS the authorization (`action-token.ts`), so this
 * route takes no Bearer header. A forged or expired token is a 401 before any
 * database read.
 */
export async function POST(request: Request) {
  const secret = process.env.REMINDER_ACTION_SECRET;
  if (!secret) {
    return Response.json(
      { error: 'reminders_not_configured' },
      { status: 503 }
    );
  }
  try {
    const { token } = reminderCloseDayBodySchema.parse(
      await readBoundedJson(request, MAX_BODY_BYTES)
    );
    const { date } = await closeDayFromReminder({ token, secret });
    return Response.json({ closed: true, date });
  } catch (error) {
    return handleRouteError(error);
  }
}

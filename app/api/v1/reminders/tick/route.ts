import { handleRouteError } from '@/lib/api/respond';
import { runReminderTick } from '@/lib/domain/reminders/tick';
import { getPushSender } from '@/lib/infra/push/sender';
import { timingSafeMatch } from '@/lib/infra/security/webhook-request';

/**
 * The reminder scheduler's one entry point, called every 15 minutes by the
 * `kallo-proxy` Worker's cron trigger (`apps/kallo-proxy/`), which attaches
 * the origin-lock header and `Authorization: Bearer $REMINDER_TICK_SECRET`.
 * Reads no body. Everything it does runs inside this request — Cloud Run
 * throttles CPU outside one, so nothing is left to `after()`.
 *
 * Unconfigured (no tick or action secret) answers 503 rather than running
 * half a feature: a reminder without its action token would offer a
 * "That was all" button that cannot work.
 */
export async function POST(request: Request) {
  const tickSecret = process.env.REMINDER_TICK_SECRET;
  const actionSecret = process.env.REMINDER_ACTION_SECRET;
  if (!tickSecret || !actionSecret) {
    return Response.json(
      { error: 'reminders_not_configured' },
      { status: 503 }
    );
  }
  const authorization = request.headers.get('authorization') ?? '';
  if (!timingSafeMatch(authorization, `Bearer ${tickSecret}`)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const summary = await runReminderTick({
      sender: getPushSender(),
      actionSecret,
    });
    return Response.json(summary);
  } catch (error) {
    return handleRouteError(error);
  }
}

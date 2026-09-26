import 'server-only';

import { getAdminEmailSet } from '@/lib/admin/authz/admin-emails';
import { sendEmail } from '@/lib/infra/email/send';
import {
  type ContentReportEmailInput,
  contentReportEmail,
} from '@/lib/infra/email/templates/content-report';

/**
 * Email every ADMIN_EMAILS address about a new report. NEVER throws: the report
 * row is already committed, so a mail outage costs an alert, not the report —
 * admins can still find it by status in `content_reports`. Each recipient is
 * sent independently so one bad address cannot swallow the others.
 */
export async function alertAdminsOfReport(
  input: ContentReportEmailInput
): Promise<void> {
  try {
    const recipients = [...getAdminEmailSet()];
    if (recipients.length === 0) {
      console.warn(
        `[reports] ADMIN_EMAILS is empty — report ${input.reportId} was stored but nobody was emailed`
      );
      return;
    }

    const message = contentReportEmail(input);
    const results = await Promise.allSettled(
      recipients.map((to, index) =>
        sendEmail({
          to,
          message,
          tags: [{ name: 'kind', value: 'content_report' }],
          // A retried alert for the same report and recipient is one email.
          idempotencyKey: `content-report-${input.reportId}-${index}`,
        })
      )
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error(
          `[reports] admin alert for report ${input.reportId} failed`,
          result.reason
        );
      }
    }
  } catch (error) {
    console.error(
      `[reports] admin alert for report ${input.reportId} failed`,
      error
    );
  }
}

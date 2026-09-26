import type { EmailMessage } from '@/lib/infra/email/send';
import {
  escapeHtml,
  muted,
  paragraph,
  renderLayout,
  renderText,
} from './layout';

/**
 * Admin alert for a new content report (POST /api/v1/reports), sent to every
 * address in ADMIN_EMAILS. English only: it goes to the team, not to users.
 *
 * Everything the reporter or the reported person wrote (note, excerpt) is
 * user input and is escaped before it reaches the HTML. The subject carries
 * only the fixed reason / kind vocabulary, never free text, so a report can't
 * put arbitrary words in an admin's inbox list.
 */

export interface ContentReportEmailInput {
  reportId: string;
  targetKind: string;
  targetId: string;
  targetUserId: string | null;
  reporterId: string;
  reason: string;
  note: string | null;
  excerpt: string | null;
  createdAt: Date;
}

export function contentReportEmail(
  input: ContentReportEmailInput
): EmailMessage {
  const subject = `[Kallo report] ${input.reason} · ${input.targetKind}`;
  const heading = 'New content report';

  const facts: Array<[string, string]> = [
    ['Report', input.reportId],
    ['Reason', input.reason],
    ['Target', `${input.targetKind} ${input.targetId}`],
    ['Reported user', input.targetUserId ?? '(unknown)'],
    ['Reporter', input.reporterId],
    ['Filed at', input.createdAt.toISOString()],
  ];

  const html = renderLayout(
    'en',
    heading,
    [
      paragraph(
        'Someone reported circle content. App Store guideline 1.2 expects a timely response: review it, act on it, and set the report’s status.'
      ),
      ...facts.map(([label, value]) =>
        muted(`<strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}`)
      ),
      input.excerpt
        ? paragraph(
            `<strong>Reported text:</strong> ${escapeHtml(input.excerpt)}`
          )
        : '',
      input.note
        ? paragraph(
            `<strong>Reporter’s note:</strong> ${escapeHtml(input.note)}`
          )
        : '',
    ].join('')
  );

  const text = renderText('en', [
    heading,
    '',
    ...facts.map(([label, value]) => `${label}: ${value}`),
    ...(input.excerpt ? ['', `Reported text: ${input.excerpt}`] : []),
    ...(input.note ? ['', `Reporter's note: ${input.note}`] : []),
  ]);

  return { subject, html, text };
}

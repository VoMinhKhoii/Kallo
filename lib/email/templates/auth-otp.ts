import type { EmailMessage } from '@/lib/email/send';
import {
  type EmailLocale,
  escapeHtml,
  muted,
  paragraph,
  renderLayout,
  renderText,
} from './layout';

/**
 * Code-only auth email (GoTrue's `reauthentication` action) — there is no link
 * to click, just a 6-digit OTP the user types back into the app.
 */

interface Copy {
  subject: string;
  heading: string;
  body: string;
  label: string;
  note: string;
}

const COPY: Record<EmailLocale, Copy> = {
  en: {
    subject: 'Your Kallo verification code',
    heading: 'Confirm it’s you',
    body: 'Enter this code in Kallo to continue.',
    label: 'Verification code',
    note: "The code expires in an hour. If you didn't ask for it, you can ignore this email.",
  },
  vi: {
    subject: 'Mã xác minh Kallo',
    heading: 'Xác nhận đó là bạn',
    body: 'Nhập mã này trong Kallo để tiếp tục.',
    label: 'Mã xác minh',
    note: 'Mã hết hạn sau một giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.',
  },
};

export function authOtpEmail(locale: EmailLocale, otp: string): EmailMessage {
  const copy = COPY[locale];

  const html = renderLayout(
    locale,
    copy.heading,
    [
      paragraph(escapeHtml(copy.body)),
      muted(escapeHtml(copy.label)),
      `<p style="margin:0 0 24px;font-family:'SF Mono',Menlo,monospace;font-size:28px;letter-spacing:0.3em;color:#141413">${escapeHtml(otp)}</p>`,
      muted(escapeHtml(copy.note)),
    ].join('')
  );

  const text = renderText(locale, [
    copy.heading,
    '',
    copy.body,
    '',
    `${copy.label}: ${otp}`,
    '',
    copy.note,
  ]);

  return { subject: copy.subject, html, text };
}

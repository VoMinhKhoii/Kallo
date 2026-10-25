import type { EmailMessage } from '@/lib/infra/email/send';
import {
  type EmailLocale,
  escapeHtml,
  muted,
  paragraph,
  renderLayout,
  renderText,
} from './layout';

/**
 * Code-only auth email — there is no link to click, just the 6-digit code the
 * user types back into the app.
 *
 * - `signin`: the code that signs someone in or creates their account
 *   (GoTrue's `magiclink` / `signup` actions from a code-capable client).
 * - `reauthentication`: GoTrue's "confirm it's you" nonce.
 *
 * The expiry in `note` must match the Supabase "Email OTP Expiration" setting
 * (600 s — `supabase/config.toml` `otp_expiry`, and the dashboard in prod).
 */
export type AuthOtpKind = 'signin' | 'reauthentication';

interface Copy {
  /** Gets the code appended for `signin`, so each email has its own subject. */
  subject: string;
  heading: string;
  body: string;
  label: string;
  note: string;
}

const COPY: Record<EmailLocale, Record<AuthOtpKind, Copy>> = {
  en: {
    signin: {
      subject: 'Your Kallo code',
      heading: 'Your sign-in code',
      body: 'Enter this code in Kallo to sign in.',
      label: 'Sign-in code',
      note: "The code expires in 10 minutes and works once. If you didn't ask for it, you can ignore this email.",
    },
    reauthentication: {
      subject: 'Your Kallo verification code',
      heading: 'Confirm it’s you',
      body: 'Enter this code in Kallo to continue.',
      label: 'Verification code',
      note: "The code expires in 10 minutes. If you didn't ask for it, you can ignore this email.",
    },
  },
  vi: {
    signin: {
      subject: 'Mã Kallo của bạn',
      heading: 'Mã đăng nhập của bạn',
      body: 'Nhập mã này trong Kallo để đăng nhập.',
      label: 'Mã đăng nhập',
      note: 'Mã hết hạn sau 10 phút và chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.',
    },
    reauthentication: {
      subject: 'Mã xác minh Kallo',
      heading: 'Xác nhận đó là bạn',
      body: 'Nhập mã này trong Kallo để tiếp tục.',
      label: 'Mã xác minh',
      note: 'Mã hết hạn sau 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.',
    },
  },
};

export function authOtpEmail(
  locale: EmailLocale,
  otp: string,
  kind: AuthOtpKind
): EmailMessage {
  const copy = COPY[locale][kind];

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

  // A sign-in code in the subject reads straight off a lock-screen
  // notification, and a new subject per code keeps mail apps from threading a
  // fresh code under a stale one.
  const subject = kind === 'signin' ? `${copy.subject}: ${otp}` : copy.subject;

  return { subject, html, text };
}

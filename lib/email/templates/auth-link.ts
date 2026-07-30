import type { EmailMessage } from '@/lib/email/send';
import {
  button,
  type EmailLocale,
  escapeHtml,
  muted,
  paragraph,
  renderLayout,
  renderText,
} from './layout';

/**
 * The one template behind every emailed auth link.
 *
 * `kind` is the app-level intent, already resolved from the hook's
 * `email_action_type` (see lib/email/auth-email.ts) — the template never sees
 * GoTrue vocabulary.
 */
export type AuthLinkKind =
  | 'confirm'
  | 'signin'
  | 'invite'
  | 'recovery'
  | 'email_change';

interface Copy {
  subject: string;
  heading: string;
  body: string;
  cta: string;
  /** Shown under the button, above the raw-URL fallback. */
  note: string;
}

const EN: Record<AuthLinkKind, Copy> = {
  confirm: {
    subject: 'Confirm your Kallo account',
    heading: 'Confirm your email',
    body: "You're one tap from tracking Vietnamese meals without the guesswork. Confirm this address to finish setting up your account.",
    cta: 'Confirm my email',
    note: 'This link expires in an hour and can only be used once.',
  },
  signin: {
    subject: 'Your Kallo sign-in link',
    heading: 'Sign in to Kallo',
    body: 'Use the link below to sign in. No password needed.',
    cta: 'Sign in',
    note: 'This link expires in an hour and can only be used once.',
  },
  invite: {
    subject: "You've been invited to Kallo",
    heading: 'Join Kallo',
    body: 'Someone invited you to Kallo. Accept the invite to set up your account.',
    cta: 'Accept the invite',
    note: 'This link can only be used once.',
  },
  recovery: {
    subject: 'Reset your Kallo password',
    heading: 'Reset your password',
    body: 'We got a request to reset the password on this account. Choose a new one using the link below.',
    cta: 'Choose a new password',
    note: "This link expires in an hour. If you didn't ask for it, you can ignore this email — nothing changes.",
  },
  email_change: {
    subject: 'Confirm your new Kallo email',
    heading: 'Confirm this change',
    body: 'Confirm that you want this address used for your Kallo account.',
    cta: 'Confirm the change',
    note: 'This link expires in an hour and can only be used once.',
  },
};

const VI: Record<AuthLinkKind, Copy> = {
  confirm: {
    subject: 'Xác nhận tài khoản Kallo của bạn',
    heading: 'Xác nhận email của bạn',
    body: 'Chỉ một bước nữa là bạn có thể theo dõi bữa ăn Việt mà không phải đoán. Xác nhận địa chỉ này để hoàn tất tài khoản.',
    cta: 'Xác nhận email',
    note: 'Liên kết hết hạn sau một giờ và chỉ dùng được một lần.',
  },
  signin: {
    subject: 'Liên kết đăng nhập Kallo',
    heading: 'Đăng nhập Kallo',
    body: 'Dùng liên kết bên dưới để đăng nhập. Không cần mật khẩu.',
    cta: 'Đăng nhập',
    note: 'Liên kết hết hạn sau một giờ và chỉ dùng được một lần.',
  },
  invite: {
    subject: 'Bạn được mời dùng Kallo',
    heading: 'Tham gia Kallo',
    body: 'Có người mời bạn dùng Kallo. Nhận lời mời để thiết lập tài khoản.',
    cta: 'Nhận lời mời',
    note: 'Liên kết chỉ dùng được một lần.',
  },
  recovery: {
    subject: 'Đặt lại mật khẩu Kallo',
    heading: 'Đặt lại mật khẩu',
    body: 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản này. Chọn mật khẩu mới bằng liên kết bên dưới.',
    cta: 'Chọn mật khẩu mới',
    note: 'Liên kết hết hạn sau một giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này — không có gì thay đổi.',
  },
  email_change: {
    subject: 'Xác nhận email Kallo mới',
    heading: 'Xác nhận thay đổi này',
    body: 'Xác nhận rằng bạn muốn dùng địa chỉ này cho tài khoản Kallo.',
    cta: 'Xác nhận thay đổi',
    note: 'Liên kết hết hạn sau một giờ và chỉ dùng được một lần.',
  },
};

const COPY: Record<EmailLocale, Record<AuthLinkKind, Copy>> = {
  en: EN,
  vi: VI,
};

const FALLBACK_LABEL: Record<EmailLocale, string> = {
  en: 'Button not working? Paste this into your browser:',
  vi: 'Nút không hoạt động? Dán liên kết này vào trình duyệt:',
};

export interface AuthLinkEmailInput {
  locale: EmailLocale;
  kind: AuthLinkKind;
  /** Fully-built `/auth/verify?token_hash=…&type=…&next=…` URL. */
  url: string;
}

/**
 * Deliberately link-only: GoTrue also hands us a 6-digit OTP for these actions,
 * but neither the web app nor the Flutter app has a code-entry screen, so
 * printing it would just be a number the reader can't use anywhere.
 */
export function authLinkEmail({
  locale,
  kind,
  url,
}: AuthLinkEmailInput): EmailMessage {
  const copy = COPY[locale][kind];

  const html = renderLayout(
    locale,
    copy.heading,
    [
      paragraph(escapeHtml(copy.body)),
      button(copy.cta, url),
      muted(escapeHtml(copy.note)),
      muted(
        `${escapeHtml(FALLBACK_LABEL[locale])}<br><a href="${escapeHtml(url)}" style="color:#6e6d66;word-break:break-all">${escapeHtml(url)}</a>`
      ),
    ].join('')
  );

  const text = renderText(locale, [
    copy.heading,
    '',
    copy.body,
    '',
    url,
    '',
    copy.note,
  ]);

  return { subject: copy.subject, html, text };
}

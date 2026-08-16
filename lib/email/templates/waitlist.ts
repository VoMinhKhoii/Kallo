import type { EmailMessage } from '@/lib/email/send';
import { SITE_URL } from '@/lib/seo/site';
import {
  button,
  type EmailLocale,
  escapeHtml,
  fallbackLink,
  muted,
  paragraph,
  renderLayout,
  renderText,
} from './layout';

/**
 * The two waitlist emails. Kept in one file because they are one conversation:
 * confirm → welcome, sharing the same voice and the same copy table.
 */

interface ConfirmCopy {
  subject: string;
  heading: string;
  body: string;
  cta: string;
  note: string;
  fallback: string;
}

const CONFIRM: Record<EmailLocale, ConfirmCopy> = {
  en: {
    subject: 'Confirm your spot on the Kallo waitlist',
    heading: 'One tap to join',
    body: 'Confirm this address and we’ll let you know the moment Kallo opens up. That’s the only email you’ll get from us until then.',
    cta: 'Confirm my email',
    note: 'This link expires in 7 days. If you didn’t sign up, ignore this email and nothing happens.',
    fallback: 'Button not working? Paste this into your browser:',
  },
  vi: {
    subject: 'Xác nhận chỗ của bạn trong danh sách chờ Kallo',
    heading: 'Một chạm để tham gia',
    body: 'Xác nhận địa chỉ này và chúng tôi sẽ báo ngay khi Kallo mở cửa. Đó là email duy nhất bạn nhận từ chúng tôi cho tới lúc đó.',
    cta: 'Xác nhận email',
    note: 'Liên kết hết hạn sau 7 ngày. Nếu bạn không đăng ký, hãy bỏ qua email này.',
    fallback: 'Nút không hoạt động? Dán liên kết này vào trình duyệt:',
  },
};

interface WelcomeCopy {
  subject: string;
  heading: string;
  body: string;
  cta: string;
  note: string;
}

const WELCOME: Record<EmailLocale, WelcomeCopy> = {
  en: {
    subject: 'You’re on the Kallo waitlist',
    heading: 'You’re on the list',
    body: 'Thanks for confirming. Kallo is a text-first macros analyst, aiming for better precision and more reliable results. We’ll email you when your spot opens.',
    cta: 'See what we’re building',
    note: 'Want off the list? Just reply to this email and we’ll remove you.',
  },
  vi: {
    subject: 'Bạn đã có tên trong danh sách chờ Kallo',
    heading: 'Bạn đã có tên trong danh sách',
    body: 'Cảm ơn bạn đã xác nhận. Kallo là công cụ phân tích macro ưu tiên văn bản, hướng tới độ chính xác cao hơn và kết quả đáng tin cậy hơn. Chúng tôi sẽ báo khi tới lượt bạn.',
    cta: 'Xem chúng tôi đang làm gì',
    note: 'Muốn rời danh sách? Chỉ cần trả lời email này.',
  },
};

/** Double opt-in email: the link is the only way onto the confirmed list. */
export function waitlistConfirmEmail(
  locale: EmailLocale,
  url: string
): EmailMessage {
  const copy = CONFIRM[locale];

  const html = renderLayout(
    locale,
    copy.heading,
    [
      paragraph(escapeHtml(copy.body)),
      button(copy.cta, url),
      muted(escapeHtml(copy.note)),
      fallbackLink(copy.fallback, url),
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

/** Sent once, immediately after the confirm link is followed. */
export function waitlistWelcomeEmail(locale: EmailLocale): EmailMessage {
  const copy = WELCOME[locale];
  const url = `${SITE_URL}/${locale}`;

  const html = renderLayout(
    locale,
    copy.heading,
    [
      paragraph(escapeHtml(copy.body)),
      button(copy.cta, url),
      muted(escapeHtml(copy.note)),
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

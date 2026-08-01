import { SITE_URL } from '@/lib/site';

/**
 * Shared shell for every transactional email.
 *
 * Email clients are not browsers: no CSS variables (so the `--nham-*` tokens
 * from app/globals.css are inlined as literal hex here, the same constraint the
 * Satori OG route lives under), no external stylesheets, and table layout is
 * still the only thing Outlook renders predictably. Everything is inline.
 */

/**
 * The brand palette for email, frozen as literals. This is the DARK ("inverse")
 * treatment: espresso card, cream wordmark + text, tan accent button — the
 * reverse of the app's light surface. Values are literal hex because email
 * clients have no CSS variables (the same constraint the Satori OG route lives
 * under). Brand palette: cream #FEFBF6, espresso #2C2416, tan #C9A87C, umber #695E4E.
 */
export const EMAIL_COLORS = {
  surface: '#211b10', // page backdrop — a shade darker than the card for depth
  card: '#2c2416', // espresso card
  text: '#fefbf6', // cream headings/body
  textSoft: '#e7e0d2', // softened cream for body copy
  textMuted: '#b8ad97', // muted warm grey for notes + fallback link
  accent: '#c9a87c', // tan
  border: '#4a3f2c', // warm umber card border
  button: '#c9a87c', // tan CTA — pops on the dark card
  buttonText: '#2c2416', // espresso text on the tan button
} as const;

export type EmailLocale = 'en' | 'vi';

const FOOTER_COPY: Record<EmailLocale, { tagline: string; sentBy: string }> = {
  en: {
    tagline: 'Vietnamese meal tracking, without the guesswork.',
    sentBy: 'You received this because someone used this address on Kallo.',
  },
  vi: {
    tagline: 'Theo dõi bữa ăn Việt, không còn phải đoán.',
    sentBy: 'Bạn nhận được email này vì địa chỉ này được dùng trên Kallo.',
  },
};

/** Escape a value before interpolating it into email HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A single primary call-to-action button. */
export function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr><td style="border-radius:999px;background:${EMAIL_COLORS.button}"><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:${EMAIL_COLORS.buttonText};text-decoration:none;border-radius:999px">${escapeHtml(label)}</a></td></tr></table>`;
}

/** A muted paragraph, used for the fallback link and expiry notes. */
export function muted(text: string): string {
  return `<p style="margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:${EMAIL_COLORS.textMuted}">${text}</p>`;
}

/**
 * The "button not working?" escape hatch shown under every CTA: a muted label
 * plus the raw URL as a fallback link. Every link email needs it, so the one
 * place that knows how to render it lives here rather than in each template.
 */
export function fallbackLink(label: string, url: string): string {
  return muted(
    `${escapeHtml(label)}<br><a href="${escapeHtml(url)}" style="color:${EMAIL_COLORS.textMuted};word-break:break-all">${escapeHtml(url)}</a>`
  );
}

/** A body paragraph. */
export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${EMAIL_COLORS.textSoft}">${text}</p>`;
}

/**
 * Wrap body markup in the branded shell.
 *
 * @param locale  — picks the footer copy.
 * @param heading — the H1 shown above the body (already plain text).
 * @param body    — pre-built HTML from the helpers above.
 */
export function renderLayout(
  locale: EmailLocale,
  heading: string,
  body: string
): string {
  const footer = FOOTER_COPY[locale];
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="dark only"><meta name="supported-color-schemes" content="dark"><style>:root{color-scheme:dark only;supported-color-schemes:dark}</style></head><body style="margin:0;padding:0;background:${EMAIL_COLORS.surface}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_COLORS.surface};padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${EMAIL_COLORS.card};border:1px solid ${EMAIL_COLORS.border};border-radius:16px;padding:36px 32px">
<tr><td>
<img src="${SITE_URL}/email-logo.png" width="140" height="52" alt="Kallo" style="display:block;margin:0 0 24px;border:0;outline:none;text-decoration:none;height:auto" />
<h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;line-height:1.25;color:${EMAIL_COLORS.text}">${escapeHtml(heading)}</h1>
${body}
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;padding:20px 8px"><tr><td>
<p style="margin:0 0 6px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${EMAIL_COLORS.textMuted}">${escapeHtml(footer.tagline)}</p>
<p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${EMAIL_COLORS.textMuted}">${escapeHtml(footer.sentBy)} · <a href="${SITE_URL}" style="color:${EMAIL_COLORS.textMuted}">kallo.fit</a></p>
</td></tr></table>
</td></tr></table></body></html>`;
}

/** Build the plain-text alternative from already-plain lines. */
export function renderText(locale: EmailLocale, lines: string[]): string {
  return [...lines, '', '—', FOOTER_COPY[locale].tagline, SITE_URL].join('\n');
}

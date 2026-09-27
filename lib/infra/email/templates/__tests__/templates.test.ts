import { describe, expect, it } from 'vitest';
import {
  type AuthLinkKind,
  authLinkEmail,
} from '@/lib/infra/email/templates/auth-link';
import { authOtpEmail } from '@/lib/infra/email/templates/auth-otp';
import { contentReportEmail } from '@/lib/infra/email/templates/content-report';
import type { EmailLocale } from '@/lib/infra/email/templates/layout';
import {
  waitlistConfirmEmail,
  waitlistWelcomeEmail,
} from '@/lib/infra/email/templates/waitlist';

const LOCALES: EmailLocale[] = ['en', 'vi'];
const KINDS: AuthLinkKind[] = [
  'confirm',
  'signin',
  'invite',
  'recovery',
  'email_change',
];
const URL = 'https://kallo.fit/auth/verify?token_hash=abc123&type=email';

/** Every template must produce all three parts, with nothing left unfilled. */
function expectWellFormed(message: {
  subject: string;
  html: string;
  text: string;
}) {
  expect(message.subject.length).toBeGreaterThan(0);
  expect(message.text.length).toBeGreaterThan(0);
  expect(message.html).toContain('<!doctype html>');
  expect(message.html).not.toMatch(/undefined|\[object Object\]|\{\{/);
  expect(message.text).not.toMatch(/undefined|\[object Object\]|\{\{/);
}

describe('auth link emails', () => {
  it.each(
    LOCALES.flatMap((locale) =>
      KINDS.map((kind) => [locale, kind] as [EmailLocale, AuthLinkKind])
    )
  )('renders %s/%s with the verify link', (locale, kind) => {
    const message = authLinkEmail({ locale, kind, url: URL });
    expectWellFormed(message);
    expect(message.html).toContain('token_hash=abc123&amp;type=email');
    expect(message.text).toContain(URL);
    expect(message.html).toContain(`<html lang="${locale}"`);
  });

  it('offers the link only — the app has no code-entry screen', () => {
    const message = authLinkEmail({ locale: 'en', kind: 'confirm', url: URL });
    // No monospace code block, and no stray digit run outside a hex colour.
    expect(message.html).not.toContain('Menlo,monospace');
    expect(message.text).not.toMatch(/\d{6}/);
  });

  it('gives each kind its own subject', () => {
    const subjects = KINDS.map(
      (kind) => authLinkEmail({ locale: 'en', kind, url: URL }).subject
    );
    expect(new Set(subjects).size).toBe(KINDS.length);
  });

  it('escapes a hostile url instead of emitting raw markup', () => {
    const message = authLinkEmail({
      locale: 'en',
      kind: 'confirm',
      url: 'https://kallo.fit/auth/verify?next="><script>alert(1)</script>',
    });
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
  });
});

describe('auth otp email', () => {
  it.each(LOCALES)('renders the code for %s', (locale) => {
    const message = authOtpEmail(locale, '123456');
    expectWellFormed(message);
    expect(message.html).toContain('123456');
    expect(message.text).toContain('123456');
  });
});

describe('waitlist emails', () => {
  const confirmUrl = 'https://kallo.fit/api/v1/waitlist/confirm?token=xyz';

  it.each(LOCALES)('renders the confirm email for %s', (locale) => {
    const message = waitlistConfirmEmail(locale, confirmUrl);
    expectWellFormed(message);
    expect(message.text).toContain(confirmUrl);
  });

  it.each(LOCALES)('renders the welcome email for %s', (locale) => {
    const message = waitlistWelcomeEmail(locale);
    expectWellFormed(message);
    expect(message.html).toContain(`https://kallo.fit/${locale}`);
  });

  it('uses different subjects for confirm and welcome', () => {
    expect(waitlistConfirmEmail('en', confirmUrl).subject).not.toBe(
      waitlistWelcomeEmail('en').subject
    );
  });
});

describe('content report admin email', () => {
  const base = {
    reportId: 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44',
    targetKind: 'reply',
    targetId: 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33',
    targetUserId: 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22',
    reporterId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    reason: 'harassment',
    note: '<script>alert(1)</script> & more',
    excerpt: 'Bún <b>bò</b>',
    createdAt: new Date('2026-09-25T12:00:00.000Z'),
  };

  it('renders every fact and escapes user-written text in the HTML', () => {
    const message = contentReportEmail(base);
    expectWellFormed(message);
    expect(message.subject).toBe('[Kallo report] harassment · reply');
    expect(message.html).toContain(base.reportId);
    expect(message.html).toContain(
      '&lt;script&gt;alert(1)&lt;/script&gt; &amp; more'
    );
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('Bún &lt;b&gt;bò&lt;/b&gt;');
    expect(message.text).toContain(`Reporter: ${base.reporterId}`);
  });

  it('omits the note and excerpt blocks when there are none', () => {
    const message = contentReportEmail({
      ...base,
      note: null,
      excerpt: null,
      targetUserId: null,
    });
    expectWellFormed(message);
    expect(message.text).not.toContain("Reporter's note");
    expect(message.text).toContain('Reported user: (unknown)');
  });
});

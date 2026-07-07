import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Terms of Service — Kallo',
  description: 'The terms for using Kallo.',
};

// Minimal placeholder so the mobile app's terms link resolves instead of
// 404ing. Replace with reviewed legal copy before public launch (see
// docs/PROD_DOMAIN_SETUP.md — launch prerequisites).
export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-nham-surface px-6 py-16 font-sans-display">
      <h1 className="mb-4 font-normal font-serif text-3xl text-[#2C2416]">
        Terms of Service
      </h1>
      <p className="mb-4 text-[#5C5140] leading-relaxed">
        Kallo helps you estimate nutrition from meals you log. Estimates are for
        general guidance only and are not medical or dietary advice. Use the app
        responsibly and consult a professional for health decisions.
      </p>
      <p className="text-[#8B7355] text-sm leading-relaxed">
        These terms are being finalized. For any question, contact{' '}
        <a className="underline" href="mailto:support@kallo.fit">
          support@kallo.fit
        </a>
        .
      </p>
    </main>
  );
}

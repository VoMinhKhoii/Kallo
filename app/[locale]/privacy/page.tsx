import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Privacy Policy — Kallo',
  description: 'How Kallo handles your data.',
};

// Minimal placeholder so the mobile app's privacy link resolves instead of
// 404ing. Replace with reviewed legal copy before public launch (see
// docs/PROD_DOMAIN_SETUP.md — launch prerequisites).
export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-nham-surface px-6 py-16 font-sans-display">
      <h1 className="mb-4 font-normal font-serif text-3xl text-[#2C2416]">
        Privacy Policy
      </h1>
      <p className="mb-4 text-[#5C5140] leading-relaxed">
        Kallo tracks the meals and nutrition data you choose to log so it can
        show you your intake and progress. Your data belongs to you and is not
        sold.
      </p>
      <p className="text-[#8B7355] text-sm leading-relaxed">
        This policy is being finalized. For any privacy question or a data
        deletion request, contact{' '}
        <a className="underline" href="mailto:support@kallo.fit">
          support@kallo.fit
        </a>
        .
      </p>
    </main>
  );
}

import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Privacy Policy — Kallo',
  description: 'How Kallo collects, uses, and protects your information.',
};

const sections = [
  {
    title: 'Information you provide',
    body: 'We process account details, profile and goal settings, meal descriptions, nutrition estimates, weight records, feedback, and support messages that you choose to provide. Payment card details are handled by Apple, Google, RevenueCat Billing, Stripe, or their payment partners; Kallo does not store complete card numbers.',
  },
  {
    title: 'How we use information',
    body: 'We use this information to authenticate you, provide and personalize nutrition features, calculate estimates, maintain subscription access, prevent abuse, troubleshoot reliability, respond to support requests, and comply with legal obligations. We do not sell your personal information.',
  },
  {
    title: 'Billing providers',
    body: 'RevenueCat coordinates subscription status across Apple App Store, Google Play, and RevenueCat Billing for web checkout. RevenueCat, Stripe, and the applicable store receive a Kallo account identifier plus purchase and subscription metadata needed to complete purchases, restore access, manage renewals, detect refunds, and prevent duplicate entitlement grants.',
  },
  {
    title: 'Other service providers',
    body: 'We use infrastructure, authentication, database, analytics, AI-processing, and support providers to operate Kallo. They may process limited information on our behalf under their own security and data-protection commitments. AI meal descriptions are sent only as needed to generate the requested estimate.',
  },
  {
    title: 'Retention and deletion',
    body: 'We retain account content while your account is active and for only as long afterward as needed for security, dispute resolution, legal compliance, and backup recovery. You can export or delete your account in Settings. Account deletion removes Kallo account data, but it does not cancel a store subscription; cancel with the billing provider first if you want charges to stop.',
  },
  {
    title: 'Security and international processing',
    body: 'We use access controls, encrypted network connections, and restricted server credentials to protect information. No system is perfectly secure. Our providers may process information in countries other than yours, subject to the safeguards available under applicable law.',
  },
  {
    title: 'Your choices and rights',
    body: 'Depending on where you live, you may request access, correction, deletion, restriction, portability, or an objection to certain processing. You may also withdraw consent where consent is the basis for processing. Contact us to make a request; we may verify your identity first.',
  },
  {
    title: 'Children and changes',
    body: 'Kallo is not directed to children under 13. We may update this policy as the service changes and will post the revised date here. Material changes may also be announced in the app.',
  },
];

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-nham-surface px-6 py-16 font-sans-display text-nham-text">
      <p className="text-[11px] text-nham-text-muted uppercase tracking-[0.14em]">
        Last updated 13 July 2026
      </p>
      <h1 className="mt-2 text-balance font-normal font-serif text-3xl">
        Privacy policy
      </h1>
      <p className="mt-4 text-pretty text-nham-text-muted leading-relaxed">
        This policy explains how Kallo handles information when you use our
        nutrition and subscription services.
      </p>
      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-normal font-serif text-xl">{section.title}</h2>
            <p className="mt-2 text-pretty text-nham-text-muted leading-relaxed">
              {section.body}
            </p>
          </section>
        ))}
        <section>
          <h2 className="font-normal font-serif text-xl">Contact</h2>
          <p className="mt-2 text-nham-text-muted leading-relaxed">
            Privacy questions and requests:{' '}
            <a
              className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
              href="mailto:support@kallo.fit"
            >
              support@kallo.fit
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}

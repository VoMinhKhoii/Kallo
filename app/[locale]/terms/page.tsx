import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Terms of Service — Kallo',
  description: 'Terms for using Kallo and Kallo Premium.',
};

const sections = [
  {
    title: 'The service',
    body: 'Kallo helps you log meals and estimate nutrition. Estimates may be incomplete or inaccurate and are provided for general informational purposes only. Kallo is not a medical device and does not provide medical, diagnostic, or dietary treatment advice. Consult a qualified professional for health decisions.',
  },
  {
    title: 'Accounts and acceptable use',
    body: 'You are responsible for your account, the information you submit, and activity under your credentials. Do not abuse, reverse engineer, disrupt, scrape, resell, or use Kallo unlawfully. Automated or excessive use may be rate-limited to protect the service and other customers.',
  },
  {
    title: 'Subscriptions and renewal',
    body: 'Monthly and annual Premium plans renew automatically at the price and cadence shown before purchase until canceled. Web purchases are sold by Paddle.com Market Limited as merchant of record; mobile purchases are billed by Apple or Google. Cancel through the management link in Settings, or through Apple, Google, or the Paddle customer portal. Cancellation stops future renewal but normally preserves access through the paid period.',
  },
  {
    title: 'Trials, plan changes, and pending payments',
    body: 'An app-level free trial does not itself create a paid subscription. If you subscribe, the checkout shows when payment begins and the renewal price. Upgrades, downgrades, billing-cycle changes, grace periods, and pending payments take effect according to the applicable store rules. Premium access begins only after the billing provider confirms entitlement.',
  },
  {
    title: 'Lifetime purchases',
    body: 'A lifetime purchase is a one-time entitlement to the Premium features Kallo continues to offer for this product and account. It does not automatically cancel a separate renewable subscription. If both exist, cancel the renewable plan to avoid another charge. Lifetime does not guarantee that the service, every feature, or third-party integration will operate forever.',
  },
  {
    title: 'Refunds and taxes',
    body: 'Prices may include or exclude taxes as shown at checkout; for web purchases Paddle collects and remits any applicable sales tax or VAT as merchant of record. Refunds are governed by the store or payment provider and applicable law. Kallo applies access changes after the provider confirms a refund, reversal, expiration, or other billing event.',
  },
  {
    title: 'Account deletion',
    body: 'You may delete your account in Settings at any time. Deleting a Kallo account does not cancel an Apple or Google subscription, so cancel it in the store first if you want future charges to stop. A Kallo web subscription is canceled as part of account deletion. You may still choose immediate deletion after seeing this warning.',
  },
  {
    title: 'Availability and liability',
    body: 'We work to keep Kallo reliable but do not promise uninterrupted or error-free operation. To the extent permitted by law, Kallo is provided “as is,” and our liability is limited to the amount you paid for the service during the 12 months before the claim. Nothing here excludes rights or liability that cannot legally be excluded.',
  },
  {
    title: 'Changes and termination',
    body: 'We may improve, replace, suspend, or discontinue features, and may update these terms with a revised date. We may restrict an account for serious abuse or legal risk. If a material paid feature is discontinued, any remedy will follow applicable law and store rules.',
  },
];

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-nham-surface px-6 py-16 font-sans-display text-nham-text">
      <p className="text-[11px] text-nham-text-muted uppercase tracking-[0.14em]">
        Last updated 22 July 2026
      </p>
      <h1 className="mt-2 text-balance font-normal font-serif text-3xl">
        Terms of service
      </h1>
      <p className="mt-4 text-pretty text-nham-text-muted leading-relaxed">
        By using Kallo or Kallo Premium, you agree to these terms and the terms
        presented by the store or payment provider at checkout.
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
            Questions about these terms:{' '}
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

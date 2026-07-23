import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountPanel } from '@/components/settings/account/account-panel';
import { SettingsAnchorNav } from '@/components/settings/anchor-nav';
import {
  ACCOUNT_ANCHOR,
  FEEDBACK_ANCHOR,
  PROFILE_ANCHOR,
} from '@/components/settings/anchors';
import { FeedbackPanel } from '@/components/settings/feedback/feedback-panel';
import { SettingsGroup } from '@/components/settings/group';
import { IdentityRows } from '@/components/settings/identity/identity-rows';
import { SettingsForm } from '@/components/settings/profile/settings-form';
import { SectionHeader } from '@/components/settings/section-header';
import { Link } from '@/i18n/navigation';
import { getOnboardingProfile } from '@/lib/onboarding/actions';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');

  return {
    title: t('title'),
  };
}

export default async function SettingsPage() {
  const t = await getTranslations('settings');
  const tProfile = await getTranslations('settings.profilePage');
  const tAccount = await getTranslations('settings.account');
  const tFeedback = await getTranslations('settings.feedback');

  const [profile, supabase] = await Promise.all([
    getOnboardingProfile(),
    createClient(),
  ]);
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 font-sans-display sm:px-5 sm:py-8 lg:flex lg:gap-8">
      {/* Anchor nav — replaces the routed master-detail. Horizontal on small
          screens, a sticky rail on large. */}
      <div className="mb-3 shrink-0 lg:mb-0 lg:w-[200px]">
        <SettingsAnchorNav hasProfile={!!profile} />
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="sr-only">{t('title')}</h1>

        {profile ? (
          <SettingsForm profile={profile} />
        ) : (
          <section id={PROFILE_ANCHOR} className="mb-8 scroll-mt-20">
            <SectionHeader
              title={t('profile')}
              description={t('profileDescription')}
            />
            <SettingsGroup>
              <IdentityRows />
            </SettingsGroup>
            <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-nham-border bg-white px-4 py-12 text-center">
              <h2 className="font-serif text-lg text-nham-text">
                {tProfile('emptyTitle')}
              </h2>
              <p className="max-w-sm text-[14px] text-nham-text-soft">
                {tProfile('emptyDescription')}
              </p>
              <Link
                href="/onboarding"
                className="rounded-lg bg-nham-btn px-4 py-2 font-medium text-sm text-white"
              >
                {tProfile('startSetup')}
              </Link>
            </div>
          </section>
        )}

        {/* Feedback section — kept above Account so it doesn't sit below the
            delete-account danger zone. */}
        <section
          id={FEEDBACK_ANCHOR}
          aria-label={tFeedback('title')}
          className="mb-8 scroll-mt-20"
        >
          <SectionHeader
            title={tFeedback('title')}
            description={tFeedback('description')}
          />
          <FeedbackPanel />
        </section>

        {/* Account section — same single page, anchored. */}
        <section
          id={ACCOUNT_ANCHOR}
          aria-label={tAccount('title')}
          className="mb-8 scroll-mt-20"
        >
          <SectionHeader
            title={tAccount('title')}
            description={tAccount('description')}
          />
          <AccountPanel email={email} />
        </section>
      </div>
    </div>
  );
}

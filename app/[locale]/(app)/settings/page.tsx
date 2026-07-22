import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountPanel } from '@/components/settings/account/account-panel';
import {
  ACCOUNT_ANCHOR,
  FEEDBACK_ANCHOR,
  IDENTITY_ANCHOR,
  SettingsAnchorNav,
  SHARING_ANCHOR,
} from '@/components/settings/anchor-nav';
import { FeedbackPanel } from '@/components/settings/feedback/feedback-panel';
import { IdentityPanel } from '@/components/settings/identity/identity-panel';
import { Profile } from '@/components/settings/profile';
import { SharingPanel } from '@/components/settings/sharing/sharing-panel';
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
  const tIdentity = await getTranslations('settings.identity');
  const tSharing = await getTranslations('settings.sharing');

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
        <SettingsAnchorNav />
      </div>

      <div className="min-w-0 flex-1">
        <header className="mb-5 sm:mb-7">
          <h1 className="font-normal font-serif text-2xl text-nham-text tracking-tight">
            {t('title')}
          </h1>
          <p className="mt-1 text-[#7B6F62] text-[14px]">{t('description')}</p>
        </header>

        {/* Identity — avatar + "what should we call you", above the metrics. */}
        <section
          id={IDENTITY_ANCHOR}
          aria-label={tIdentity('title')}
          className="mb-8 scroll-mt-20"
        >
          <div className="mb-4">
            <h2 className="font-normal font-serif text-nham-text text-xl tracking-tight">
              {tIdentity('title')}
            </h2>
            <p className="mt-1 text-[#7B6F62] text-[14px]">
              {tIdentity('description')}
            </p>
          </div>
          <IdentityPanel />
        </section>

        {profile ? (
          <Profile profile={profile} />
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#EAE7E0] bg-[#FDFCF8] px-4 py-12 text-center">
            <h2 className="font-serif text-lg text-nham-text">
              {tProfile('emptyTitle')}
            </h2>
            <p className="max-w-sm text-[14px] text-nham-text-soft">
              {tProfile('emptyDescription')}
            </p>
            <Link
              href="/onboarding"
              className="rounded-lg bg-nham-ink px-4 py-2 font-medium text-nham-surface text-sm"
            >
              {tProfile('startSetup')}
            </Link>
          </div>
        )}

        {profile ? (
          <section
            id={SHARING_ANCHOR}
            aria-label={tSharing('title')}
            className="mt-8 scroll-mt-20"
          >
            <div className="mb-4">
              <h2 className="font-normal font-serif text-nham-text text-xl tracking-tight">
                {tSharing('title')}
              </h2>
              <p className="mt-1 text-[#7B6F62] text-[14px]">
                {tSharing('description')}
              </p>
            </div>
            <SharingPanel initialValue={profile.autoShareToCircle} />
          </section>
        ) : null}

        {/* Feedback section — kept above Account so it doesn't sit below the
            delete-account danger zone. */}
        <section
          id={FEEDBACK_ANCHOR}
          aria-label={tFeedback('title')}
          className="mt-8 scroll-mt-20"
        >
          <div className="mb-4">
            <h2 className="font-normal font-serif text-nham-text text-xl tracking-tight">
              {tFeedback('title')}
            </h2>
            <p className="mt-1 text-[#7B6F62] text-[14px]">
              {tFeedback('description')}
            </p>
          </div>
          <FeedbackPanel />
        </section>

        {/* Account section — same single page, anchored. */}
        <section
          id={ACCOUNT_ANCHOR}
          aria-label={tAccount('title')}
          className="mt-8 scroll-mt-20"
        >
          <div className="mb-4">
            <h2 className="font-normal font-serif text-nham-text text-xl tracking-tight">
              {tAccount('title')}
            </h2>
            <p className="mt-1 text-[#7B6F62] text-[14px]">
              {tAccount('description')}
            </p>
          </div>
          <AccountPanel email={email} />
        </section>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountPanel } from '@/components/settings/account/account-panel';
import {
  ACCOUNT_ANCHOR,
  SettingsAnchorNav,
} from '@/components/settings/anchor-nav';
import { Profile } from '@/components/settings/profile';
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

  const [profile, supabase] = await Promise.all([
    getOnboardingProfile(),
    createClient(),
  ]);
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? null;

  return (
    <div
      className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-5 sm:py-8 lg:flex lg:gap-8"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {/* Anchor nav — replaces the routed master-detail. Horizontal on small
          screens, a sticky rail on large. */}
      <div className="mb-3 shrink-0 lg:mb-0 lg:w-[200px]">
        <SettingsAnchorNav />
      </div>

      <div className="min-w-0 flex-1">
        <header className="mb-5 sm:mb-7">
          <h1
            className="font-normal text-2xl text-[#2C2416] tracking-tight"
            style={{ fontFamily: 'Lora, serif' }}
          >
            {t('title')}
          </h1>
          <p className="mt-1 text-[#7B6F62] text-[14px]">{t('description')}</p>
        </header>

        {profile ? (
          <Profile profile={profile} />
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#EAE7E0] bg-[#FDFCF8] px-4 py-12 text-center">
            <h2
              className="text-[#2C2416] text-lg"
              style={{ fontFamily: 'Lora, serif' }}
            >
              {tProfile('emptyTitle')}
            </h2>
            <p className="max-w-sm text-[#6B5D4F] text-[14px]">
              {tProfile('emptyDescription')}
            </p>
            <Link
              href="/onboarding"
              className="rounded-lg bg-[#2C2416] px-4 py-2 font-medium text-[#FEFBF6] text-sm"
            >
              {tProfile('startSetup')}
            </Link>
          </div>
        )}

        {/* Account section — same single page, anchored. */}
        <section
          id={ACCOUNT_ANCHOR}
          aria-label={tAccount('title')}
          className="mt-8 scroll-mt-20"
        >
          <div className="mb-4">
            <h2
              className="font-normal text-[#2C2416] text-xl tracking-tight"
              style={{ fontFamily: 'Lora, serif' }}
            >
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

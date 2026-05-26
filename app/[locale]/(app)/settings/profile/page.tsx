import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Profile } from '@/components/settings/profile';
import { Link } from '@/i18n/navigation';
import { getOnboardingProfile } from '@/lib/onboarding/actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings.profilePage');

  return {
    title: t('title'),
  };
}

export default async function ProfileSettingsPage() {
  const t = await getTranslations('settings.profilePage');
  const profile = await getOnboardingProfile();

  if (!profile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
        <h1
          className="font-semibold text-[#2C2416] text-xl"
          style={{ fontFamily: 'Lora, serif' }}
        >
          {t('emptyTitle')}
        </h1>
        <p
          className="text-center text-[#6B5D4F]"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {t('emptyDescription')}
        </p>
        <Link
          href="/onboarding"
          className="rounded-lg bg-[#2C2416] px-4 py-2 font-medium text-[#FEFBF6] text-sm"
        >
          {t('startSetup')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-5 sm:py-8">
      <div className="mb-5 sm:mb-6">
        <h1
          className="font-medium text-2xl text-[#2C2416] tracking-tight"
          style={{ fontFamily: 'Lora, serif' }}
        >
          {t('title')}
        </h1>
        <p
          className="mt-1 text-[#8B8682] text-[14px]"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {t('description')}
        </p>
      </div>
      <Profile profile={profile} />
    </div>
  );
}

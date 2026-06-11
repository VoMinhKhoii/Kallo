import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountPanel } from '@/components/settings/account/account-panel';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings.account');

  return {
    title: t('title'),
  };
}

export default async function AccountSettingsPage() {
  const t = await getTranslations('settings.account');
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? null;

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-5 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <h1
          className="font-normal text-2xl text-[#2C2416] tracking-tight"
          style={{ fontFamily: 'Lora, serif' }}
        >
          {t('title')}
        </h1>
        <p
          className="mt-1 text-[#7B6F62] text-[14px]"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {t('description')}
        </p>
      </div>
      <AccountPanel email={email} />
    </div>
  );
}

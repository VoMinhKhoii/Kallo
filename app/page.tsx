import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { defaultLocale } from '@/i18n/config';
import { getOnboardingProfile } from '@/lib/domain/onboarding/actions';
import { resolveRootLocale } from '@/lib/i18n/root-locale';
import { createClient } from '@/lib/infra/supabase/server';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value ?? null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profileLocale: string | null = null;
  if (user) {
    try {
      profileLocale = (await getOnboardingProfile())?.preferredLocale ?? null;
    } catch (error) {
      console.error('Failed to load onboarding profile:', error);
    }
  }

  const locale = resolveRootLocale({
    cookieLocale,
    defaultLocale,
    isAuthenticated: Boolean(user),
    profileLocale,
  });

  redirect(`/${locale}`);
}

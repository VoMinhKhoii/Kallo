import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { defaultLocale, locales } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const cookieStore = await cookies();
  
  // Try to get saved locale preference
  const savedLocale = cookieStore.get('NEXT_LOCALE')?.value;
  
  // Validate against supported locales, use default if invalid/missing
  const locale = (savedLocale && locales.includes(savedLocale as any)) 
    ? savedLocale 
    : defaultLocale;
  
  redirect(`/${locale}`);
}

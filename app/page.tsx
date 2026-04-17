import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { defaultLocale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const cookieStore = await cookies();
  
  // Try to get saved locale preference
  const savedLocale = cookieStore.get('NEXT_LOCALE')?.value;
  
  // Use saved locale or fall back to default
  const locale = savedLocale || defaultLocale;
  
  redirect(`/${locale}`);
}

import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';

export default async function AdminIndex() {
  const locale = await getLocale();
  redirect({ href: '/admin/requests', locale });
}

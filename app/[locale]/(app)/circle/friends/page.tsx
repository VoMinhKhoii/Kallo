import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';

/** The per-friend /circle/friends route is retired — the "All" feed at
 * /circle now merges every friend's shares. Redirect there. */
export default async function FriendsFeedPage() {
  const locale = await getLocale();
  redirect({ href: '/circle', locale });
}

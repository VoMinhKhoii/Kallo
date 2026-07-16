import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';

/** The per-friend /groups/friends route is retired — the "All" feed at
 * /groups now merges every friend's shares. Redirect there. */
export default async function FriendsFeedPage() {
  const locale = await getLocale();
  redirect({ href: '/groups', locale });
}

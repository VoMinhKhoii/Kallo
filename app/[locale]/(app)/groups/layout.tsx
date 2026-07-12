'use client';

import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { AddFriendDialog } from '@/components/groups/add-friend-dialog';
import { FriendsRow } from '@/components/groups/friends-row';
import { GroupList } from '@/components/groups/group-list';
import { usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * The original Circle feature (friends' shared meals), reorganized as a
 * master-detail list instead of one combined ambient wall: a persistent list
 * of friends on the left, the selected friend's shared meals for today on the
 * right. On narrow screens only one pane shows at a time — the list at the
 * bare `/groups` route, the feed once a friend is selected — driven by
 * pathname rather than a toggle control.
 */
export default function GroupsLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('groups.page');
  const pathname = usePathname();
  const isListView = pathname === '/groups';

  return (
    <main className="flex h-full flex-1 overflow-hidden rounded-2xl border border-nham-border/60 bg-white">
      <aside
        className={cn(
          'flex w-full shrink-0 flex-col overflow-hidden md:w-[340px] md:border-nham-border/60 md:border-r',
          !isListView && 'hidden md:flex'
        )}
      >
        <header className="flex items-start justify-between gap-3 border-nham-border/60 border-b px-4 py-4">
          <div className="min-w-0 space-y-0.5">
            <h1 className="font-normal font-serif text-nham-text text-xl tracking-tight">
              {t('title')}
            </h1>
            <p className="truncate font-sans-display text-[12px] text-nham-text-muted">
              {t('subtitle')}
            </p>
          </div>
          <AddFriendDialog
            trigger={
              <button
                type="button"
                aria-label={t('addFriend')}
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-nham-btn p-2 text-white transition-colors hover:bg-nham-btn/90"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            }
          />
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
          <FriendsRow />
          <GroupList />
        </div>
      </aside>

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          isListView && 'hidden md:flex'
        )}
      >
        {children}
      </div>
    </main>
  );
}

import { UserPlus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AddFriendDialog } from '@/components/groups/add-friend-dialog';
import { MealInvites } from '@/components/groups/meal-invites';
import { ViewSwitcher } from '@/components/groups/view-switcher';

/**
 * The Circle surface as one centered Threads-style column: a compact header,
 * the view-switcher pill row, the pending-invites inbox, and the active feed
 * panel (the "All" friends feed or a group feed) filling the rest of the
 * height. Replaces the old master-detail two-pane layout — there is no list
 * pane anymore, navigation happens through the pill row. The chrome is static,
 * so this stays a Server Component; the dialog, invites, and switcher are the
 * client islands.
 */
export default async function GroupsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations('groups.page');

  return (
    <main className="mx-auto flex h-full w-full max-w-2xl flex-1 flex-col overflow-hidden px-4 pt-6 pb-4 sm:px-5">
      <header className="mb-3.5 flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-bold font-sans-display text-[20px] text-nham-text tracking-[-0.01em]">
            {t('title')}
          </h1>
          <p className="font-sans-display text-[12px] text-nham-text-muted">
            {t('subtitlePlain')}{' '}
            <span className="font-light font-serif text-[13px] text-nham-accent italic">
              {t('subtitleAccent')}
            </span>
          </p>
        </div>
        <AddFriendDialog
          trigger={
            <button
              type="button"
              aria-label={t('addFriend')}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-nham-btn px-3 py-2 text-white transition-colors hover:bg-nham-btn/90"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="font-medium font-sans-display text-[12px]">
                {t('addFriend')}
              </span>
            </button>
          }
        />
      </header>

      <ViewSwitcher />

      {/* empty:hidden — MealInvites renders null when the inbox is empty, so
       * the wrapper's margin doesn't become a phantom gap. max-h + scroll caps
       * a long invite list so it can't push the feed panel off a short
       * viewport. */}
      <div className="mb-4 max-h-[35vh] shrink-0 overflow-y-auto empty:hidden">
        <MealInvites />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </main>
  );
}

import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { CircleAddMenu } from '@/components/groups/circle-add-menu';
import { CircleMealBar } from '@/components/groups/circle-meal-bar';
import { MealInvites } from '@/components/groups/meal-invites';
import { ViewSwitcher } from '@/components/groups/view-switcher';
import { COPY_SPLIT_LIVE } from '@/lib/domain/social/copy-split-live';

/**
 * The Circle surface as one centered Threads-style column: a compact header,
 * the view-switcher pill row, the pending-invites inbox, and the active feed
 * panel (the "All" friends feed or a group feed) filling the rest of the
 * height. Replaces the old master-detail two-pane layout — there is no list
 * pane anymore, navigation happens through the pill row. The chrome is static,
 * so this stays a Server Component; the dialog, invites, and switcher are the
 * client islands.
 *
 * Group pages portal their info rail into `#circle-info-slot`, an in-flow
 * sibling pushed to the right edge. At `wide:` (see --breakpoint-wide) the
 * column is FIXED to the exact viewport center — both panes fit beside it at
 * full width there, so expanding/collapsing either pane cannot move the feed.
 * Below `wide:` that geometry is impossible (an expanded sidebar would overlap
 * a viewport-centered column), so the column falls back to flow-centering and
 * the rail hands off to the sheet. The slot's empty:hidden removes it entirely
 * on views without a rail (All, direct).
 */
export default async function GroupsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations('groups.page');

  return (
    <main className="flex h-full w-full flex-1 justify-end overflow-hidden">
      <div className="wide:fixed wide:inset-y-0 wide:left-1/2 mx-auto wide:mx-0 flex h-full min-h-0 w-full max-w-2xl wide:-translate-x-1/2 flex-col px-4 pt-4 pb-4 sm:px-5">
        <header className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-bold font-sans-display text-[#141413] text-[18px] tracking-[-0.01em]">
              {t('title')}
            </h1>
          </div>
          <CircleAddMenu />
        </header>

        <CircleMealBar />

        <ViewSwitcher />

        {/* empty:hidden — MealInvites renders null when the inbox is empty, so
         * the wrapper's margin doesn't become a phantom gap. max-h + scroll caps
         * a long invite list so it can't push the feed panel off a short
         * viewport. */}
        <div className="mb-3 max-h-[35vh] shrink-0 overflow-y-auto empty:hidden">
          {COPY_SPLIT_LIVE && <MealInvites />}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>

      {/* No padding of its own — the app shell's p-3 gutter already frames
       * this edge, exactly like the left sidebar's. Doubling it here is what
       * made the rail sit deeper than the nav. */}
      <aside
        id="circle-info-slot"
        className="wide:block hidden h-full min-h-0 shrink-0 empty:hidden"
      />
    </main>
  );
}

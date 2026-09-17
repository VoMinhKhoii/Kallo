'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, useMemo, useState } from 'react';
import { ShareMealAddLane } from '@/components/groups/share-meal/add-lane';
import { ShareMealDialogFooter } from '@/components/groups/share-meal/footer';
import { ShareMealMeter } from '@/components/groups/share-meal/meter';
import { ShareMealDialogStates } from '@/components/groups/share-meal/states';
import { ShareMealTabs } from '@/components/groups/share-meal/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useFriends } from '@/hooks/social/circle/use-friends';
import { useShareDraft } from '@/hooks/social/sharing/use-share-draft';
import { useShareMealWithFriends } from '@/hooks/social/sharing/use-share-meal-with-friends';
import { useShareSubmit } from '@/hooks/social/sharing/use-share-submit';
import { TOTAL_PARTS } from '@/lib/domain/social/splits/parts';

type Mode = 'whole' | 'split';

interface ShareMealDialogProps {
  mealId: string;
  mealName: string;
  totalKcal: number | null;
  trigger: ReactNode;
}

/**
 * Offer a saved meal to specific friends.
 *
 * Twin of the mobile sheet (`share_meal_sheet.dart`) — same information
 * architecture, same rules, desktop affordances. People at the table are pins
 * above the meter; the list below holds only friends who are not, so nobody is
 * ever listed twice and there is no checkmark column to scan.
 */
export function ShareMealDialog({
  mealId,
  mealName,
  totalKcal,
  trigger,
}: ShareMealDialogProps) {
  const t = useTranslations('groups.shareMeal');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('whole');
  const draft = useShareDraft({ you: t('you'), youInitial: t('youInitial') });
  const { seated, seats } = draft;
  // Deferred until the dialog opens: the trigger renders on every meal card,
  // so an always-on query would fan out per card.
  const {
    data: circle = [],
    isPending,
    isError,
    refetch,
  } = useFriends({
    enabled: open,
  });
  const share = useShareMealWithFriends();
  const handleShare = useShareSubmit({
    draft,
    mealId,
    mode,
    share,
    t,
    onDone: () => handleOpenChange(false),
  });

  const friends = useMemo(
    () => circle.filter((m) => m.status === 'accepted'),
    [circle]
  );
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      draft.reset();
      setMode('whole');
    }
  };

  const unseated = useMemo(
    () =>
      friends.filter(
        (m) => !seated.some((s) => s.profile.userId === m.profile.userId)
      ),
    [friends, seated]
  );

  const keptParts = draft.keptParts(mode === 'split');
  const kept =
    totalKcal == null
      ? null
      : Math.round((totalKcal * keptParts) / TOTAL_PARTS);

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {/* One corner family: dialog 16, controls 12, so the nesting reads as
          deliberate rather than as three unrelated radii. */}
      <DialogContent
        aria-describedby={undefined}
        className="gap-0 rounded-2xl border-kallo-border/60 bg-white p-0"
      >
        <DialogHeader className="px-[22px] pt-5">
          <DialogTitle className="font-serif text-[22px] text-kallo-text">
            {t('title')}
          </DialogTitle>
          <p className="truncate font-sans-display text-[13px] text-kallo-text-muted">
            {mealName}
          </p>
        </DialogHeader>

        <div className="px-[22px]">
          <ShareMealTabs
            mode={mode}
            onChange={setMode}
            splitLabel={t('mode.split')}
            wholeLabel={t('mode.whole')}
          />

          <ShareMealDialogStates
            errorBody={t('errorBody')}
            errorTitle={t('errorTitle')}
            emptyBody={t('emptyBody')}
            emptyTitle={t('emptyTitle')}
            hasFriends={friends.length > 0}
            isError={isError}
            isPending={isPending}
            onRetry={refetch}
            retryLabel={t('retry')}
          />

          {!(isPending || isError) && friends.length > 0 && (
            <>
              <ShareMealMeter
                emptyLabel={t('pickSomeone')}
                evenlyLabel={t('splitEvenly')}
                split={mode === 'split'}
                onChange={draft.setParts}
                onRemove={draft.removeSeat}
                onSplitEvenly={draft.splitEvenly}
                seats={seats}
                showEvenly={mode === 'split' && seated.length > 0}
                totalKcal={totalKcal}
              />

              <p className="mt-4 font-sans-display text-[12px] text-kallo-text-muted">
                {t('addSectionTitle')}
              </p>
              <ShareMealAddLane
                atCapacity={draft.atCapacity}
                emptyLabel={t('allAdded')}
                onAdd={draft.add}
                unseated={unseated}
              />
            </>
          )}
        </div>

        <ShareMealDialogFooter
          cancelLabel={t('cancel')}
          disabled={seated.length === 0}
          label={
            seated.length === 0
              ? t('submitEmpty')
              : kept === null
                ? t('submitNoKcal', { count: seated.length })
                : t('submit', { count: seated.length, kcal: kept })
          }
          onCancel={() => handleOpenChange(false)}
          onShare={handleShare}
        />
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  PortionBattery,
  type PortionSeat,
} from '@/components/groups/share-meal/portion-battery';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useFriends } from '@/hooks/social/circle/use-friends';
import {
  useShareMealWithFriends,
  useUndoMealShare,
} from '@/hooks/social/sharing/use-share-meal-with-friends';
import type { CircleMember } from '@/lib/actions/groups/types';
import { cn } from '@/lib/core/ui/cn';
import {
  evenParts,
  MAX_PARTICIPANTS,
  partsAfterAdd,
  partsAfterRemoval,
} from '@/lib/domain/social/splits/parts';

type Mode = 'whole' | 'split';

interface ShareMealDialogProps {
  mealId: string;
  mealName: string;
  totalKcal: number | null;
  trigger: ReactNode;
}

function initialsOf(label: string) {
  const words = label.trim().split(/\s+/u);
  if (words.length >= 2) {
    return (words.at(-2)![0] + words.at(-1)![0]).toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
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
  const [seated, setSeated] = useState<CircleMember[]>([]);
  const [parts, setParts] = useState<number[]>(() => evenParts(2));

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
  const undo = useUndoMealShare();

  const friends = useMemo(
    () => circle.filter((m) => m.status === 'accepted'),
    [circle]
  );
  const unseated = useMemo(
    () =>
      friends.filter(
        (m) => !seated.some((s) => s.profile.userId === m.profile.userId)
      ),
    [friends, seated]
  );

  const reset = () => {
    setSeated([]);
    setParts(evenParts(2));
    setMode('whole');
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const add = (member: CircleMember) => {
    if (seated.length + 1 >= MAX_PARTICIPANTS) return;
    setParts(seated.length === 0 ? evenParts(2) : partsAfterAdd(parts));
    setSeated([...seated, member]);
  };

  const removeSeat = (seat: number) => {
    const nextSeated = seated.filter((_, i) => i !== seat - 1);
    setParts(
      nextSeated.length === 0 ? evenParts(2) : partsAfterRemoval(parts, seat)
    );
    setSeated(nextSeated);
  };

  const seats: PortionSeat[] = [
    {
      id: 'me',
      initials: t('youInitial'),
      label: t('you'),
      parts: parts[0],
    },
    ...seated.map((m, i) => ({
      id: m.profile.userId,
      initials: initialsOf(m.profile.displayName ?? m.profile.handle),
      label: m.profile.displayName ?? m.profile.handle,
      parts: parts[i + 1],
    })),
  ];

  const keptParts = mode === 'split' && seated.length > 0 ? parts[0] : 20;
  const kept =
    totalKcal == null ? null : Math.round((totalKcal * keptParts) / 20);

  const handleShare = () => {
    if (seated.length === 0 || share.isPending) return;
    const isSplit = mode === 'split';
    share.mutate(
      {
        mealId,
        friendUserIds: seated.map((m) => m.profile.userId),
        mode: isSplit ? 'split' : 'copy',
        // ALWAYS send the parts for a split, even an untouched even one.
        //
        // Skipping them on "even" looked like a safe optimisation and was not:
        // 20 is not divisible by 3, so the meter draws an even three-way split
        // as 7/7/6 (35/35/30) while the server's no-parts path divides 20 by 3
        // exactly. The user confirmed one allocation and the database stored a
        // different one. Sending what the meter shows makes the two agree by
        // construction, and the two-person case is 10/10 either way.
        ...(isSplit
          ? {
              myParts: parts[0],
              splits: seated.map((m, i) => ({
                userId: m.profile.userId,
                parts: parts[i + 1],
              })),
            }
          : {}),
      },
      {
        onSuccess: () => {
          toast.success(
            isSplit
              ? t('splitSuccess', { count: seated.length })
              : t('copySuccess', { count: seated.length }),
            isSplit
              ? {
                  action: {
                    label: t('undo'),
                    onClick: () =>
                      undo.mutate(
                        { mealId },
                        { onError: () => toast.error(t('undoFailed')) }
                      ),
                  },
                }
              : undefined
          );
          setOpen(false);
          reset();
        },
        onError: () => toast.error(t('error')),
      }
    );
  };

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
          <div className="mt-3.5 flex h-9 rounded-xl bg-kallo-hover/70 p-[3px]">
            {(['whole', 'split'] as const).map((m) => (
              <button
                aria-pressed={mode === m}
                className={cn(
                  'flex-1 rounded-[9px] font-sans-display text-[13px] transition-colors',
                  mode === m
                    ? 'bg-white text-kallo-text shadow-sm'
                    : 'text-kallo-text-muted'
                )}
                key={m}
                onClick={() => setMode(m)}
                type="button"
              >
                {t(`mode.${m}`)}
              </button>
            ))}
          </div>

          {isPending && <DialogSkeleton />}

          {!isPending && isError && (
            <div className="py-2">
              <SurfaceState
                action={
                  <Button onClick={() => refetch()} size="sm" variant="ink">
                    {t('retry')}
                  </Button>
                }
                area="circle"
                compact
                kind="error"
                subtitle={t('errorBody')}
                title={t('errorTitle')}
              />
            </div>
          )}

          {!(isPending || isError) && friends.length === 0 && (
            <div className="py-2">
              <SurfaceState
                area="circle"
                compact
                kind="empty"
                subtitle={t('emptyBody')}
                title={t('emptyTitle')}
              />
            </div>
          )}

          {!(isPending || isError) && friends.length > 0 && (
            <>
              <div className="mt-4">
                {seated.length === 0 ? (
                  <p className="font-sans-display text-[13px] text-kallo-text-muted">
                    {t('pickSomeone')}
                  </p>
                ) : (
                  <PortionBattery
                    interactive={mode === 'split'}
                    onChange={setParts}
                    onRemove={removeSeat}
                    seats={seats}
                    totalKcal={totalKcal}
                  />
                )}
              </div>

              {mode === 'split' && seated.length > 0 && (
                <div className="flex justify-end">
                  <button
                    className="font-sans-display text-[12px] text-kallo-text"
                    onClick={() => setParts(evenParts(seated.length + 1))}
                    type="button"
                  >
                    {t('splitEvenly')}
                  </button>
                </div>
              )}

              <p className="mt-4 font-sans-display text-[12px] text-kallo-text-muted">
                {t('addSectionTitle')}
              </p>
              <div className="max-h-[150px] overflow-y-auto">
                {unseated.length === 0 ? (
                  <p className="py-3 font-sans-display text-[13px] text-kallo-text-muted">
                    {t('allAdded')}
                  </p>
                ) : (
                  unseated.map((member) => (
                    <button
                      className="flex w-full items-center gap-3 rounded-xl py-2 transition-colors hover:bg-kallo-hover/40 disabled:opacity-45"
                      disabled={seated.length + 1 >= MAX_PARTICIPANTS}
                      key={member.profile.userId}
                      onClick={() => add(member)}
                      type="button"
                    >
                      <span className="flex size-8 items-center justify-center rounded-full bg-kallo-hover font-sans-display text-[12px] text-kallo-text">
                        {initialsOf(
                          member.profile.displayName ?? member.profile.handle
                        )}
                      </span>
                      <span className="truncate font-sans-display text-[14px] text-kallo-text">
                        {member.profile.displayName ?? member.profile.handle}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-3 border-kallo-border/60 border-t px-[22px] py-3.5">
          <Button onClick={() => handleOpenChange(false)} variant="outline">
            {t('cancel')}
          </Button>
          <Button
            disabled={seated.length === 0 || share.isPending}
            onClick={handleShare}
          >
            {share.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {seated.length === 0
              ? t('submitEmpty')
              : kept === null
                ? t('submitNoKcal', { count: seated.length })
                : t('submit', { count: seated.length, kcal: kept })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogSkeleton() {
  return (
    <div className="mt-4 animate-pulse">
      <div className="mx-auto h-5 w-24 rounded-lg bg-kallo-hover" />
      <div className="mt-2.5 h-[46px] rounded-xl bg-kallo-hover" />
      <div className="mt-5 space-y-3">
        <div className="h-8 w-40 rounded-lg bg-kallo-hover" />
        <div className="h-8 w-32 rounded-lg bg-kallo-hover" />
      </div>
    </div>
  );
}

'use client';

import { Loader2, Users2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FriendPickRow } from '@/components/groups/share-meal/friend-pick-row';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useFriends } from '@/hooks/social/circle/use-friends';
import { useShareMealWithFriends } from '@/hooks/social/sharing/use-share-meal-with-friends';
import { cn } from '@/lib/core/ui/cn';

type Mode = 'copy' | 'split';

interface ShareMealDialogProps {
  mealId: string;
  trigger: ReactNode;
}

/**
 * Offer a saved meal to specific friends. Copy sends everyone the full dish;
 * split divides one shared item equally (self + selected friends), reducing the
 * logger's own portion. Recipients accept from their Circle inbox. A successful
 * share invalidates the logging day (the split rescale) via the mutation hook.
 */
export function ShareMealDialog({ mealId, trigger }: ShareMealDialogProps) {
  const t = useTranslations('groups.shareMeal');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('copy');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Defer the friends fetch until the dialog is actually opened — the trigger
  // renders on every meal card, so an always-on query would fan out per card.
  const { data: circle = [], isPending } = useFriends({ enabled: open });
  const share = useShareMealWithFriends();

  const friends = useMemo(
    () => circle.filter((m) => m.status === 'accepted'),
    [circle]
  );

  const reset = () => {
    setSelected(new Set());
    setMode('copy');
  };

  // Reset the draft whenever the dialog closes (cancel or success), so the next
  // open on any card starts clean instead of inheriting a stale selection.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      reset();
    }
  };

  const toggle = (userId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });

  const count = selected.size;
  // The fraction each participant keeps on a split (self + selected friends).
  const portionLabel = count > 0 ? `1/${count + 1}` : '—';

  const handleShare = () => {
    if (count === 0 || share.isPending) {
      return;
    }
    share.mutate(
      { mealId, friendUserIds: Array.from(selected), mode },
      {
        onSuccess: () => {
          toast.success(
            mode === 'split'
              ? t('splitSuccess', { count })
              : t('copySuccess', { count })
          );
          // handleOpenChange resets the draft on close.
          setOpen(false);
          reset();
        },
        onError: () => toast.error(t('error')),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="gap-5 border-kallo-border/60 bg-white"
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-kallo-text text-xl">
            {t('title')}
          </DialogTitle>
        </DialogHeader>

        {/* Mode: full copy vs even split */}
        <div className="grid grid-cols-2 gap-2">
          {(['copy', 'split'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-xl border px-3 py-2.5 text-left transition-colors',
                mode === m
                  ? 'border-kallo-border bg-kallo-hover'
                  : 'border-kallo-border/60 bg-white hover:bg-kallo-hover/40'
              )}
            >
              <span className="block font-medium font-sans-display text-[13px] text-kallo-text">
                {t(`mode.${m}.label`)}
              </span>
              <span className="mt-0.5 block font-sans-display text-[11px] text-kallo-text-muted">
                {t(`mode.${m}.hint`)}
              </span>
            </button>
          ))}
        </div>

        {mode === 'split' && count > 0 && (
          <p className="font-medium font-sans-display text-[12px] text-kallo-text">
            {t('splitPreview', { portion: portionLabel })}
          </p>
        )}

        {/* Friend picker (accepted friends only) */}
        <div className="max-h-[40vh] space-y-1 overflow-y-auto">
          {isPending && (
            <p className="font-sans-display text-[13px] text-kallo-text-muted">
              {t('loadingFriends')}
            </p>
          )}
          {!isPending && friends.length === 0 && (
            <p className="font-sans-display text-[13px] text-kallo-text-muted">
              {t('noFriends')}
            </p>
          )}
          {!isPending &&
            friends.map((member) => (
              <FriendPickRow
                key={member.profile.userId}
                member={member}
                selected={selected.has(member.profile.userId)}
                onToggle={toggle}
              />
            ))}
        </div>

        <button
          type="button"
          onClick={handleShare}
          disabled={count === 0 || share.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-kallo-btn px-4 py-2.5 font-medium font-sans-display text-[14px] text-white transition-colors hover:bg-kallo-btn/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {share.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Users2 className="h-4 w-4" />
          )}
          {count === 0 ? t('submitEmpty') : t('submit', { count })}
        </button>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { Loader2, Share2, Users2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useShareMeal } from '@/hooks/social/use-share-meal';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import { cn } from '@/lib/utils';

// The NL-refine is submitted as `${rawInput} (${correction})` — the joining

export function ShareCardButton({ shareId }: { shareId: string }) {
  const t = useTranslations('groups.shareControl');

  const handleShare = async () => {
    const url = `${window.location.origin}/api/og/macro-card/${shareId}`;
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({ title: t('shareCardTitle'), url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('copiedLink'));
    } catch {
      toast.error(t('errorCopy'));
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium font-sans-display text-[11px] text-nham-text-muted/70 transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
    >
      <Share2 className="h-3.5 w-3.5" />
      {t('shareCard')}
    </button>
  );
}

export function ShareToCircleButton({
  mealId,
  share,
}: {
  mealId: string;
  share: PersistedMeal['share'];
}) {
  const t = useTranslations('groups.shareControl');
  const shareMeal = useShareMeal();
  const [isShared, setIsShared] = useState(
    share != null && share.visibility !== 'private'
  );
  const [shareId, setShareId] = useState<string | null>(
    share && share.visibility !== 'private' ? share.shareId : null
  );

  const handleToggle = () => {
    if (shareMeal.isPending) return;
    const next = isShared ? 'private' : 'circle';
    shareMeal.mutate(
      { mealId, visibility: next },
      {
        onSuccess: (data) => {
          setIsShared(next === 'circle');
          setShareId(next === 'circle' ? data.shareId : null);
        },
        onError: () =>
          toast.error(next === 'circle' ? t('errorShare') : t('errorUnshare')),
      }
    );
  };

  return (
    <div className="flex items-center gap-1.5">
      {isShared && shareId && <ShareCardButton shareId={shareId} />}
      <button
        type="button"
        onClick={handleToggle}
        disabled={shareMeal.isPending}
        aria-pressed={isShared}
        aria-busy={shareMeal.isPending}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          isShared
            ? 'bg-nham-hover font-semibold text-nham-text'
            : 'text-nham-text-muted/70 hover:bg-nham-hover/40 hover:text-nham-text',
          'font-sans-display'
        )}
      >
        {shareMeal.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Users2 className="h-3.5 w-3.5" />
        )}
        {shareMeal.isPending
          ? t('sharing')
          : isShared
            ? t('shared')
            : t('share')}
      </button>
    </div>
  );
}

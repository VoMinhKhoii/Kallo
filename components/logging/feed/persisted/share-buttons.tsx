'use client';

import { Share2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ActionIconButton } from '@/components/logging/feed/action-bar/action-icon-button';
import { useShareMeal } from '@/hooks/social/sharing/use-share-meal';
import type { PersistedMeal } from '@/lib/actions/meals/types';

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
    <ActionIconButton
      icon={Share2}
      label={t('shareCard')}
      onClick={handleShare}
    />
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
          // The icon-only toggle has no text flip to announce the change —
          // confirm it with a toast.
          toast.success(
            next === 'circle' ? t('sharedToast') : t('unsharedToast')
          );
        },
        onError: () =>
          toast.error(next === 'circle' ? t('errorShare') : t('errorUnshare')),
      }
    );
  };

  return (
    <div className="flex items-center gap-1.5">
      {isShared && shareId && <ShareCardButton shareId={shareId} />}
      <ActionIconButton
        icon={Users}
        pending={shareMeal.isPending}
        label={
          shareMeal.isPending
            ? t('sharing')
            : isShared
              ? t('shared')
              : t('share')
        }
        onClick={handleToggle}
        disabled={shareMeal.isPending}
        active={isShared}
        aria-pressed={isShared}
        aria-busy={shareMeal.isPending}
      />
    </div>
  );
}

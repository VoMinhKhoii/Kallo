'use client';

import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ActionIconButton } from '@/components/logging/feed/action-bar/action-icon-button';
import { useShareMeal } from '@/hooks/social/sharing/use-share-meal';
import type { PersistedMeal } from '@/lib/actions/meals/types';

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

  const handleToggle = () => {
    if (shareMeal.isPending) return;
    const next = isShared ? 'private' : 'circle';
    shareMeal.mutate(
      { mealId, visibility: next },
      {
        onSuccess: () => {
          setIsShared(next === 'circle');
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
    <ActionIconButton
      icon={Users}
      pending={shareMeal.isPending}
      label={
        shareMeal.isPending ? t('sharing') : isShared ? t('shared') : t('share')
      }
      onClick={handleToggle}
      disabled={shareMeal.isPending}
      active={isShared}
      aria-pressed={isShared}
      aria-busy={shareMeal.isPending}
    />
  );
}

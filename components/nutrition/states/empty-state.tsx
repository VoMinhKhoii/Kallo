'use client';

import { Sprout } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { EmptyState as UiEmptyState } from '@/components/ui/empty-state';
import { Link } from '@/i18n/navigation';

export function EmptyState() {
  const t = useTranslations('nutrition');

  return (
    <UiEmptyState
      icon={Sprout}
      title={t('emptyV2.title')}
      description={t('emptyV2.description')}
    >
      <Button asChild>
        <Link href="/logging">{t('emptyV2.logMeal')}</Link>
      </Button>
    </UiEmptyState>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { NUTRITION_CAST } from '@/lib/brand/illustrations/casts/nutrition';

export function EmptyState() {
  const t = useTranslations('nutrition');

  return (
    <SurfaceState
      action={
        <Button asChild variant="ink">
          <Link href="/logging">{t('emptyV2.logMeal')}</Link>
        </Button>
      }
      cast={NUTRITION_CAST}
      // Its own block, and centred inside that — not centred against the whole
      // page, which would drift with however much sits above and below it.
      className="min-h-[18rem]"
      kind="empty"
      subtitle={t('emptyV2.description')}
      title={t('emptyV2.title')}
    />
  );
}

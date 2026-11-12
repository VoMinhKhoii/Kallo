'use client';

import { useTranslations } from 'next-intl';

/**
 * Quiet lines under the nutrient grid: which reference intakes the targets come
 * from (WHO/FAO · Vietnam RDA · NASEM DRI) and what they can't tell you. Mirrors
 * the Flutter SourceAttribution's caption and sheet intro, kept text-only on web.
 */
export function SourceAttribution() {
  const t = useTranslations('nutrition');
  return (
    <div className="mx-auto max-w-prose space-y-1 text-center text-[12px] text-kallo-text-muted leading-relaxed">
      <p>{t('grid.sourceNote')}</p>
      <p>{t('grid.sourceDetail')}</p>
    </div>
  );
}

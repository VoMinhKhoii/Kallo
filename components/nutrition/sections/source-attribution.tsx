'use client';

import { useTranslations } from 'next-intl';

/**
 * A quiet line under the nutrient grid attributing the daily targets to
 * recognized reference intakes (WHO/FAO · Vietnam RDA · NASEM DRI). Mirrors the
 * Flutter SourceAttribution's caption, kept text-only on web.
 */
export function SourceAttribution() {
  const t = useTranslations('nutrition');
  return (
    <p className="text-center text-[12px] text-nham-text-muted leading-relaxed">
      {t('grid.sourceNote')}
    </p>
  );
}

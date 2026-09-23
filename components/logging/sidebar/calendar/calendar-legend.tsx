import { useTranslations } from 'next-intl';
import { CalorieRing } from './calorie-ring';

/**
 * The key under the grid: what a green ring and an ink ring mean. Decorative
 * for screen readers — every day button already says it in words.
 */
export function CalendarLegend() {
  const t = useTranslations('logging.timelineSidebar');

  return (
    <div
      aria-hidden="true"
      className="flex min-w-0 items-center gap-3.5 font-sans-display text-[12px] text-kallo-text-muted"
    >
      <span className="flex items-center gap-1.5">
        <CalorieRing fraction={1} met size={14} strokeWidth={2} />
        {t('targetMet')}
      </span>
      <span className="flex items-center gap-1.5">
        <CalorieRing fraction={0.55} met={false} size={14} strokeWidth={2} />
        {t('belowTarget')}
      </span>
    </div>
  );
}

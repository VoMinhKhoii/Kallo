import { PartyPopper } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * The marker that says a post's figures were placed, not measured.
 *
 * A cheat occasion carries no item rows — its numbers come from where the
 * logger put four sliders — so a feed post that looked exactly like a weighed
 * bowl of phở claimed a precision nobody had. This and the `≈` on the calorie
 * figure are the whole difference; everything else about the post is the
 * ordinary anatomy, because it is still a meal someone ate.
 *
 * Sits at the top right of the post's identity row, off the reading path of
 * the name and the meal text. Flutter twin: `cheat_badge.dart`.
 */
export function CheatChip() {
  const t = useTranslations('logging.cheatMealCard');

  return (
    <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-kallo-accent/15 px-2 py-0.5 font-medium font-sans-display text-[10px] text-kallo-text">
      <PartyPopper className="h-3 w-3" />
      {t('badge')}
    </span>
  );
}

import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { mealData } from '@/lib/seo/meal-data/facts';
import { MoreLink } from '../section-text/more-link';

/**
 * Under the comparison pile: the same point measured across every food page,
 * with the way into the data page and the meal pages. A server component, so
 * the figures come from the committed captures without shipping them.
 */
export async function MealDataNote({ locale }: { locale: Locale }) {
  const t = await getTranslations({
    locale,
    namespace: 'landing.understanding.dataNote',
  });
  const { facts } = mealData(locale);

  return (
    <div className="mx-auto max-w-[44rem] px-6 pt-16 text-center font-sans-display text-kallo-text text-xl leading-[1.375] tracking-[-0.025em] sm:px-12 md:pt-24">
      <p>{t('text', { dishes: facts.dishes, ratio: facts.ratio })}</p>
      <p className="mt-4 flex flex-wrap justify-center gap-x-8 gap-y-2 font-semibold">
        <MoreLink href="/data/meal-calorie-variation">{t('numbers')}</MoreLink>
        <MoreLink href="/calories">{t('meals')}</MoreLink>
      </p>
    </div>
  );
}

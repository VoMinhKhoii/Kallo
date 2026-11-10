import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { mealData } from '@/lib/seo/meal-data/facts';
import { MoreLink } from '../section-text/more-link';

/**
 * The comparison section's subtitle: the same point measured across every food
 * page, with the way into the data page and the meal pages. A server
 * component, so the figures come from the committed captures without shipping
 * them; the client section receives it as a prop.
 */
export async function MealDataNote({ locale }: { locale: Locale }) {
  const t = await getTranslations({
    locale,
    namespace: 'landing.understanding.dataNote',
  });
  const { facts } = mealData(locale);

  return (
    <div className="mx-auto mb-8 max-w-2xl text-pretty font-medium text-base text-kallo-text leading-[1.4] tracking-[-0.02em] sm:text-[1.1875rem]">
      <p>{t('text', { dishes: facts.dishes, ratio: facts.ratio })}</p>
      <p className="mt-4 flex flex-wrap justify-center gap-x-8 gap-y-2 font-semibold">
        <MoreLink href="/data/meal-calorie-variation" text={t('numbers')} />
        <MoreLink href="/calories" text={t('meals')} />
      </p>
    </div>
  );
}

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NutritionShell } from '@/components/nutrition/nutrition-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.nutrition');

  return {
    title: t('title'),
  };
}

export default function NutritionPage() {
  return <NutritionShell />;
}

'use client';

import type { Locale } from '@/i18n/config';
import type { ToolSlug } from '@/lib/seo/tools/slugs';
import type { ToolUi } from '@/lib/seo/tools/types';
import { BmiCalculator } from './bmi-calculator';
import type { BodyState } from './body-fields';
import { DeficitCalculator } from './deficit-calculator';
import { MacroCalculator } from './macro-calculator';
import { ProteinCalculator } from './protein-calculator';
import { TdeeCalculator } from './tdee-calculator';

/**
 * Each calculator opens on its page's worked example, so the result is in the
 * server-rendered HTML and matches the text below it. Imperial units are an
 * English-page option; Vietnamese readers measure in kg and cm.
 */
const EXAMPLE: Record<
  Locale,
  { body: BodyState; goalKg: number; kcal: number }
> = {
  en: {
    body: {
      sex: 'female',
      age: 30,
      weightKg: 65,
      heightCm: 165,
      activity: 'light',
    },
    goalKg: 60,
    kcal: 1800,
  },
  vi: {
    body: {
      sex: 'male',
      age: 28,
      weightKg: 68,
      heightCm: 170,
      activity: 'moderate',
    },
    goalKg: 63,
    kcal: 1600,
  },
};

const BMI_EXAMPLE: Record<Locale, BodyState> = {
  en: { ...EXAMPLE.en.body, weightKg: 74, heightCm: 175 },
  vi: { ...EXAMPLE.vi.body, weightKg: 60, heightCm: 160 },
};

const PROTEIN_EXAMPLE_KG: Record<Locale, number> = { en: 70, vi: 55 };

export function ToolCalculator({
  slug,
  locale,
  ui,
}: {
  slug: ToolSlug;
  locale: Locale;
  ui: ToolUi;
}) {
  const tag = locale === 'vi' ? 'vi-VN' : 'en-US';
  const format = (n: number, digits = 0) =>
    n.toLocaleString(tag, {
      minimumFractionDigits: digits === 2 ? 0 : digits,
      maximumFractionDigits: digits,
    });
  const formatDate = (d: Date) =>
    d.toLocaleDateString(tag, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const allowImperial = locale === 'en';
  const example = EXAMPLE[locale];

  switch (slug) {
    case 'tdee-calculator':
      return (
        <TdeeCalculator
          allowImperial={allowImperial}
          format={format}
          initial={example.body}
          ui={ui}
        />
      );
    case 'calorie-deficit-calculator':
      return (
        <DeficitCalculator
          allowImperial={allowImperial}
          format={format}
          formatDate={formatDate}
          initial={example.body}
          initialGoalKg={example.goalKg}
          ui={ui}
        />
      );
    case 'macro-calculator':
      return (
        <MacroCalculator format={format} initialKcal={example.kcal} ui={ui} />
      );
    case 'protein-calculator':
      return (
        <ProteinCalculator
          allowImperial={allowImperial}
          format={format}
          initialWeightKg={PROTEIN_EXAMPLE_KG[locale]}
          ui={ui}
        />
      );
    case 'bmi-calculator':
      return (
        <BmiCalculator
          allowImperial={allowImperial}
          asiaFirst={locale === 'vi'}
          format={format}
          initial={BMI_EXAMPLE[locale]}
          ui={ui}
        />
      );
  }
}

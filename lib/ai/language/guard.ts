import type { MealDecomposition } from '@/lib/ai/types/decomposition';
import type { UserContext } from '@/lib/ai/types/user-context';
import { detectMealInputLanguage } from './detect';

export type LanguageGuardSeverity = 'info' | 'warning' | 'error';
export type LanguageGuardReason =
  | 'matches_output_language'
  | 'expected_english_found_vietnamese'
  | 'expected_vietnamese_found_english'
  | 'uncertain_input_language'
  | 'empty_decomposition';

export interface LanguageGuardResult {
  ok: boolean;
  reason: LanguageGuardReason;
  severity: LanguageGuardSeverity;
}

type LanguageContext = Pick<UserContext, 'inputLanguage' | 'outputLanguage'>;

function decompositionDisplayText(decomposition: MealDecomposition): string {
  const names: string[] = [];

  for (const mealItem of decomposition.mealItems) {
    names.push(mealItem.name);
    for (const ingredient of mealItem.ingredients) {
      const name =
        ingredient.rawName ?? ingredient.name ?? ingredient.canonicalName;
      if (name) names.push(name);
    }
  }

  return names.join(' ');
}

export function checkDecompositionLanguage(
  decomposition: MealDecomposition,
  context: LanguageContext
): LanguageGuardResult {
  if (decomposition.mealItems.length === 0) {
    return { ok: true, reason: 'empty_decomposition', severity: 'info' };
  }

  if (
    context.inputLanguage === 'mixed' ||
    context.inputLanguage === 'unknown' ||
    !context.outputLanguage
  ) {
    return { ok: true, reason: 'uncertain_input_language', severity: 'info' };
  }

  const outputLanguage = detectMealInputLanguage(
    decompositionDisplayText(decomposition)
  );

  if (context.outputLanguage === 'en' && outputLanguage === 'vi') {
    return {
      ok: false,
      reason: 'expected_english_found_vietnamese',
      severity: 'error',
    };
  }

  if (context.outputLanguage === 'vi' && outputLanguage === 'en') {
    return {
      ok: false,
      reason: 'expected_vietnamese_found_english',
      severity: 'error',
    };
  }

  return { ok: true, reason: 'matches_output_language', severity: 'info' };
}

export function buildLanguageCorrectionMessage(
  rawInput: string,
  context: LanguageContext
): string {
  const outputLanguage =
    context.outputLanguage === 'vi' ? 'Vietnamese' : 'English';

  return `${rawInput}\n\nThe previous decomposition used the wrong display language. Retry once and return meal item names, rawName values, and cookingMethod values in ${outputLanguage}. Keep canonicalName DB-friendly and do not emit IDs.`;
}

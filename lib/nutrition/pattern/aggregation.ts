import { getNutrientMeta } from '../catalog/nutrients';
import { getNutrientType } from '../catalog/reference-targets';
import { getConfidenceDisplayState } from './confidence';
import type {
  NutrientCardData,
  NutrientType,
  NutritionNutrientKey,
  TargetSource,
} from '../types';

const TARGET_SOURCE_LABEL_KEYS: Record<TargetSource, string> = {
  vietnam_rda: 'nutrition.targetSources.vietnamRda',
  who_fao: 'nutrition.targetSources.whoFao',
  nasem: 'nutrition.targetSources.nasem',
  unsupported: 'nutrition.targetSources.unsupported',
};

interface SodiumCaveatInput {
  confidence: number;
  faoVietnamCalorieShare: number;
  faoVietnamConfidence: number | null;
  missingSodiumCondimentItems: number;
}

interface BuildNutrientCardInput {
  nutrient: NutritionNutrientKey;
  averagePerDay: number | null;
  target: number | null;
  targetSource: TargetSource;
  confidence: number;
  betaCaroteneAveragePerDay?: number | null;
  caveatKey?: string;
  sourceBreakdown?: NutrientCardData['sourceBreakdown'];
  supportsCandidates?: boolean;
  nutrientType?: NutrientType;
}

export function getPercentOfTarget(
  averagePerDay: number | null,
  target: number | null
): number | null {
  if (averagePerDay === null || target === null || target <= 0) {
    return null;
  }

  return Math.round((averagePerDay / target) * 100);
}

export function getNutrientStatus(
  percentOfTarget: number | null,
  confidence: number,
  // nutrientType is currently informational here; callers explicitly opt in so
  // downstream consumers (UI, summary buckets) can interpret 'above_target'
  // correctly per nutrient direction (floor/ceiling/range).
  _nutrientType: NutrientType = 'floor'
): 'below_target' | 'adequate' | 'above_target' | 'limited_data' {
  if (confidence < 40 || percentOfTarget === null) {
    return 'limited_data';
  }

  if (percentOfTarget < 90) {
    return 'below_target';
  }

  if (percentOfTarget > 110) {
    return 'above_target';
  }

  return 'adequate';
}

export function getSodiumCaveatKey({
  confidence,
  faoVietnamCalorieShare,
  faoVietnamConfidence,
  missingSodiumCondimentItems,
}: SodiumCaveatInput): string | undefined {
  if (confidence < 70) {
    return 'nutrition.caveats.sodium';
  }

  if (missingSodiumCondimentItems > 0) {
    return 'nutrition.caveats.sodium';
  }

  if (
    faoVietnamCalorieShare >= 0.2 &&
    faoVietnamConfidence !== null &&
    faoVietnamConfidence < 70
  ) {
    return 'nutrition.caveats.sodium';
  }

  return undefined;
}

export function buildNutrientCard({
  nutrient,
  averagePerDay,
  target,
  targetSource,
  confidence,
  betaCaroteneAveragePerDay,
  caveatKey,
  sourceBreakdown,
  supportsCandidates = false,
  nutrientType,
}: BuildNutrientCardInput): NutrientCardData {
  const nutrientMeta = getNutrientMeta(nutrient);
  const percentOfTarget = getPercentOfTarget(averagePerDay, target);

  return {
    nutrient,
    labelKey: nutrientMeta.labelKey,
    group: nutrientMeta.group,
    averagePerDay,
    target,
    targetSource,
    targetSourceLabelKey: TARGET_SOURCE_LABEL_KEYS[targetSource],
    unit: nutrientMeta.unit,
    percentOfTarget,
    confidence,
    displayState: getConfidenceDisplayState(confidence),
    nutrientType: nutrientType ?? getNutrientType(nutrient),
    caveatKey,
    contextMetrics:
      nutrient === 'vitaminAMcg'
        ? [
            {
              key: 'betaCaroteneMcg',
              labelKey: getNutrientMeta('betaCaroteneMcg').labelKey,
              averagePerDay: betaCaroteneAveragePerDay ?? null,
              unit: 'mcg',
            },
          ]
        : undefined,
    sourceBreakdown,
    supportsCandidates,
  };
}

import { CARD_NUTRIENTS } from '../../catalog/nutrients';
import type { MicronutrientTarget } from '../../catalog/reference-targets';
import {
  buildNutrientCard,
  getNutrientStatus,
  getSodiumCaveatKey,
} from '../../pattern/aggregation';
import {
  getCaloriesWithNutrientData,
  getNutrientConfidence,
} from '../../pattern/confidence';
import type {
  NutrientCardData,
  NutrientSummaryItem,
  NutritionNutrientKey,
} from '../../types';
import type { OverviewMealItemRow } from './query';
import { sumRows } from './row-metrics';

const FAO_VIETNAM_SOURCE_CODE = 'FAO_VN_2007';
const CONDIMENT_TYPE_EN = 'Condiments, traditional sauces';
const CONDIMENT_TYPE_VN = 'Gia vị, nước chấm';

function getSodiumSourceStats(
  rows: OverviewMealItemRow[],
  totalCalories: number
): {
  confidence: number;
  faoVietnamCalorieShare: number;
  faoVietnamConfidence: number | null;
  missingSodiumCondimentItems: number;
} {
  const faoRows = rows.filter(
    (row) => row.sourceCode === FAO_VIETNAM_SOURCE_CODE
  );
  const faoCalories = faoRows.reduce(
    (sum, row) => sum + Math.max(0, row.calories),
    0
  );
  const faoCaloriesWithSodium = getCaloriesWithNutrientData(
    faoRows.map((row) => ({
      calories: row.calories,
      nutrientValue: row.sodiumMg,
    }))
  );
  const confidence = getNutrientConfidence({
    totalCalories,
    caloriesWithNutrientData: getCaloriesWithNutrientData(
      rows.map((row) => ({
        calories: row.calories,
        nutrientValue: row.sodiumMg,
      }))
    ),
  });

  return {
    confidence,
    faoVietnamCalorieShare: totalCalories > 0 ? faoCalories / totalCalories : 0,
    faoVietnamConfidence:
      faoCalories > 0
        ? getNutrientConfidence({
            totalCalories: faoCalories,
            caloriesWithNutrientData: faoCaloriesWithSodium,
          })
        : null,
    missingSodiumCondimentItems: faoRows.filter(
      (row) =>
        row.sodiumMg === null &&
        (row.typeEn === CONDIMENT_TYPE_EN || row.typeVn === CONDIMENT_TYPE_VN)
    ).length,
  };
}

export function toSummaryItem(
  card: NutrientCardData,
  target: MicronutrientTarget
): NutrientSummaryItem {
  return {
    nutrient: card.nutrient,
    labelKey: card.labelKey,
    average: card.averagePerDay ?? 0,
    unit: card.unit,
    percentOfTarget: card.percentOfTarget,
    confidence: card.confidence,
    status: getNutrientStatus(
      card.percentOfTarget,
      card.confidence,
      target.nutrientType
    ),
    applicability: target.applicability,
    nutrientType: target.nutrientType,
  };
}

export function buildNutrientCards({
  rows,
  targets,
  totalCalories,
  safeLoggedDays,
}: {
  rows: OverviewMealItemRow[];
  targets: Record<NutritionNutrientKey, MicronutrientTarget>;
  totalCalories: number;
  safeLoggedDays: number;
}): NutrientCardData[] {
  const sodiumStats = getSodiumSourceStats(rows, totalCalories);

  return CARD_NUTRIENTS.map((nutrient) => {
    const target = targets[nutrient];
    const nutrientRows = rows.map((row) => ({
      calories: row.calories,
      nutrientValue: row[nutrient],
    }));
    const confidence = getNutrientConfidence({
      totalCalories,
      caloriesWithNutrientData: getCaloriesWithNutrientData(nutrientRows),
    });
    const averagePerDay = sumRows(rows, nutrient) / safeLoggedDays;
    const betaCaroteneAveragePerDay =
      nutrient === 'vitaminAMcg'
        ? sumRows(rows, 'betaCaroteneMcg') / safeLoggedDays
        : undefined;
    const sourceBreakdown =
      nutrient === 'sodiumMg'
        ? {
            faoVietnamCalorieShare: sodiumStats.faoVietnamCalorieShare,
            faoVietnamConfidence: sodiumStats.faoVietnamConfidence,
            missingSodiumCondimentItems:
              sodiumStats.missingSodiumCondimentItems,
          }
        : undefined;

    return buildNutrientCard({
      nutrient,
      averagePerDay,
      target: target.value,
      targetSource: target.source,
      confidence,
      betaCaroteneAveragePerDay,
      caveatKey:
        nutrient === 'sodiumMg' ? getSodiumCaveatKey(sodiumStats) : undefined,
      sourceBreakdown,
      nutrientType: target.nutrientType,
    });
  });
}

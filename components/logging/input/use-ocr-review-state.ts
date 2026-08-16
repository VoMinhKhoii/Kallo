import { useState } from 'react';
import {
  type NutritionValues,
  nutritionValuesSchema,
  OCR_NUTRIENT_KEYS,
  type OcrQuantityUnit,
  type ParsedNutritionLabel,
} from '@/lib/nutrition/ocr-schema';

function emptyNutrition(): NutritionValues {
  return Object.fromEntries(
    OCR_NUTRIENT_KEYS.map((key) => [key, null])
  ) as NutritionValues;
}

function getReviewColumn(data: ParsedNutritionLabel | null): {
  values: NutritionValues;
  referenceAmount: number;
  unit: OcrQuantityUnit;
} {
  if (!data) {
    return { values: emptyNutrition(), referenceAmount: 1, unit: 'serving' };
  }
  if (data.basis === 'per_100g') {
    return { values: data.per100g, referenceAmount: 100, unit: 'g' };
  }
  if (data.basis === 'per_100ml') {
    return { values: data.per100ml, referenceAmount: 100, unit: 'ml' };
  }
  if (data.basis === 'per_container') {
    return {
      values: data.perContainer,
      referenceAmount: data.netContent.value,
      unit: data.netContent.unit,
    };
  }
  if (data.servingSize) {
    return {
      values: data.perServing,
      referenceAmount: data.servingSize.value,
      unit: data.servingSize.unit,
    };
  }
  return { values: data.perServing, referenceAmount: 1, unit: 'serving' };
}

export function parseLocaleDecimal(value: string): number | null {
  const trimmed = value.trim().replace(/\s/g, '');
  if (!trimmed || !/^\d+(?:[.,]\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatInputNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function getShortcuts(
  data: ParsedNutritionLabel | null,
  unit: OcrQuantityUnit
) {
  const serving = data?.servingSize;
  const servingAmount =
    serving?.unit === unit ? serving.value : unit === 'serving' ? 1 : null;
  let packageAmount: number | null = null;
  if (data?.basis === 'per_container' && data.netContent.unit === unit) {
    packageAmount = data.netContent.value;
  } else if (servingAmount && data?.servingsPerContainer) {
    packageAmount = servingAmount * data.servingsPerContainer;
  }
  return { servingAmount, packageAmount };
}

export function useOcrReviewState(
  data: ParsedNutritionLabel | null,
  defaultProductName: string
) {
  const reviewColumn = getReviewColumn(data);
  const [productName, setProductName] = useState(
    data?.productName || defaultProductName
  );
  const [amountText, setAmountText] = useState(
    formatInputNumber(reviewColumn.referenceAmount)
  );
  const [appliedAmount, setAppliedAmount] = useState(
    reviewColumn.referenceAmount
  );
  const [nutrientTexts, setNutrientTexts] = useState<
    Record<keyof NutritionValues, string>
  >(
    () =>
      Object.fromEntries(
        OCR_NUTRIENT_KEYS.map((key) => [
          key,
          reviewColumn.values[key] === null
            ? ''
            : formatInputNumber(reviewColumn.values[key]),
        ])
      ) as Record<keyof NutritionValues, string>
  );

  const parsedAmount = parseLocaleDecimal(amountText);
  const amountIsValid =
    parsedAmount !== null && parsedAmount > 0 && parsedAmount <= 100_000;
  const amountScale = amountIsValid ? parsedAmount / appliedAmount : 1;
  const getNutrientValue = (key: keyof NutritionValues) => {
    const parsed = parseLocaleDecimal(nutrientTexts[key]);
    return parsed === null
      ? null
      : Math.round(parsed * amountScale * 100) / 100;
  };
  const nutrition = Object.fromEntries(
    OCR_NUTRIENT_KEYS.map((key) => [key, getNutrientValue(key)])
  ) as NutritionValues;
  const nutrientParseFailures = new Set(
    OCR_NUTRIENT_KEYS.filter(
      (key) =>
        nutrientTexts[key].trim() !== '' &&
        parseLocaleDecimal(nutrientTexts[key]) === null
    )
  );
  const parsedNutrition = nutritionValuesSchema.safeParse(nutrition);
  const fieldErrors = parsedNutrition.success
    ? {}
    : parsedNutrition.error.flatten().fieldErrors;
  const requiredValues = [
    nutrition.calories,
    nutrition.proteinGrams,
    nutrition.carbsGrams,
    nutrition.fatGrams,
  ];
  const productIsValid =
    productName.trim().length > 0 && productName.trim().length <= 200;
  const canConfirm =
    amountIsValid &&
    productIsValid &&
    nutrientParseFailures.size === 0 &&
    parsedNutrition.success &&
    requiredValues.every((value) => value !== null);

  const commitAmount = (nextText = amountText) => {
    const nextAmount = parseLocaleDecimal(nextText);
    if (nextAmount === null || nextAmount <= 0 || nextAmount > 100_000) return;
    const scale = nextAmount / appliedAmount;
    setNutrientTexts(
      (current) =>
        Object.fromEntries(
          OCR_NUTRIENT_KEYS.map((key) => {
            const value = parseLocaleDecimal(current[key]);
            return [
              key,
              value === null ? '' : formatInputNumber(value * scale),
            ];
          })
        ) as Record<keyof NutritionValues, string>
    );
    setAppliedAmount(nextAmount);
    setAmountText(formatInputNumber(nextAmount));
  };

  return {
    initialNutrition: reviewColumn.values,
    productName,
    setProductName,
    productIsValid,
    amountText,
    setAmountText,
    parsedAmount,
    amountIsValid,
    unit: reviewColumn.unit,
    commitAmount,
    servingAmount: getShortcuts(data, reviewColumn.unit).servingAmount,
    packageAmount: getShortcuts(data, reviewColumn.unit).packageAmount,
    getNutrientText: (key: keyof NutritionValues) => nutrientTexts[key],
    setNutrientText: (key: keyof NutritionValues, value: string) =>
      setNutrientTexts((current) => ({ ...current, [key]: value })),
    getNutrientValue,
    nutrientHasError: (key: keyof NutritionValues) =>
      nutrientParseFailures.has(key) ||
      (nutrientTexts[key] !== '' && Boolean(fieldErrors[key]?.length)),
    nutrition,
    canConfirm,
    servingDescription: data?.servingSizeDescription ?? null,
    servingsPerContainer: data?.servingsPerContainer ?? null,
  };
}

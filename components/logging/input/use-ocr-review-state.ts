import { useState } from 'react';
import type {
  NutritionValues,
  ParsedNutritionLabel,
} from '@/lib/nutrition/ocr-schema';

export function useOcrReviewState(data: ParsedNutritionLabel) {
  const defaultServing = data.servingSizeGrams ?? 100;
  const [productName, setProductName] = useState(
    data.productName || 'Scanned Packaged Food'
  );
  const [grams, setGrams] = useState(defaultServing);

  const p100 = data.per100g;
  const pSrv = data.perServing;
  const baseCal = p100?.calories ?? pSrv?.calories ?? 0;
  const baseProtein = p100?.proteinGrams ?? pSrv?.proteinGrams ?? 0;
  const baseCarbs = p100?.carbsGrams ?? pSrv?.carbsGrams ?? 0;
  const baseFat = p100?.fatGrams ?? pSrv?.fatGrams ?? 0;

  const getBaseValue = (key: keyof NutritionValues) =>
    p100?.[key] ?? pSrv?.[key] ?? null;
  const baseWeight = data.per100g
    ? 100
    : defaultServing > 0
      ? defaultServing
      : 100;
  const scaleRatio = grams / baseWeight;

  const [calories, setCalories] = useState(Math.round(baseCal * scaleRatio));
  const [proteinGrams, setProtein] = useState(
    Math.round(baseProtein * scaleRatio * 10) / 10
  );
  const [carbsGrams, setCarbs] = useState(
    Math.round(baseCarbs * scaleRatio * 10) / 10
  );
  const [fatGrams, setFat] = useState(
    Math.round(baseFat * scaleRatio * 10) / 10
  );

  const handleGramsChange = (newGrams: number) => {
    const validGrams = Math.max(1, newGrams);
    setGrams(validGrams);
    const newRatio = validGrams / baseWeight;
    setCalories(Math.round(baseCal * newRatio));
    setProtein(Math.round(baseProtein * newRatio * 10) / 10);
    setCarbs(Math.round(baseCarbs * newRatio * 10) / 10);
    setFat(Math.round(baseFat * newRatio * 10) / 10);
  };

  const scaleMicro = (val: number | null | undefined) =>
    val != null ? Math.round(val * scaleRatio * 10) / 10 : null;

  const unit = data.servingSizeUnit ?? 'g';

  return {
    productName,
    setProductName,
    grams,
    unit,
    handleGramsChange,
    calories,
    setCalories,
    proteinGrams,
    setProtein,
    carbsGrams,
    setCarbs,
    fatGrams,
    setFat,
    getBaseValue,
    scaleMicro,
  };
}

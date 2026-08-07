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

  // Pick one column so every value shares a single base weight.
  const useServingColumn = !data.per100g && !!data.perServing;
  const base = useServingColumn ? data.perServing : data.per100g;
  const baseWeight =
    useServingColumn && defaultServing > 0 ? defaultServing : 100;

  const baseCal = base?.calories ?? 0;
  const baseProtein = base?.proteinGrams ?? 0;
  const baseCarbs = base?.carbsGrams ?? 0;
  const baseFat = base?.fatGrams ?? 0;

  const getBaseValue = (key: keyof NutritionValues) => base?.[key] ?? null;
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

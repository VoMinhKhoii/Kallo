import type {
  MealEntry,
  Micronutrient,
  NutritionData,
  StatsData,
  TimeRange,
  VerdictData,
} from './types';

export function getVerdictData(): VerdictData {
  return {
    weeklyRate: -0.4,
    totalDelta: -2.8,
    planStartDate: '2026-03-01',
    status: 'on_pace',
    rollingAvg: { start: 69.6, end: 69.2 },
    currentWeight: 69.2,
    proteinDays: [true, true, false, true, true, false, true],
  };
}

export function getStatsData(): StatsData {
  return {
    streak: 12,
    daysLogged: 24,
    avgDeficit: -450,
    todayWeight: null,
    weightPlaceholder: 69.2,
  };
}

export function getWeightData(range: TimeRange): number[] {
  // 90 days of weight data, trending down ~0.4 kg/week from 72.8
  const full = [
    72.8, 72.6, 72.7, 72.4, 72.5, 72.3, 72.1, 72.0, 72.2, 71.9, 71.8, 72.0,
    71.7, 71.6, 71.5, 71.7, 71.4, 71.3, 71.4, 71.1, 71.0, 70.8, 70.9, 70.7,
    70.9, 70.6, 70.5, 70.6, 70.4, 70.3, 70.5, 70.2, 70.1, 70.3, 70.0, 69.9,
    70.1, 69.8, 69.7, 69.9, 69.6, 69.5, 69.7, 69.4, 69.3, 69.5, 69.2, 69.1,
    69.3, 69.0, 68.9, 69.1, 68.8, 68.7, 68.9, 68.6, 68.5, 68.7, 68.4, 68.3,
    68.5, 68.2, 68.1, 68.3, 68.0, 67.9, 68.1, 67.8, 67.7, 67.9, 67.6, 67.5,
    67.7, 67.4, 67.3, 67.5, 67.2, 67.1, 67.3, 67.0, 66.9, 67.1, 66.8, 66.7,
    66.9, 66.6, 66.5, 66.7, 66.4, 66.3,
  ];
  if (range === '30d') return full.slice(-30);
  return full;
}

/** Extra chart context for weight chart zones */
export function getWeightChartMeta(range: TimeRange) {
  const data = getWeightData(range);
  const periodStartWeight = data[0];
  const weeks = range === '30d' ? 4.3 : 12.9;
  const expectedEndWeight = periodStartWeight - 0.4 * weeks;
  return {
    periodStartWeight,
    expectedEndWeight,
    goalDirection: 'down' as const,
  };
}

/** Returns transposed heatmap: 7 rows (M→S) × N columns (weeks) */
export function getHeatmapData(range: TimeRange): (number | null)[][] {
  // Raw data: rows = weeks, cols = days (M-S)
  const allWeeks: (number | null)[][] = [
    [0.91, 0.87, 0.93, 0.89, 0.95, 0.72, 0.85],
    [0.78, null, 0.92, 0.96, 0.88, 0.61, 0.9],
    [0.94, 0.91, 0.85, 0.9, 0.93, 0.68, 0.87],
    [0.97, 0.89, 0.76, null, 0.91, 0.82, 0.93],
    [0.86, 0.94, 0.98, 0.92, 0.8, 0.58, 0.84],
    [0.93, 0.88, 0.91, 0.95, 0.87, null, 0.89],
    [0.9, 0.82, 0.96, 0.88, 0.94, 0.73, 0.91],
    [0.85, 0.97, 0.79, 0.93, 0.9, 0.66, 0.88],
    [0.92, 0.86, 0.94, 0.91, 0.83, 0.7, 0.95],
    [0.99, 0.92, 0.78, 0.95, 0.88, 0.65, 0.82],
    [0.96, 0.84, 1.0, 0.91, 0.74, null, 0.88],
    [0.88, 0.93, 0.81, 0.97, 0.91, 0.7, 0.94],
    [0.99, 0.92, 1.17, null, 0.97, 1.28, 0.31],
  ];
  const weeks = range === '30d' ? allWeeks.slice(9) : allWeeks;
  // Transpose: 7 rows (days) × N columns (weeks)
  return Array.from({ length: 7 }, (_, dayIdx) =>
    weeks.map((week) => week[dayIdx])
  );
}

export function getNutritionData(): NutritionData {
  return {
    calories: { current: 553, target: 1800 },
    protein: { current: 38, target: 140 },
    carbs: { current: 62, target: 180 },
    fat: { current: 18, target: 60 },
  };
}

const PRIORITY_KEYS = [
  'fiber',
  'iron',
  'calcium',
  'vitD',
  'vitB12',
  'potassium',
];

export function getPriorityKeys(): string[] {
  return PRIORITY_KEYS;
}

export function getMicronutrients(): Micronutrient[] {
  return [
    // Other
    {
      key: 'fiber',
      name: 'Fiber',
      unit: 'g',
      current: 18,
      target: 30,
      group: 'other',
    },
    {
      key: 'betaCarotene',
      name: 'Beta-carotene',
      unit: 'mcg',
      current: 4200,
      target: 6000,
      group: 'other',
    },
    // Minerals
    {
      key: 'iron',
      name: 'Iron',
      unit: 'mg',
      current: 12,
      target: 18,
      group: 'mineral',
    },
    {
      key: 'calcium',
      name: 'Calcium',
      unit: 'mg',
      current: 680,
      target: 1000,
      group: 'mineral',
    },
    {
      key: 'potassium',
      name: 'Potassium',
      unit: 'mg',
      current: 2800,
      target: 3500,
      group: 'mineral',
    },
    {
      key: 'magnesium',
      name: 'Magnesium',
      unit: 'mg',
      current: 280,
      target: 400,
      group: 'mineral',
    },
    {
      key: 'zinc',
      name: 'Zinc',
      unit: 'mg',
      current: 9,
      target: 11,
      group: 'mineral',
    },
    {
      key: 'sodium',
      name: 'Sodium',
      unit: 'mg',
      current: 1800,
      target: 2300,
      group: 'mineral',
    },
    {
      key: 'phosphorus',
      name: 'Phosphorus',
      unit: 'mg',
      current: 900,
      target: 1000,
      group: 'mineral',
    },
    {
      key: 'copper',
      name: 'Copper',
      unit: 'mcg',
      current: 700,
      target: 900,
      group: 'mineral',
    },
    {
      key: 'manganese',
      name: 'Manganese',
      unit: 'mg',
      current: 1.8,
      target: 2.3,
      group: 'mineral',
    },
    // Vitamins
    {
      key: 'vitD',
      name: 'Vitamin D',
      unit: 'mcg',
      current: 8,
      target: 15,
      group: 'vitamin',
    },
    {
      key: 'vitB12',
      name: 'B12',
      unit: 'mcg',
      current: 2.1,
      target: 2.4,
      group: 'vitamin',
    },
    {
      key: 'vitC',
      name: 'Vitamin C',
      unit: 'mg',
      current: 72,
      target: 90,
      group: 'vitamin',
    },
    {
      key: 'vitA',
      name: 'Vitamin A',
      unit: 'mcg',
      current: 650,
      target: 900,
      group: 'vitamin',
    },
    {
      key: 'vitE',
      name: 'Vitamin E',
      unit: 'mg',
      current: 10,
      target: 15,
      group: 'vitamin',
    },
    {
      key: 'vitK',
      name: 'Vitamin K',
      unit: 'mcg',
      current: 85,
      target: 120,
      group: 'vitamin',
    },
    {
      key: 'vitB1',
      name: 'B1',
      unit: 'mg',
      current: 0.9,
      target: 1.2,
      group: 'vitamin',
    },
    {
      key: 'vitB2',
      name: 'B2',
      unit: 'mg',
      current: 1.0,
      target: 1.3,
      group: 'vitamin',
    },
    {
      key: 'vitPP',
      name: 'B3',
      unit: 'mg',
      current: 12,
      target: 16,
      group: 'vitamin',
    },
    {
      key: 'vitB5',
      name: 'B5',
      unit: 'mg',
      current: 3.5,
      target: 5,
      group: 'vitamin',
    },
    {
      key: 'vitB6',
      name: 'B6',
      unit: 'mg',
      current: 1.1,
      target: 1.5,
      group: 'vitamin',
    },
    {
      key: 'vitB9',
      name: 'Folate',
      unit: 'mcg',
      current: 320,
      target: 400,
      group: 'vitamin',
    },
    {
      key: 'vitH',
      name: 'Biotin',
      unit: 'mcg',
      current: 22,
      target: 30,
      group: 'vitamin',
    },
  ];
}

export function getMealsToday(): MealEntry[] {
  return [
    { id: '1', label: 'Phở bò đặc biệt, 1 tô lớn', calories: 480 },
    { id: '2', label: 'Cà phê sữa đá', calories: 120 },
    { id: '3', label: 'Bánh mì thịt nguội', calories: 320 },
    { id: '4', label: 'Cơm gà xối mỡ', calories: 550 },
  ];
}

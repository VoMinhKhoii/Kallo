import { z } from 'zod';

export const nutritionSchema = z.object({
  name: z.string(),
  name_en: z.string().optional().default(''),
  value: z.number().nullable(),
  unit: z
    .string()
    .nullable()
    .transform((value) => value ?? ''),
});

export const snapshotRowSchema = z.object({
  _id: z.string(),
  code: z.string(),
  name_vi: z.string().min(1),
  name_en: z.string().nullish(),
  category: z.string().min(1),
  categoryEn: z.string().nullish(),
  nutrition: z.array(nutritionSchema),
  energy: z.number(),
});

export const snapshotSchema = z.array(snapshotRowSchema).length(853);

export type SnapshotRow = z.infer<typeof snapshotRowSchema>;
export type FoodLabel = 'ingredient' | 'composite' | 'bowl' | 'condiment-broth';

export interface NormalizedRow extends SnapshotRow {
  name_en: string;
  categoryEn: string;
  nutrients: Record<string, number | null>;
  protein: number | null;
  fat: number | null;
  carbohydrate: number | null;
  water: number | null;
  fiber: number | null;
  alcohol: number | null;
}

export interface ConstructedRow {
  id: string;
  code: string;
  namePrimary: string;
  nameAlt: string[];
  nameEn: string;
  typeVn: string;
  typeEn: string;
  state: 'raw' | 'cooked';
  caloriesKcal: number;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
  fiberG: number | null;
  waterG: number | null;
}

export interface DbNameRow {
  id: string;
  namePrimary: string;
  nameAlt: string[];
  source: 'fao' | 'usda' | 'other';
}

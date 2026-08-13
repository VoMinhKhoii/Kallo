import { z } from 'zod';

export const NIN_SOURCE_CODE = 'NIN_WEB_2026';
export const NIN_SOURCE_NAME =
  'National Institute of Nutrition web snapshot (2026-08-12)';
export const NIN_SNAPSHOT_DATE = '2026-08-12';

const sourceIdSchema = z.string().trim().min(1);
const nutrientValueSchema = z
  .number()
  .transform((value) => (value >= -0.05 && value < 0 ? 0 : value))
  .pipe(z.number().nonnegative());

export const nutritionSchema = z.object({
  name: z.string(),
  name_en: z.string().optional().default(''),
  value: nutrientValueSchema.nullable(),
  unit: z
    .string()
    .nullable()
    .transform((value) => value ?? ''),
});

export const snapshotRowSchema = z.object({
  _id: sourceIdSchema,
  code: sourceIdSchema,
  name_vi: z.string().min(1),
  name_en: z.string().nullish(),
  category: z.string().min(1),
  categoryEn: z.string().nullish(),
  nutrition: z.array(nutritionSchema),
  energy: z.number().nonnegative(),
});

export const snapshotSchema = z.array(snapshotRowSchema).length(853);

export const dbNameRowSchema = z.object({
  id: sourceIdSchema,
  namePrimary: z.string(),
  nameAlt: z.array(z.string().min(1)),
  source: z.enum(['fao', 'usda', 'other']),
});

export const insertedIdsSchema = z.array(
  sourceIdSchema.regex(/^nin_web_[a-zA-Z0-9_]+$/)
);

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

export type DbNameRow = z.infer<typeof dbNameRowSchema>;

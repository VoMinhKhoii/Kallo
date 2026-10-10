import { describe, expect, it } from 'vitest';
import { mealDecompositionV2Schema } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import { groundedEstimationSchema } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import {
  isEmptyFoodAnswer,
  repairPipelineOutput,
  toClaudeSchema,
  withoutEmptyStrings,
} from '../schema';

describe('toClaudeSchema', () => {
  it('drops the keywords Claude rejects and closes every object', () => {
    const out = toClaudeSchema({
      type: 'object',
      description: 'meal',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 80 },
        grams: { type: 'number', minimum: 0, exclusiveMinimum: 0 },
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: { id: { type: 'string', pattern: '^c' } },
          },
        },
      },
      required: ['name'],
    });
    expect(out).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        grams: { type: 'number' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: { id: { type: 'string' } },
          },
        },
      },
      required: ['name'],
    });
  });
});

describe('withoutEmptyStrings', () => {
  it('removes empty-string values at any depth', () => {
    expect(
      withoutEmptyStrings({ a: '', b: 'x', c: [{ d: '', e: 1 }] })
    ).toEqual({
      b: 'x',
      c: [{ e: 1 }],
    });
  });
});

describe('repairPipelineOutput', () => {
  it('fixes the value slips Claude cannot be held to by the schema', () => {
    const out = repairPipelineOutput({
      isFood: true,
      mealItems: [
        {
          name: 'Phở bò',
          ingredients: [
            {
              rawName: 'bánh phở',
              canonicalName: 'Rice noodles',
              explicitMass: { grams: 0, basis: 'edible' },
              prepNotes: ['x'.repeat(90)],
            },
          ],
        },
        { name: 'Empty', cookingMethod: 'luộc', ingredients: [] },
        {
          mealItemName: 'Cơm',
          ingredients: [
            {
              ingredientName: 'Cơm',
              grossG: 150,
              refusePct: 95,
              rejectReason: 'y'.repeat(200),
            },
          ],
        },
      ],
    }) as {
      mealItems: Array<
        Record<string, unknown> & {
          ingredients: Array<Record<string, unknown>>;
        }
      >;
    };

    expect(out.mealItems).toHaveLength(2);
    const [pho, rice] = out.mealItems;
    expect(pho.cookingMethod).toBe('');
    expect(pho.ingredients[0].explicitMass).toBeUndefined();
    // nameVi is not filled in: it is optional, and absent on main's schema.
    expect('nameVi' in pho.ingredients[0]).toBe(false);
    expect((pho.ingredients[0].prepNotes as string[])[0]).toHaveLength(60);
    expect(rice.ingredients[0].refusePct).toBe(80);
    expect(rice.ingredients[0].rejectReason as string).toHaveLength(120);
    expect('nameVi' in rice.ingredients[0]).toBe(false);
  });

  it('keeps valid answers valid against the real pipeline schemas', () => {
    const call1 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'Phở bò',
          cookingMethod: 'boiled',
          ingredients: [{ rawName: 'bánh phở', canonicalName: 'Rice noodles' }],
        },
      ],
    };
    const call2 = {
      mealItems: [
        {
          mealItemName: 'Phở bò',
          ingredients: [
            {
              ingredientName: 'bánh phở',
              selectedCandidateId: 'c1',
              grossG: 200,
              refusePct: 0,
              proteinG: { low: 1, mid: 2, high: 3 },
              carbohydrateG: { low: 40, mid: 45, high: 50 },
              fatG: { low: 0, mid: 1, high: 2 },
            },
          ],
        },
      ],
    };
    expect(mealDecompositionV2Schema.safeParse(call1).success).toBe(true);
    expect(groundedEstimationSchema.safeParse(call2).success).toBe(true);
    expect(
      mealDecompositionV2Schema.safeParse(
        repairPipelineOutput(structuredClone(call1))
      ).success
    ).toBe(true);
    expect(
      groundedEstimationSchema.safeParse(
        repairPipelineOutput(structuredClone(call2))
      ).success
    ).toBe(true);
  });

  it('leaves non-pipeline shapes alone', () => {
    expect(repairPipelineOutput({ label: 'x' })).toEqual({ label: 'x' });
    expect(repairPipelineOutput(null)).toBeNull();
  });
});

describe('isEmptyFoodAnswer', () => {
  it('flags a food answer with no meal items only', () => {
    expect(isEmptyFoodAnswer({ isFood: true, mealItems: [] })).toBe(true);
    expect(isEmptyFoodAnswer({ isFood: false, mealItems: [] })).toBe(false);
    expect(isEmptyFoodAnswer({ isFood: true, mealItems: [{}] })).toBe(false);
  });
});

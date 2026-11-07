/** Call 2 renaming an ingredient inside its own dish must not ship it at 0 g. */
import { describe, expect, it } from 'vitest';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import { pairIngredientsWithGrounded } from '@/lib/ai/pipeline/resolve/verdicts';

const meal = (dishes: Record<string, string[]>) =>
  ({
    isFood: true,
    mealSlot: 'lunch',
    mealItems: Object.entries(dishes).map(([name, parts]) => ({
      name,
      cookingMethod: 'nấu',
      ingredients: parts.map((rawName) => ({
        rawName,
        canonicalName: rawName,
      })),
    })),
  }) as MealDecompositionV2;

const answer = (dishes: Record<string, Array<[string, number]>>) =>
  ({
    mealItems: Object.entries(dishes).map(([mealItemName, parts]) => ({
      mealItemName,
      ingredients: parts.map(([ingredientName, grossG]) => ({
        ingredientName,
        grossG,
      })),
    })),
  }) as unknown as GroundedEstimation;

const grams = (
  dishes: Record<string, string[]>,
  a: Record<string, Array<[string, number]>>
) =>
  pairIngredientsWithGrounded(meal(dishes), answer(a)).map(
    (p) => p.ground?.grossG ?? null
  );

describe('an ingredient renamed inside its dish', () => {
  it('pairs on a shared word', () => {
    expect(
      grams(
        { 'Cơm gà': ['Jasmine rice', 'Gà'] },
        {
          'Cơm gà': [
            ['Gà', 120],
            ['Jasmine rice, cooked', 200],
          ],
        }
      )
    ).toEqual([200, 120]);
  });

  it('pairs the last one left when no word is shared', () => {
    expect(
      grams(
        { 'Mì gói': ['Hảo Hảo tôm chua cay', 'Trứng'] },
        {
          'Mì gói': [
            ['Mì ăn liền', 75],
            ['Trứng', 50],
          ],
        }
      )
    ).toEqual([75, 50]);
  });

  it('does not treat a repeated estimate as a rename', () => {
    expect(
      grams(
        { 'Bánh flan': ['Trứng', 'Sữa'] },
        {
          'Bánh flan': [
            ['Trứng', 50],
            ['Trứng', 50],
          ],
        }
      )
    ).toEqual([50, null]);
  });

  it('does not let a repeat match a sibling through a shared word', () => {
    expect(
      grams(
        { 'Gà nướng': ['Chicken breast', 'Chicken thigh'] },
        {
          'Gà nướng': [
            ['Chicken breast', 120],
            ['Chicken breast', 120],
          ],
        }
      )
    ).toEqual([120, null]);
  });

  it('lets a repeated rename answer one food only', () => {
    expect(
      grams(
        { 'Cơm trứng': ['Jasmine rice', 'Egg', 'Oil'] },
        {
          'Cơm trứng': [
            ['Jasmine rice, cooked', 200],
            ['Jasmine rice, cooked', 200],
            ['Egg', 50],
          ],
        }
      )
    ).toEqual([200, 50, null]);
  });

  it('never crosses into another dish', () => {
    expect(
      grams(
        { 'Món A': ['Bún'], 'Món B': ['Phở'] },
        { 'Món A': [['Hủ tiếu', 100]] }
      )
    ).toEqual([100, null]);
  });

  it('leaves two unrelated names unpaired rather than guess', () => {
    expect(
      grams(
        { 'Món A': ['Bún', 'Phở'] },
        {
          'Món A': [
            ['Hủ tiếu', 100],
            ['Miến', 90],
          ],
        }
      )
    ).toEqual([null, null]);
  });
});

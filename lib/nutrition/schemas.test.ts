import { describe, expect, it } from 'vitest';
import {
  foodSourceCandidatesInputSchema,
  nutritionOverviewInputSchema,
  nutritionRangeSchema,
  timezoneOffsetSchema,
} from './schemas';

describe('nutrition overview schema', () => {
  it('accepts auto range with a nullable timezone offset', () => {
    expect(
      nutritionOverviewInputSchema.parse({
        range: 'auto',
        timezoneOffset: null,
      })
    ).toEqual({
      range: 'auto',
      timezoneOffset: null,
    });
  });

  it('rejects invalid ranges', () => {
    expect(
      nutritionOverviewInputSchema.safeParse({
        range: '365d',
        timezoneOffset: null,
      }).success
    ).toBe(false);
    expect(nutritionRangeSchema.safeParse('365d').success).toBe(false);
  });
});

describe('food source candidates schema', () => {
  it('accepts supported candidate nutrient keys', () => {
    expect(
      foodSourceCandidatesInputSchema.parse({
        nutrient: 'ironMg',
      })
    ).toEqual({
      nutrient: 'ironMg',
    });
  });

  it('rejects unsupported candidate nutrients', () => {
    expect(
      foodSourceCandidatesInputSchema.safeParse({
        nutrient: 'magnesiumMg',
      }).success
    ).toBe(false);
  });
});

describe('timezone offset schema', () => {
  it('accepts documented min and max bounds', () => {
    expect(timezoneOffsetSchema.parse(-840)).toBe(-840);
    expect(timezoneOffsetSchema.parse(720)).toBe(720);
  });

  it('rejects values outside the supported bounds', () => {
    expect(timezoneOffsetSchema.safeParse(-841).success).toBe(false);
    expect(timezoneOffsetSchema.safeParse(721).success).toBe(false);
  });
});

describe('timezone offset schema', () => {
  it('accepts documented min and max bounds', () => {
    expect(timezoneOffsetSchema.parse(-840)).toBe(-840);
    expect(timezoneOffsetSchema.parse(720)).toBe(720);
  });

  it('rejects values outside the supported bounds', () => {
    expect(timezoneOffsetSchema.safeParse(-841).success).toBe(false);
    expect(timezoneOffsetSchema.safeParse(721).success).toBe(false);
  });
});

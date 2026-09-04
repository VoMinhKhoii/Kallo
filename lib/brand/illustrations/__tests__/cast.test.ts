import { describe, expect, it } from 'vitest';
import {
  CAST,
  pickIllustration,
  type SurfaceArea,
} from '@/lib/brand/illustrations/cast';
import type { Illustration } from '@/lib/brand/illustrations/illustration';

const AREAS: SurfaceArea[] = [
  'circle',
  'logging',
  'nutrition',
  'dashboard',
  'system',
];

/** Every record in the cast, area by area, without the area keys. */
function everyRecord(): Illustration[] {
  return AREAS.flatMap((area) =>
    Object.values(CAST[area]).filter(
      (value): value is Illustration => value !== undefined
    )
  );
}

describe('the surface-state cast', () => {
  it('casts eighteen distinct Koboyo illustrations', () => {
    const slugs = everyRecord().map((record) => record.slug);
    expect(slugs).toHaveLength(18);
    expect(new Set(slugs).size).toBe(18);
  });

  it('carries a renderable record for every pose', () => {
    for (const record of everyRecord()) {
      // The generator promises integer viewBoxes anchored at the origin and
      // real pen strokes; if a regenerated source drifts, it shows up here
      // rather than as an invisible <svg> in production.
      expect(record.viewBox).toMatch(/^0 0 \d+ \d+$/);
      expect(record.paths.length).toBeGreaterThanOrEqual(1);
      for (const d of record.paths) {
        expect(d[0]).toMatch(/^[Mm]$/);
      }
    }
  });

  it('gives every area an error, an empty and a night pose', () => {
    for (const area of AREAS) {
      expect(CAST[area].error).toBeDefined();
      expect(CAST[area].empty).toBeDefined();
      expect(CAST[area].night).toBeDefined();
    }
  });

  it('casts the 404 and offline poses on system only', () => {
    expect(CAST.system.notFound?.slug).toBe('seal-telescope');
    expect(CAST.system.offline?.slug).toBe('seal-hammock');
    for (const area of AREAS.filter((it) => it !== 'system')) {
      expect(CAST[area].notFound).toBeUndefined();
      expect(CAST[area].offline).toBeUndefined();
    }
  });

  it('sleeps through every area after dark', () => {
    for (const area of AREAS) {
      expect(pickIllustration(area, 'error', true).slug).toBe(
        CAST[area].night.slug
      );
      expect(pickIllustration(area, 'empty', true).slug).toBe(
        CAST[area].night.slug
      );
    }
  });

  it('falls back to the empty pose for a kind an area does not cast', () => {
    expect(pickIllustration('circle', 'notFound', false).slug).toBe(
      'capybara-telescope'
    );
  });
});

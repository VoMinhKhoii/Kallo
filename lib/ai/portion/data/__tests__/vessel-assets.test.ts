import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  PIECE_TIERS,
  VESSEL_FAMILIES,
} from '@/lib/ai/portion/data/vessel-tables';

/**
 * The picker's layout math is driven entirely by the `aspect` numbers declared
 * alongside each filename in vessel-data: the ruler sizes each glyph as
 * `height * asset.aspect` and the container row as `aspectRatio: glyph.aspect`.
 * So a declared asset that is missing renders an invisible-but-tappable button,
 * and one whose real dimensions drift from its declared aspect renders stretched
 * — both silently. This guard pins existence and dimensions against the art on
 * disk so neither can ship green again.
 */

const portionsDirectory = join(process.cwd(), 'public/portions');

const declaredAssets = [
  ...Object.values(VESSEL_FAMILIES).flatMap((family) =>
    Object.values(family.tiers).map((tier) => ({
      file: tier.asset,
      aspect: tier.aspect,
    }))
  ),
  ...PIECE_TIERS.flatMap((tier) =>
    tier.assets.map((asset) => ({ file: asset.file, aspect: asset.aspect }))
  ),
].sort((a, b) => a.file.localeCompare(b.file));

describe('portion vessel assets', () => {
  it('declares one asset per vessel tier and piece kind', () => {
    // 3 container families x 4 tiers + 5 piece tiers x 3 kinds.
    expect(declaredAssets).toHaveLength(27);
    expect(new Set(declaredAssets.map((asset) => asset.file)).size).toBe(27);
  });

  it.each(declaredAssets)('ships $file in public/portions', ({ file }) => {
    expect(existsSync(join(portionsDirectory, file))).toBe(true);
  });

  it('matches every declared aspect to the art on disk', async () => {
    const measured = await Promise.all(
      declaredAssets.map(async ({ file }) => {
        const {
          width = 0,
          height = 0,
          hasAlpha,
        } = await sharp(join(portionsDirectory, file)).metadata();
        return { file, aspect: Number((width / height).toFixed(2)), hasAlpha };
      })
    );

    // Silhouettes sit directly on the app surface, so a lost alpha channel
    // would render an opaque box behind every glyph — assert it alongside the
    // aspect so one diff reports every asset that drifted.
    expect(measured).toEqual(
      declaredAssets.map(({ file, aspect }) => ({
        file,
        aspect,
        hasAlpha: true,
      }))
    );
  });

  it('carries no undeclared files', () => {
    expect(readdirSync(portionsDirectory).sort()).toEqual(
      declaredAssets.map((asset) => asset.file)
    );
  });
});

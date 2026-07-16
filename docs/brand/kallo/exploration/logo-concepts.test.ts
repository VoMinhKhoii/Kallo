import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const explorationDirectory = join(
  process.cwd(),
  'docs/brand/kallo/exploration'
);
const conceptsDirectory = join(explorationDirectory, 'concepts');
const conceptFiles = readdirSync(conceptsDirectory)
  .filter((file) => file.endsWith('.svg'))
  .sort();
const renderSizes = [16, 24, 32, 64, 180, 512, 1024];
const customWordmark = join(
  explorationDirectory,
  'wordmarks/01-custom-kallo-wordmark.svg'
);
const selectedWordmark = join(
  explorationDirectory,
  'exports/kallo-option-b-wordmark.svg'
);

describe('Kallo logo exploration contracts', () => {
  it('contains eight distinct, sequential concepts', () => {
    expect(conceptFiles).toHaveLength(8);
    expect(conceptFiles.map((file) => file.slice(0, 2))).toEqual([
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
    ]);
  });

  it.each(
    conceptFiles
  )('%s is portable, accessible vector geometry', (file) => {
    const svg = readFileSync(join(conceptsDirectory, file), 'utf8');

    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).toContain('currentColor');
    expect(svg).toContain('<title');
    expect(svg).toContain('<desc');
    expect(svg).toContain('role="img"');
    expect(svg).not.toMatch(/<text\b/i);
    expect(svg).not.toMatch(
      /<(?:filter|image|linearGradient|radialGradient)\b/i
    );
    expect(svg).not.toMatch(/#[\da-f]{3,8}\b/i);
  });

  it.each(
    conceptFiles
  )('%s renders with transparency at every required size', async (file) => {
    const source = join(conceptsDirectory, file);

    for (const size of renderSizes) {
      const { data, info } = await sharp(source)
        .resize(size, size)
        .png()
        .toBuffer({ resolveWithObject: true });
      const metadata = await sharp(data).metadata();

      expect(info.width).toBe(size);
      expect(info.height).toBe(size);
      expect(info.channels).toBe(4);
      expect(metadata.hasAlpha).toBe(true);
    }
  });

  it('references every concept from the accessible comparison board', () => {
    const board = readFileSync(
      join(explorationDirectory, 'index.html'),
      'utf8'
    );

    for (const file of conceptFiles) {
      expect(board).toContain(`./concepts/${file}`);
    }

    expect(board).toContain('aria-label="Preview controls"');
    expect(board).toContain('aria-live="polite"');
    expect(board).toContain(
      'Production assets and the Kallo rollout remain untouched'
    );
    expect(board).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('includes a font-independent custom Kallo wordmark', async () => {
    const svg = readFileSync(customWordmark, 'utf8');
    const { info } = await sharp(customWordmark)
      .resize(540, 200)
      .png()
      .toBuffer({ resolveWithObject: true });

    expect(svg).toContain('viewBox="0 0 270 100"');
    expect(svg).toContain('currentColor');
    expect(svg).not.toMatch(/<text\b/i);
    expect(info.width).toBe(540);
    expect(info.height).toBe(200);
  });

  it('exports the selected option B wordmark as portable paths', async () => {
    const svg = readFileSync(selectedWordmark, 'utf8');

    expect(svg).toContain('viewBox="0 0 2180 812"');
    expect(svg).toContain('fill="currentColor"');
    expect(svg).toContain('<title');
    expect(svg).toContain('<desc');
    expect(svg).toContain('role="img"');
    expect(svg).not.toMatch(/<text\b/i);
    expect(svg).not.toMatch(/font-family/i);

    for (const width of [180, 512, 1024]) {
      const { info } = await sharp(selectedWordmark)
        .resize({ width })
        .png()
        .toBuffer({ resolveWithObject: true });

      expect(info.width).toBe(width);
      expect(info.channels).toBe(4);
    }
  });

  it('keeps the locked mark constant across four round-two type voices', () => {
    const refinement = readFileSync(
      join(explorationDirectory, 'round-two.html'),
      'utf8'
    );

    expect(refinement).toContain('Symbol locked · concept 01');
    expect(refinement).toContain('./concepts/01-calibrated-letter.svg');
    expect(refinement.match(/class="type-card"/g)).toHaveLength(4);
    expect(refinement).toContain('Derived from concept 03');
    expect(refinement).toContain('Derived from concept 05');
    expect(refinement).toContain('Derived from concept 06');
    expect(refinement).toContain('Derived from concept 08');
    expect(refinement).not.toMatch(/concepts\/(?:02|03|04|05|06|07|08)-/);
  });

  it('presents the selected B synthesis without starting rollout', () => {
    const refinement = readFileSync(
      join(explorationDirectory, 'round-three.html'),
      'utf8'
    );

    expect(refinement).toContain('Option B is selected');
    expect(refinement).toContain('class="segmented-glyph"');
    expect(refinement).toContain('segmented-glyph__part--stem');
    expect(refinement).toContain('segmented-glyph__part--upper');
    expect(refinement).toContain('segmented-glyph__part--lower');
    expect(refinement).toContain('Matched K, parallelogram arms');
    expect(refinement).toContain('polygon(38% 45%, 38% 31%, 96% 15%, 96% 29%)');
    expect(refinement).toContain('background: currentColor');
    expect(refinement).toContain('transform: scaleY(-1)');
    expect(refinement).toContain('.size-test > span:last-child');
    expect(refinement).not.toContain('01b-performance-k.svg');
    expect(refinement).toContain('./concepts/01-calibrated-letter.svg');
    expect(refinement).toContain('Minimum test · 24px');
    expect(refinement).toContain('not a production rollout');
  });
});

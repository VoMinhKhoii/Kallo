import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DIMS,
  floatToHalf,
} from '@/lib/ai/matching/cards/search-index/search-core.mjs';
import { buildIndex, FILE_NAMES, writeArtifactFiles } from '../artifact-files';
import type { Snapshot } from '../snapshot';
import { buildSpec } from '../spec';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function snapshot(count: number): Snapshot {
  const texts = new Uint16Array(count * DIMS);
  for (let i = 0; i < texts.length; i++) {
    texts[i] = floatToHalf(Math.sin(i * 0.37));
  }
  return {
    fingerprint: {
      catalog: 'c',
      catalogRows: 1,
      links: 'l',
      linkRows: count,
      linkedTexts: count,
      minTextId: 1,
      maxTextId: count,
      unembedded: 0,
      sampledVectors: 's',
    },
    catalogRows: [
      {
        id: 'row_0',
        source_code: 'USDA_SR',
        state: 'raw',
        name_en: 'Beef',
        name_primary: 'Bò',
        food: 'beef',
        aliases_en: null,
        names_vi: null,
        part_cut: null,
        form_processing: null,
        cooking_method: null,
        fat_level: null,
        brand: null,
      },
    ],
    texts,
    textIds: Array.from({ length: count }, (_, i) => i + 1),
    textRows: Array.from({ length: count }, (_, i) => [`row_${i}`]),
  };
}

describe('writeArtifactFiles', () => {
  it('writes every file with the sha256 and size the manifest records', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'artifact-test-'));
    dirs.push(outDir);
    const snap = snapshot(50);
    const built = buildIndex(snap.texts);

    const manifest = writeArtifactFiles({
      outDir,
      snapshot: snap,
      index: built.index,
      spec: buildSpec(),
      key: 'k'.repeat(64),
      buildId: 'kkkkkkkkkkkk-20261015T000000Z',
      gitSha: 'abc',
    });

    for (const name of FILE_NAMES) {
      const bytes = readFileSync(join(outDir, name));
      expect(manifest.files[name].bytes).toBe(bytes.byteLength);
      expect(manifest.files[name].sha256).toBe(
        createHash('sha256').update(bytes).digest('hex')
      );
    }
    expect(manifest.counts).toEqual({ catalogRows: 1, texts: 50, links: 50 });
    expect(readFileSync(join(outDir, 'texts.f16')).byteLength).toBe(
      50 * DIMS * 2
    );
    const written = JSON.parse(
      readFileSync(join(outDir, 'manifest.json'), 'utf8')
    );
    expect(written.buildId).toBe(manifest.buildId);
    expect(
      JSON.parse(readFileSync(join(outDir, 'text-rows.json'), 'utf8'))[3]
    ).toEqual(['row_3']);
  });

  it('builds the same index bytes from the same data', () => {
    const snap = snapshot(80);
    const shas = [0, 1].map(() => {
      const outDir = mkdtempSync(join(tmpdir(), 'artifact-test-'));
      dirs.push(outDir);
      buildIndex(snap.texts).index.save(join(outDir, 'i.usearch'));
      return createHash('sha256')
        .update(readFileSync(join(outDir, 'i.usearch')))
        .digest('hex');
    });
    expect(shas[0]).toBe(shas[1]);
  });
});

/**
 * A real search artifact on disk for the runtime tests, written with the
 * deploy builder's own code (index build + file layout), so the runtime is
 * tested against exactly what the deploy publishes.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildIndex,
  writeArtifactFiles,
} from '@/scripts/data/food-cards/search-artifact/artifact-files';
import type { Snapshot } from '@/scripts/data/food-cards/search-artifact/snapshot';
import { buildSpec } from '@/scripts/data/food-cards/search-artifact/spec';
import { DIMS, floatToHalf, halfToFloat } from '../search-core.mjs';

export const COUNT = 120;

/** Text i's vector, as a query (its own string must come first). */
export function textVector(texts: Uint16Array, i: number): number[] {
  return Array.from(texts.subarray(i * DIMS, (i + 1) * DIMS), halfToFloat);
}

export function writeFixture() {
  const texts = new Uint16Array(COUNT * DIMS);
  for (let k = 0; k < texts.length; k++) {
    texts[k] = floatToHalf(Math.sin(k * 0.731) + Math.cos(k * 0.0173));
  }
  const textRows = Array.from({ length: COUNT }, (_, i) => [`row_${i}`]);
  const snapshot: Snapshot = {
    fingerprint: {
      catalog: 'c',
      catalogRows: COUNT,
      links: 'l',
      linkRows: COUNT,
      linkedTexts: COUNT,
      minTextId: 1,
      maxTextId: COUNT,
      unembedded: 0,
      sampledVectors: 's',
    },
    catalogRows: textRows.map(([id], i) => ({
      id,
      source_code: 'USDA_SR',
      state: 'raw',
      name_en: `Food ${i}`,
      name_primary: `Món ${i}`,
      food: `food ${i}`,
      aliases_en: null,
      names_vi: null,
      part_cut: null,
      form_processing: null,
      cooking_method: null,
      fat_level: null,
      brand: null,
    })),
    texts,
    textIds: Array.from({ length: COUNT }, (_, i) => i + 1),
    textRows,
  };
  const dir = mkdtempSync(join(tmpdir(), 'card-index-fixture-'));
  writeArtifactFiles({
    outDir: dir,
    snapshot,
    index: buildIndex(texts).index,
    spec: buildSpec(),
    key: 'k'.repeat(64),
    buildId: 'fixture-build',
    gitSha: null,
  });
  return { dir, uri: pathToFileURL(dir).href, texts, textRows };
}

/** Rewrite one of the fixture's files (to break it). */
export function overwrite(
  dir: string,
  name: string,
  edit: (bytes: Buffer) => Buffer | string
) {
  writeFileSync(join(dir, name), edit(readFileSync(join(dir, name))));
}

// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  readDraft,
  readManualRowsDraft,
  writeDraft,
  writeManualRowsDraft,
} from '@/lib/domain/logging/meal-input-draft';
import {
  readStagedDraft,
  writeStagedDraft,
} from '@/lib/domain/logging/relog/draft';

const row = {
  id: 'row',
  query: 'private meal',
  ingredient: null,
  grams: '150',
};
const entry = {
  stageId: 'stage',
  ref: { kind: 'meal' as const, sourceMealId: 'source' },
  label: 'private lunch',
  partCount: 1,
  summary: {
    totalGrams: 150,
    caloriesKcal: 200,
    proteinG: 10,
    carbohydrateG: 20,
    fatG: 9,
  },
};

beforeEach(() => localStorage.clear());

describe('account-owned composer drafts', () => {
  it('restores each draft only for its owner', () => {
    writeDraft('private text', 'A');
    writeManualRowsDraft([row], 'A');
    writeStagedDraft([entry], 'A');
    expect(readDraft('A')).toBe('private text');
    expect(readManualRowsDraft('A')).toEqual([row]);
    expect(readStagedDraft('A')).toEqual([entry]);
    expect(readDraft('B')).toBe('');
    expect(readManualRowsDraft('B')[0].query).toBe('');
    expect(readStagedDraft('B')).toEqual([]);
  });
});

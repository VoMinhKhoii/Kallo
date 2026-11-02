// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

describe('composer draft storage', () => {
  it('discards old global keys once without assigning their content to a user', async () => {
    const globals = [
      'nham:meal-input-draft',
      'nham:meal-input-manual-items',
      'nham:meal-input-manual-items-v2',
      'nham:meal-input-manual-items-v3',
      'nham:meal-input-relog-staged-v1',
    ];
    for (const key of globals) localStorage.setItem(key, 'private legacy data');
    localStorage.setItem('nham:meal-input-draft:A', 'owned draft');
    const { readComposerDraft } = await import(
      '@/lib/domain/logging/drafts/composer-drafts'
    );
    expect(readComposerDraft('text', 'B')).toBeNull();
    expect(readComposerDraft('text', 'A')).toBe('owned draft');
    for (const key of globals) expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem('nham:meal-input-draft:B')).toBeNull();
  });

  it('purges every prefix variant, preserves other storage and blocks all later writes', async () => {
    const { writeComposerDraft, readComposerDraft, clearComposerDrafts } =
      await import('@/lib/domain/logging/drafts/composer-drafts');
    for (const kind of ['text', 'manual', 'staged'] as const) {
      writeComposerDraft(kind, 'A', 'private');
      writeComposerDraft(kind, 'B', 'private');
    }
    localStorage.setItem('nham:meal-input-future-version:C', 'private');
    localStorage.setItem('theme', 'light');
    clearComposerDrafts();
    clearComposerDrafts();
    for (const kind of ['text', 'manual', 'staged'] as const) {
      writeComposerDraft(kind, 'A', 'late flush');
      expect(readComposerDraft(kind, 'A')).toBeNull();
    }
    expect(Object.keys(localStorage)).toEqual(['theme']);
  });

  it('degrades to empty drafts when storage is unavailable', async () => {
    const { readComposerDraft, writeComposerDraft, clearComposerDrafts } =
      await import('@/lib/domain/logging/drafts/composer-drafts');
    const storage = vi
      .spyOn(window, 'localStorage', 'get')
      .mockImplementation(() => {
        throw new Error('unavailable');
      });
    expect(readComposerDraft('text', 'A')).toBeNull();
    expect(() => writeComposerDraft('manual', 'A', 'draft')).not.toThrow();
    expect(() => clearComposerDrafts()).not.toThrow();
    storage.mockRestore();
    writeComposerDraft('text', 'A', 'late flush');
    expect(localStorage.length).toBe(0);
  });
});

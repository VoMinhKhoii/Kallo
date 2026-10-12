import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { UserContext } from '@/lib/ai/types/user-context';
import type { AppDb } from '@/lib/infra/db/client';

const { closeMock } = vi.hoisted(() => ({ closeMock: vi.fn() }));
vi.mock('@/lib/ai/matching/streamed-matching', () => ({
  createStreamedMatching: () => ({
    onChunk: () => {},
    match: async () => [],
    close: closeMock,
  }),
}));
vi.mock('@/lib/ai/matching/match-ingredients', () => ({
  createMatchingPrewarm: () => () => {},
}));

import { runGroundedDecomposition } from '../decomposition';

function run(stream: GeminiClient['generateStructuredOutputStream']) {
  return runGroundedDecomposition({
    rawInput: 'phở bò',
    userContext: { outputLanguage: 'vi', inputLanguage: 'vi' } as UserContext,
    db: {} as AppDb,
    gemini: { generateStructuredOutputStream: stream } as GeminiClient,
    traceContext: undefined,
    emit: () => {},
    promptCtx: {} as PromptPersonalizationContext,
    profile: { decompositionModel: 'm' } as ModelProfile,
  });
}

describe('runGroundedDecomposition and streamed matching', () => {
  beforeEach(() => closeMock.mockReset());

  it('closes streamed matching when Call 1 fails', async () => {
    await expect(
      run(async () => {
        throw new Error('provider down');
      })
    ).rejects.toThrow('provider down');
    expect(closeMock).toHaveBeenCalled();
  });

  it('closes streamed matching when the input is not food', async () => {
    const out = await run(
      async () =>
        ({ plan: '', isFood: false, mealSlot: 'snack', mealItems: [] }) as never
    );
    expect(out).toEqual({ nonFood: true });
    expect(closeMock).toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { PipelineResponse } from '@/lib/ai/types/result';
import type { UserContext } from '@/lib/ai/types/user-context';
import type { AppDb } from '@/lib/infra/db/client';

const analyzeMeal = vi.fn();
const settle = vi.fn();
const abort = vi.fn();
const startPlainRead = vi.fn(() => ({ settle, abort }));
const holdToPlainRead = vi.fn();

vi.mock('@/lib/ai/pipeline/analyze-meal', () => ({ analyzeMeal }));
vi.mock('@/lib/ai/pipeline/plain-read/plain-read', () => ({ startPlainRead }));
vi.mock('@/lib/ai/pipeline/plain-read/hold', () => ({ holdToPlainRead }));

const { runPreciseAnalysis } = await import('../precise-analysis');

const READ = { totalKcal: 500, foods: [] };
const RAW = { displayedNutrition: { caloriesKcal: 800 } };
const HELD = { displayedNutrition: { caloriesKcal: 550 } };

function run(signal = new AbortController().signal) {
  return runPreciseAnalysis({
    rawInput: 'phở gà tô nhỏ',
    userContext: {} as UserContext,
    db: {} as AppDb,
    gemini: {} as GeminiClient,
    signal,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  settle.mockResolvedValue(READ);
  holdToPlainRead.mockReturnValue({ result: HELD, outcome: 'held' });
});

describe('runPreciseAnalysis', () => {
  it('returns the pipeline result held near the plain read', async () => {
    analyzeMeal.mockResolvedValue({ success: true, data: RAW });

    const { response, hold } = await run();

    expect(holdToPlainRead).toHaveBeenCalledWith(RAW, { read: READ });
    expect(response).toEqual({ success: true, data: HELD });
    expect(hold?.outcome).toBe('held');
    expect(startPlainRead).toHaveBeenCalledWith(
      expect.objectContaining({ mealText: 'phở gà tô nhỏ' })
    );
    expect(abort).toHaveBeenCalled();
  });

  it('passes diagnostics through to the pipeline', async () => {
    analyzeMeal.mockResolvedValue({ success: true, data: RAW });
    const onDiagnostics = vi.fn();

    await runPreciseAnalysis({
      rawInput: 'x',
      userContext: {} as UserContext,
      db: {} as AppDb,
      gemini: {} as GeminiClient,
      signal: new AbortController().signal,
      onDiagnostics,
    });

    expect(analyzeMeal.mock.calls[0]?.[6]).toEqual({ onDiagnostics });
  });

  it.each([
    ['a failed run', { success: false, error: { type: 'api_error' } }],
    ['an unresolved run', { success: true, data: RAW, unresolved: {} }],
  ])('does not hold %s and ends the read', async (_, res) => {
    analyzeMeal.mockResolvedValue(res as PipelineResponse);

    const { response, hold } = await run();

    expect(hold).toBeNull();
    expect(response).toBe(res);
    expect(holdToPlainRead).not.toHaveBeenCalled();
    expect(abort).toHaveBeenCalled();
  });

  it('skips the hold when the caller hung up', async () => {
    const controller = new AbortController();
    analyzeMeal.mockImplementation(async () => {
      controller.abort();
      return { success: true, data: RAW };
    });

    const { hold } = await run(controller.signal);

    expect(hold).toBeNull();
    expect(settle).not.toHaveBeenCalled();
  });

  it('ends the read when the pipeline throws', async () => {
    analyzeMeal.mockRejectedValue(new Error('boom'));

    await expect(run()).rejects.toThrow('boom');
    expect(abort).toHaveBeenCalled();
  });
});

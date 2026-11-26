import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { PipelineResponse } from '@/lib/ai/types/result';
import type { UserContext } from '@/lib/ai/types/user-context';
import type { AppDb } from '@/lib/infra/db/client';

const analyzeMeal = vi.fn();
const apply = vi.fn();
const abort = vi.fn();
const startPlainRead = vi.fn(() => ({ apply, abort }));

vi.mock('@/lib/ai/pipeline/analyze-meal', () => ({ analyzeMeal }));
vi.mock('@/lib/ai/pipeline/plain-read/plain-read', () => ({ startPlainRead }));

const { isPublishable, runPreciseAnalysis } = await import(
  '../precise-analysis'
);

const RAW = { displayedNutrition: { caloriesKcal: 800 } };
const HELD = { displayedNutrition: { caloriesKcal: 550 } };
const RESCUED = { displayedNutrition: { caloriesKcal: 520 } };

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
  apply.mockResolvedValue({ result: HELD, outcome: 'held' });
});

describe('runPreciseAnalysis', () => {
  it('returns the pipeline result held near the plain read', async () => {
    analyzeMeal.mockResolvedValue({ success: true, data: RAW });

    const { response, hold } = await run();

    expect(apply).toHaveBeenCalledWith(RAW);
    expect(response).toEqual({ success: true, data: HELD });
    expect(hold?.outcome).toBe('held');
    expect(startPlainRead).toHaveBeenCalledWith(
      expect.objectContaining({ mealText: 'phở gà tô nhỏ' })
    );
    expect(abort).toHaveBeenCalled();
  });

  it('passes diagnostics and rescue telemetry callbacks through', async () => {
    analyzeMeal.mockResolvedValue({ success: true, data: RAW });
    const onDiagnostics = vi.fn();
    const onRescueAttemptComplete = vi.fn();

    await runPreciseAnalysis({
      rawInput: 'x',
      userContext: {} as UserContext,
      db: {} as AppDb,
      gemini: {} as GeminiClient,
      signal: new AbortController().signal,
      onDiagnostics,
      onRescueAttemptComplete,
    });

    expect(analyzeMeal.mock.calls[0]?.[6]).toEqual({ onDiagnostics });
    expect(startPlainRead).toHaveBeenCalledWith(
      expect.objectContaining({ onRescueAttemptComplete })
    );
  });

  it.each([
    ['a failed run', { success: false, error: { type: 'api_error' } }],
    ['an unresolved run', { success: true, data: RAW, unresolved: {} }],
  ])('does not hold %s and ends the read', async (_, res) => {
    analyzeMeal.mockResolvedValue(res as PipelineResponse);

    const { response, hold } = await run();

    expect(hold).toBeNull();
    expect(response).toBe(res);
    expect(apply).not.toHaveBeenCalled();
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
    expect(apply).not.toHaveBeenCalled();
  });

  it('skips the hold when plainRead.apply returns null on abort', async () => {
    analyzeMeal.mockResolvedValue({ success: true, data: RAW });
    apply.mockResolvedValue(null);

    const { response, hold } = await run();

    expect(hold).toBeNull();
    expect(response).toEqual({ success: true, data: RAW });
  });

  it('returns the rescued result when plainRead.apply rescues a divergent meal', async () => {
    analyzeMeal.mockResolvedValue({ success: true, data: RAW });
    apply.mockResolvedValue({ result: RESCUED, outcome: 'rescued' });

    const { response, hold } = await run();

    expect(response).toEqual({ success: true, data: RESCUED });
    expect(hold?.outcome).toBe('rescued');
  });

  it('ends the read when the pipeline throws', async () => {
    analyzeMeal.mockRejectedValue(new Error('boom'));

    await expect(run()).rejects.toThrow('boom');
    expect(abort).toHaveBeenCalled();
  });
});

describe('isPublishable', () => {
  const summary = (outcome: string) =>
    ({
      outcome,
      appKcal: 100,
      readKcal: 100,
      factor: 1,
      gramsFactor: 1,
      rawGramsFactor: 1,
    }) as never;

  it.each([
    'held',
    'rescued',
    'within_band',
    'typed_parts',
  ])('publishes %s', (outcome) => {
    expect(isPublishable(summary(outcome))).toBe(true);
  });

  it.each(['no_read', 'no_calories'])('refuses %s', (outcome) => {
    expect(isPublishable(summary(outcome))).toBe(false);
  });

  it('refuses a meal with no hold', () => {
    expect(isPublishable(null)).toBe(false);
    expect(isPublishable(undefined)).toBe(false);
  });
});

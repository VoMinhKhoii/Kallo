import { describe, expect, it, vi } from 'vitest';
import type { GroundedEstimator } from '@/lib/ai/pipeline/estimator/types';
import { chunkMealItems } from '../chunk-policy';
import { runChunkedCall2 } from '../chunked-call2';
import { baseArgs, fakeEstimator, meal } from './fixtures/chunk-meals';

// ---------------------------------------------------------------------------
// runChunkedCall2 — merge in original order; degrade a failed chunk
// ---------------------------------------------------------------------------

describe('runChunkedCall2 — deterministic merge + failure contract', () => {
  it('splits a large meal and merges results in ORIGINAL order regardless of completion order', async () => {
    // First chunk is slow, later chunks fast → completion order != input order.
    const estimator: GroundedEstimator = {
      id: 'ordered',
      model: 'm',
      async estimate(input) {
        // Delay proportional to the (reverse) chunk position so early chunks
        // finish last — proves the merge is by input order, not completion.
        const firstName = input.mealItems[0].mealItem.name;
        const idx = Number(firstName.replace('dish', ''));
        await new Promise((r) => setTimeout(r, (30 - idx) * 2));
        return {
          estimation: {
            mealItems: input.mealItems.map((mi) => ({
              mealItemName: mi.mealItem.name,
              ingredients: [
                {
                  ingredientName: mi.ingredients[0].ingredient.rawName,
                  grossG: 100,
                  refusePct: 0,
                  caloriesKcal: { low: 100, mid: 110, high: 120 },
                  proteinG: { low: 10, mid: 11, high: 12 },
                  carbohydrateG: { low: 5, mid: 6, high: 7 },
                  fatG: { low: 1, mid: 1, high: 1 },
                },
              ],
            })),
          },
        };
      },
    };
    const result = await runChunkedCall2({
      ...baseArgs,
      estimator,
      mealItems: meal(20, 2),
    });
    expect(result.chunkCount).toBeGreaterThan(1);
    expect(result.failedChunkCount).toBe(0);
    const names = result.estimation.mealItems.map((mi) => mi.mealItemName);
    expect(names).toEqual(meal(20, 2).map((m) => m.mealItem.name));
  });

  it('degrades a failed chunk to ABSENT items without failing the whole meal', async () => {
    // 28 items × 1 ingredient → chunks of CHUNK_TARGET_INGREDIENTS (10) items:
    // [dish1..dish10], [dish11..dish20], [dish21..dish28]. Failing the SECOND
    // chunk (dish15 lives there) drops exactly that chunk's items; the other
    // two chunks still return — a partial result, not a 500.
    const items = meal(28, 1);
    const chunks = chunkMealItems(items);
    const failingChunk = chunks[1].map((c) => c.mealItem.name);
    const survivingA = chunks[0].map((c) => c.mealItem.name);
    const survivingC = chunks[2].map((c) => c.mealItem.name);

    const result = await runChunkedCall2({
      ...baseArgs,
      estimator: fakeEstimator({ failFor: (n) => failingChunk.includes(n) }),
      mealItems: items,
    });
    expect(result.failedChunkCount).toBe(1);
    expect(result.failedMealItemNames).toEqual(failingChunk);
    const returned = result.estimation.mealItems.map((mi) => mi.mealItemName);
    // The failed chunk's items are absent (→ unresolved downstream)…
    for (const name of failingChunk) expect(returned).not.toContain(name);
    // …while the other chunks survive, in original order.
    for (const name of [...survivingA, ...survivingC]) {
      expect(returned).toContain(name);
    }
    expect(returned.length).toBe(28 - failingChunk.length);
  });

  it('retries a failing chunk up to the cap, then degrades', async () => {
    let attempts = 0;
    const flaky: GroundedEstimator = {
      id: 'flaky',
      model: 'm',
      async estimate() {
        attempts++;
        throw new Error('always fails');
      },
    };
    const result = await runChunkedCall2({
      ...baseArgs,
      estimator: flaky,
      mealItems: meal(28, 1),
      maxAttempts: 2,
    });
    // Every chunk failed after 2 attempts each → all items degraded.
    expect(result.failedChunkCount).toBe(result.chunkCount);
    expect(result.estimation.mealItems).toHaveLength(0);
    // 2 attempts per chunk.
    expect(attempts).toBe(result.chunkCount * 2);
  });

  it('stops retrying once the wall-clock phase deadline is spent', async () => {
    const started = Date.now();
    const result = await runChunkedCall2({
      ...baseArgs,
      // Each call sleeps past the whole deadline → first attempt of the first
      // scheduled chunk consumes it; later chunks see remaining<=0 and degrade
      // WITHOUT making a provider call.
      estimator: fakeEstimator({ delayMs: 60, failFor: () => true }),
      mealItems: meal(28, 1),
      phaseDeadlineMs: 40,
      concurrency: 1,
      maxAttempts: 2,
    });
    // We never exceed the deadline by more than a small margin (no unbounded
    // retry storm) — the whole phase returns quickly.
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(result.failedChunkCount).toBe(result.chunkCount);
  });

  it('emits onChunkComplete progressively as chunks land', async () => {
    const onChunkComplete = vi.fn();
    await runChunkedCall2({
      ...baseArgs,
      estimator: fakeEstimator(),
      mealItems: meal(20, 2),
      onChunkComplete,
    });
    // One callback per successful chunk.
    expect(onChunkComplete.mock.calls.length).toBeGreaterThan(1);
    // Each call receives that chunk's parsed grounded meal items.
    for (const call of onChunkComplete.mock.calls) {
      expect(Array.isArray(call[0])).toBe(true);
      expect(call[0].length).toBeGreaterThan(0);
    }
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

const { generateStructuredOutput } = vi.hoisted(() => ({
  generateStructuredOutput: vi.fn(),
}));

vi.mock('@/lib/ai/provider/provider', () => ({
  resolveGeminiProvider: vi.fn(() => ({
    provider: 'ai-studio',
    apiKey: 'test-key',
  })),
  createGeminiClient: vi.fn(() => ({ generateStructuredOutput })),
}));

import { scanNutritionLabelWithGemini } from '../label-ocr';

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('scanNutritionLabelWithGemini deadline', () => {
  it('aborts a stalled provider at the end-to-end deadline', async () => {
    vi.useFakeTimers();
    generateStructuredOutput.mockImplementation(
      ({ abortSignal }: { abortSignal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          abortSignal.addEventListener('abort', () =>
            reject(abortSignal.reason)
          );
        })
    );

    const scan = scanNutritionLabelWithGemini({
      imageBase64: 'unused-by-mock',
      mimeType: 'image/png',
      deadlineMs: 100,
    });
    const rejection = expect(scan).rejects.toMatchObject({
      name: 'AbortError',
    });
    await vi.advanceTimersByTimeAsync(100);
    await rejection;
    expect(generateStructuredOutput).toHaveBeenCalledWith(
      expect.objectContaining({ abortSignal: expect.any(AbortSignal) })
    );
  });

  it('threads caller cancellation into the provider call', async () => {
    const controller = new AbortController();
    generateStructuredOutput.mockImplementation(
      ({ abortSignal }: { abortSignal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          abortSignal.addEventListener('abort', () =>
            reject(abortSignal.reason)
          );
        })
    );

    const scan = scanNutritionLabelWithGemini({
      imageBase64: 'unused-by-mock',
      mimeType: 'image/png',
      abortSignal: controller.signal,
    });
    const rejection = expect(scan).rejects.toThrow('cancelled by caller');
    controller.abort(new Error('cancelled by caller'));
    await rejection;
  });
});

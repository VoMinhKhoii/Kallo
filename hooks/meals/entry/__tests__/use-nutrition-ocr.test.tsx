import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiConsentGate } from '@/lib/domain/privacy/consent-gate';

const { scanNutritionLabelAction } = vi.hoisted(() => ({
  scanNutritionLabelAction: vi.fn(),
}));
vi.mock('@/lib/actions/logging/nutrition-ocr', () => ({
  scanNutritionLabelAction,
}));

import { useNutritionOcr } from '@/hooks/meals/entry/use-nutrition-ocr';

const label = { productName: 'Sữa chua' };
const consentRefusal = { success: false, code: 'ai_consent_required' };

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function gate(answers: { ensure?: boolean; onRequired?: boolean } = {}) {
  return {
    ensure: vi.fn(async () => answers.ensure ?? true),
    onRequired: vi.fn(async () => answers.onRequired ?? false),
  } satisfies AiConsentGate;
}

async function scanWith(aiConsent: AiConsentGate) {
  const { result } = renderHook(() => useNutritionOcr(aiConsent), { wrapper });
  const photo = new File(['photo'], 'label.jpg', { type: 'image/jpeg' });
  let scanned: unknown;
  await act(async () => {
    scanned = await result.current.scanLabel(photo);
  });
  return scanned;
}

// jsdom has no image decoder or canvas: stand in for the resize so the photo
// reaches the action.
beforeEach(() => {
  scanNutritionLabelAction.mockReset();
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 800, height: 600, close: vi.fn() }))
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    (callback) => callback(new Blob(['jpeg'], { type: 'image/jpeg' }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useNutritionOcr — the AI-processing consent gate', () => {
  it('sends nothing and resolves null on "Not now"', async () => {
    const aiConsent = gate({ ensure: false });

    expect(await scanWith(aiConsent)).toBeNull();
    expect(scanNutritionLabelAction).not.toHaveBeenCalled();
  });

  it('re-asks on the typed ai_consent_required code and re-sends on "Continue"', async () => {
    scanNutritionLabelAction
      .mockResolvedValueOnce(consentRefusal)
      .mockResolvedValueOnce({ success: true, data: label });
    const aiConsent = gate({ onRequired: true });

    expect(await scanWith(aiConsent)).toEqual(label);
    expect(aiConsent.onRequired).toHaveBeenCalledOnce();
    expect(scanNutritionLabelAction).toHaveBeenCalledTimes(2);
  });

  it('stops after a server re-ask answered "Not now"', async () => {
    scanNutritionLabelAction.mockResolvedValueOnce(consentRefusal);
    const aiConsent = gate({ onRequired: false });

    expect(await scanWith(aiConsent)).toBeNull();
    expect(scanNutritionLabelAction).toHaveBeenCalledOnce();
  });

  it('never re-asks for any other failure code', async () => {
    scanNutritionLabelAction.mockResolvedValueOnce({
      success: false,
      code: 'no_label_detected',
    });
    const aiConsent = gate();

    await expect(scanWith(aiConsent)).rejects.toThrow('no_label_detected');
    expect(aiConsent.onRequired).not.toHaveBeenCalled();
  });
});

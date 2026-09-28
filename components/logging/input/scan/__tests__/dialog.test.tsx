import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real ICU renderer: the flows read the copy the user reads.
vi.unmock('next-intl');

const h = vi.hoisted(() => ({
  locked: false,
  openPaywall: vi.fn(),
  onDecode: null as null | ((code: string, frame: string | null) => void),
  decoders: new Set<unknown>(),
  scanLabel: vi.fn(),
  capturePhoto: vi.fn(),
}));

vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/billing/premium-guard-provider', () => ({
  usePremiumGuard: () => ({
    locked: () => h.locked,
    openPaywall: h.openPaywall,
  }),
}));
vi.mock('@/components/privacy/ai-consent-provider', () => ({
  useAiConsent: () => ({ gate: { consented: true } }),
}));
vi.mock('@/hooks/ui/use-barcode-camera-scanner', () => ({
  BARCODE_SCANNER_ELEMENT_ID: 'kallo-barcode-scanner',
  useBarcodeCameraScanner: ({
    onDecode,
  }: {
    onDecode: (code: string, frame: string | null) => void;
  }) => {
    h.onDecode = onDecode;
    h.decoders.add(onDecode);
    return { cameraStatus: 'scanning', cameras: [], stopScanner: vi.fn() };
  },
}));
vi.mock('@/hooks/meals/entry/use-ocr-camera', () => ({
  useOcrCamera: () => ({
    videoRef: { current: null },
    cameraError: null,
    capabilities: { torch: false },
    torchEnabled: false,
    setTorch: vi.fn(),
    capturePhoto: h.capturePhoto,
  }),
}));
// Like the real hook, a failed read throws an `OcrScanError` carrying its code.
vi.mock('@/hooks/meals/entry/use-nutrition-ocr', () => {
  class OcrScanError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  return {
    OcrScanError,
    useNutritionOcr: () => ({
      scanLabel: async (file: File) => {
        try {
          return await h.scanLabel(file);
        } catch (failure) {
          throw new OcrScanError((failure as Error).message);
        }
      },
    }),
  };
});
vi.mock('@/lib/actions/logging/barcode', () => ({
  searchBarcodeAction: vi.fn(),
  stageBarcodeMealAction: vi.fn(),
}));
vi.mock('@/lib/actions/logging/nutrition-ocr', () => ({
  stageOcrMealAction: vi.fn(),
}));
vi.mock('@/lib/actions/meals/confirm-scan-meal', () => ({
  confirmScanMealAction: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { NextIntlClientProvider } from 'next-intl';
import {
  searchBarcodeAction,
  stageBarcodeMealAction,
} from '@/lib/actions/logging/barcode';
import { stageOcrMealAction } from '@/lib/actions/logging/nutrition-ocr';
import { confirmScanMealAction } from '@/lib/actions/meals/confirm-scan-meal';
import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/types';
import enBilling from '@/messages/en/billing.json';
import enLogging from '@/messages/en/logging.json';
import { ScanDialog } from '../dialog';

const coconutWater: ParsedBarcodeProduct = {
  barcode: '8938507849131',
  name: 'Coconut Water',
  brand: 'Coco Xim',
  caloriesKcal: 16,
  proteinG: 0,
  carbohydrateG: 4,
  fatG: 0,
  fiberG: null,
  sodiumMg: 39,
  servingSizeG: 100,
  packageSizeG: 1000,
  amountUnit: 'ml',
  imageUrl: null,
  micronutrients: { calciumMg: 10, potassiumMg: 170 },
};

function open() {
  const onSuccess = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <NextIntlClientProvider
      locale="en"
      messages={{ logging: enLogging, billing: enBilling }}
    >
      <ScanDialog
        isOpen
        onOpenChange={onOpenChange}
        selectedDate="2026-09-28"
        onSuccess={onSuccess}
      />
    </NextIntlClientProvider>
  );
  return { onSuccess, onOpenChange, user: userEvent.setup() };
}

async function decode(code = coconutWater.barcode) {
  await act(async () => h.onDecode?.(code, null));
}

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks keeps a queued once-value a failed test left behind.
  h.scanLabel.mockReset();
  h.locked = false;
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:label');
  globalThis.URL.revokeObjectURL = vi.fn();
  vi.mocked(searchBarcodeAction).mockResolvedValue({
    success: true,
    data: coconutWater,
  });
  vi.mocked(stageBarcodeMealAction).mockResolvedValue({
    success: true,
    analysisId: 'analysis-1',
  });
  vi.mocked(stageOcrMealAction).mockResolvedValue({
    success: true,
    analysisId: 'analysis-2',
  });
  vi.mocked(confirmScanMealAction).mockResolvedValue({ success: true });
  h.decoders.clear();
});

describe('ScanDialog — barcode', () => {
  it('a caught code rises as the product and logs by barcode', async () => {
    const { user, onSuccess, onOpenChange } = open();
    expect(screen.getByRole('button', { name: 'Type barcode' })).toBeVisible();

    await decode();
    expect(await screen.findByText('Coconut Water')).toBeVisible();
    expect(screen.getByText('Coco Xim')).toBeVisible();
    expect(screen.getByText('100 ml / serving')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByText('32')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Add meal' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(stageBarcodeMealAction).toHaveBeenCalledWith(
      expect.objectContaining({ barcode: coconutWater.barcode, grams: 200 })
    );
    expect(confirmScanMealAction).toHaveBeenCalledWith({
      analysisId: 'analysis-1',
      mealId: expect.any(String),
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closing the result goes back to a live camera', async () => {
    const { user } = open();
    await decode();
    await screen.findByText('Coconut Water');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByText('Coconut Water')).not.toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'Type barcode' })).toBeVisible();
  });

  it('opens the other nutrients over the same product and comes back', async () => {
    const { user } = open();
    await decode();
    await user.click(await screen.findByText('Other nutrients'));
    expect(screen.getByText('Calcium')).toBeVisible();
    expect(screen.getByText('In 1 serving · 100 ml')).toBeVisible();
    expect(screen.queryByText('Iron')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(
      await screen.findByRole('button', { name: 'Add meal' })
    ).toBeVisible();
  });

  it('types a code: Look up waits for 8 digits', async () => {
    const { user } = open();
    await user.click(screen.getByRole('button', { name: 'Type barcode' }));
    const input = screen.getByRole('textbox', { name: 'Type barcode' });
    await user.type(input, '893850');
    expect(input).toHaveValue('8938 50');
    expect(screen.getByRole('button', { name: 'Look up' })).toBeDisabled();
    await user.type(input, '7849131');
    expect(input).toHaveValue('8938 5078 4913 1');
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    expect(searchBarcodeAction).toHaveBeenCalledWith({
      barcode: '8938507849131',
    });
    expect(await screen.findByText('Coconut Water')).toBeVisible();
  });

  it('not found offers the label, and Enter manually logs a typed food', async () => {
    vi.mocked(searchBarcodeAction).mockResolvedValue({
      success: false,
      code: 'not_found',
    });
    const { user, onSuccess } = open();
    await decode();
    expect(await screen.findByText('No match found')).toBeVisible();
    expect(
      screen.getByText("Barcode 8938507849131 isn't in our database yet.")
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Enter manually' }));
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Food name' }), 'Chè');
    await user.type(screen.getByRole('textbox', { name: 'Calories' }), '250');
    await user.type(screen.getByRole('textbox', { name: 'Protein' }), '10');
    await user.type(
      screen.getByRole('textbox', { name: 'Carbohydrates' }),
      '30'
    );
    await user.type(screen.getByRole('textbox', { name: 'Fat' }), '8');
    await user.type(screen.getByRole('textbox', { name: 'Sodium' }), '0');
    await user.click(done);

    expect(await screen.findByText('New food')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Add meal' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    const payload = vi.mocked(stageOcrMealAction).mock.calls[0][0];
    expect(payload).toMatchObject({
      productName: 'Chè',
      amount: 100,
      unit: 'g',
      calories: 250,
      sodiumMg: 0,
      confidence: 'low',
    });
    expect(payload).not.toHaveProperty('fiberGrams');
  });

  it('a failed lookup offers another scan', async () => {
    vi.mocked(searchBarcodeAction).mockResolvedValue({
      success: false,
      code: 'server_error',
    });
    const { user } = open();
    await decode();
    expect(await screen.findByText("Couldn't look it up")).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Scan again' }));
    expect(screen.getByRole('button', { name: 'Type barcode' })).toBeVisible();
  });

  it('an edit keeps the chosen amount and logs the own numbers', async () => {
    const { user } = open();
    await decode();
    await screen.findByText('Coconut Water');
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const calories = screen.getByRole('textbox', { name: 'Calories' });
    await user.clear(calories);
    await user.type(calories, '20');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Back on the result — still two servings (the payload's 200 ml says so).
    await user.click(await screen.findByRole('button', { name: 'Add meal' }));
    await waitFor(() => expect(stageOcrMealAction).toHaveBeenCalled());
    expect(stageBarcodeMealAction).not.toHaveBeenCalled();
    expect(vi.mocked(stageOcrMealAction).mock.calls[0][0]).toMatchObject({
      amount: 200,
      unit: 'ml',
      calories: 40,
      calciumMg: 20,
    });
  });

  it('keeps the camera running across renders — one stable decode handler', async () => {
    const { user } = open();
    await user.click(screen.getByRole('button', { name: 'Type barcode' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(h.decoders.size).toBe(1);
  });

  it('a retry is the same meal: one id across attempts', async () => {
    vi.mocked(confirmScanMealAction)
      .mockResolvedValueOnce({ success: false, code: 'server_error' })
      .mockResolvedValueOnce({ success: true });
    const { user, onSuccess } = open();
    await decode();
    await user.click(await screen.findByRole('button', { name: 'Add meal' }));
    expect(await screen.findByRole('alert')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Add meal' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());

    const ids = vi
      .mocked(confirmScanMealAction)
      .mock.calls.map(([input]) => input.mealId);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
  });

  it('a plan that lapsed mid-result sends the save to the paywall', async () => {
    vi.mocked(stageOcrMealAction).mockResolvedValue({
      success: false,
      code: 'feature_locked',
    });
    const { user, onOpenChange } = open();
    await decode();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(await screen.findByRole('button', { name: 'Add meal' }));
    await waitFor(() => expect(h.openPaywall).toHaveBeenCalledOnce());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a failed save keeps the result and says why', async () => {
    vi.mocked(stageBarcodeMealAction).mockResolvedValue({
      success: false,
      code: 'server_error',
    });
    const { user, onSuccess } = open();
    await decode();
    await user.click(await screen.findByRole('button', { name: 'Add meal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.'
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('Coconut Water')).toBeVisible();
  });
});

describe('ScanDialog — reopening', () => {
  it('a saved result is not waiting when the dialog opens again', async () => {
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();
    const tree = (isOpen: boolean) => (
      <NextIntlClientProvider
        locale="en"
        messages={{ logging: enLogging, billing: enBilling }}
      >
        <ScanDialog
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          selectedDate="2026-09-28"
          onSuccess={onSuccess}
        />
      </NextIntlClientProvider>
    );
    const { rerender } = render(tree(true));
    const user = userEvent.setup();
    await decode();
    await user.click(await screen.findByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('button', { name: 'Add meal' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());

    rerender(tree(false));
    rerender(tree(true));
    expect(
      await screen.findByRole('button', { name: 'Type barcode' })
    ).toBeVisible();
    expect(screen.queryByText('Coconut Water')).not.toBeInTheDocument();
  });
});

describe('ScanDialog — Premium', () => {
  it('a free account meets the paywall on the label mode and Enter manually', async () => {
    h.locked = true;
    const { user, onOpenChange } = open();
    expect(screen.getByText('Premium')).toBeVisible();
    await user.click(screen.getByRole('radio', { name: 'Nutrition label' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(h.openPaywall).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Enter manually' }));
    expect(h.openPaywall).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('New food')).not.toBeInTheDocument();
  });
});

describe('ScanDialog — nutrition label', () => {
  const photo = new File(['x'], 'label.png', { type: 'image/png' });

  it('reads a picked photo at once and logs the extracted table', async () => {
    h.scanLabel.mockResolvedValue({
      basis: 'per_100g',
      confidence: 'high',
      labelEvidence: '',
      productName: 'Bánh quy Cosy',
      servingSize: { value: 30, unit: 'g' },
      servingSizeDescription: null,
      servingsPerContainer: 5,
      per100g: {
        calories: 480,
        proteinGrams: 6,
        carbsGrams: 62,
        fatGrams: 22,
        sodiumMg: 320,
      },
    });
    const { user, onSuccess } = open();
    await user.click(screen.getByRole('radio', { name: 'Nutrition label' }));
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      photo
    );

    expect(await screen.findByText('Extracted nutrition')).toBeVisible();
    expect(screen.getByText('From the label')).toBeVisible();
    expect(screen.getByText('30 g / serving')).toBeVisible();
    expect(screen.getByText('144')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Add meal' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(vi.mocked(stageOcrMealAction).mock.calls[0][0]).toMatchObject({
      productName: 'Bánh quy Cosy',
      amount: 30,
      unit: 'g',
      confidence: 'high',
      calories: 144,
    });
  });

  async function pickPhoto(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('radio', { name: 'Nutrition label' }));
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      photo
    );
  }

  it('a photo with no table says so, retakes, or goes to the barcode', async () => {
    h.scanLabel.mockRejectedValue(new Error('no_label_detected'));
    const { user } = open();
    await pickPhoto(user);

    expect(await screen.findByText("Couldn't read the label")).toBeVisible();
    expect(
      screen.getByText('Make sure the whole table is in the photo.')
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Retake photo' }));
    expect(screen.getByRole('button', { name: 'Library' })).toBeVisible();

    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      photo
    );
    await user.click(
      await screen.findByRole('button', { name: 'Scan barcode' })
    );
    expect(screen.getByRole('button', { name: 'Type barcode' })).toBeVisible();
  });

  it('a read the user already left never fails the next session', async () => {
    let fail: (reason: Error) => void = () => {};
    h.scanLabel.mockReturnValueOnce(
      new Promise((_, reject) => {
        fail = reject;
      })
    );
    const { user } = open();
    await pickPhoto(user);
    expect(await screen.findByText('Reading the label')).toBeVisible();

    // Mid-read the tools are hidden; the way out is closing the sheet. The
    // dialog stays mounted, so the next session starts in the same instance.
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('radio', { name: 'Nutrition label' }));
    await act(async () => fail(new Error('no_label_detected')));

    expect(screen.queryByText("Couldn't read the label")).toBeNull();
    expect(screen.queryByText('Reading the label')).toBeNull();
    expect(screen.getByRole('button', { name: 'Library' })).toBeVisible();
  });

  it("an abandoned photo's late failure never renames the current one", async () => {
    let failFirst: (reason: Error) => void = () => {};
    h.scanLabel
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          failFirst = reject;
        })
      )
      .mockRejectedValueOnce(new Error('no_label_detected'));
    const { user } = open();
    await pickPhoto(user);
    // Mid-read the tools are hidden: photo A is abandoned by closing, and
    // photo B is picked in the next session.
    await user.keyboard('{Escape}');
    await pickPhoto(user);
    expect(await screen.findByText("Couldn't read the label")).toBeVisible();

    await act(async () => failFirst(new Error('rate_limited')));
    expect(
      screen.getByText('Make sure the whole table is in the photo.')
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('a busy service offers the same photo again', async () => {
    h.scanLabel
      .mockRejectedValueOnce(new Error('rate_limited'))
      .mockResolvedValueOnce({
        basis: 'per_100g',
        confidence: 'high',
        labelEvidence: '',
        productName: 'Bánh quy Cosy',
        servingSize: null,
        servingSizeDescription: null,
        servingsPerContainer: null,
        per100g: {
          calories: 480,
          proteinGrams: 6,
          carbsGrams: 62,
          fatGrams: 22,
        },
      });
    const { user } = open();
    await pickPhoto(user);
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Bánh quy Cosy')).toBeVisible();
    expect(h.scanLabel).toHaveBeenCalledTimes(2);
  });
});

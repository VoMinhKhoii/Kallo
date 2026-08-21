import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  openPaywall: vi.fn(),
  handleClose: vi.fn(),
  handleScanTypeChange: vi.fn(),
}));

vi.mock('@/components/billing/premium-guard-provider', () => ({
  usePremiumGuard: () => ({
    locked: () => true,
    requirePremium: () => false,
    openPaywall: mocks.openPaywall,
  }),
}));

// The sheet's body (camera scanner, OCR tab) is irrelevant here; only the
// scan-type toggle's premium interception is under test.
vi.mock(
  '@/components/logging/input/barcode/use-barcode-scanner-dialog-state',
  () => ({
    useBarcodeScannerDialogState: () => ({
      t: (key: string) => key,
      scanType: 'barcode' as const,
      handleScanTypeChange: mocks.handleScanTypeChange,
      step: 'input' as const,
      setStep: vi.fn(),
      scanMode: 'manual' as const,
      setScanMode: vi.fn(),
      barcode: '',
      setBarcode: vi.fn(),
      searchError: null,
      setSearchError: vi.fn(),
      isSearching: false,
      product: null,
      ocrData: null,
      setOcrData: vi.fn(),
      isStaging: false,
      cameraStatus: 'idle' as const,
      cameras: [],
      selectedCameraId: null,
      effectiveCameraId: null,
      setSelectedCameraId: vi.fn(),
      handleSearch: vi.fn(),
      handleStageMeal: vi.fn(),
      handleConfirmOcrMeal: vi.fn(),
      handleClose: mocks.handleClose,
    }),
  })
);

vi.mock('@/components/logging/input/barcode/barcode-search-form', () => ({
  BarcodeSearchForm: () => <div data-testid="search-form" />,
}));

import { BarcodeScannerDialog } from '../barcode-scanner-dialog';

function renderDialog() {
  return render(
    <BarcodeScannerDialog
      isOpen
      onOpenChange={vi.fn()}
      selectedDate="2026-05-01"
      onSuccess={vi.fn()}
    />
  );
}

describe('BarcodeScannerDialog premium interception', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom ships no matchMedia; ResponsiveSheet reads it to pick drawer vs
    // dialog. Either branch renders the toggle, so answer "desktop".
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  it('opens the paywall once the sheet has actually closed', async () => {
    mocks.handleClose.mockReturnValue(true);
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /ocr/i }));

    expect(mocks.handleClose).toHaveBeenCalledOnce();
    expect(mocks.openPaywall).toHaveBeenCalledOnce();
    expect(mocks.handleScanTypeChange).not.toHaveBeenCalled();
  });

  it('leaves the paywall shut when the sheet refuses to close', async () => {
    // A save in flight makes the sheet undismissable; a paywall opened now
    // would stack on top of a sheet that is still owning the viewport.
    mocks.handleClose.mockReturnValue(false);
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /ocr/i }));

    expect(mocks.handleClose).toHaveBeenCalledOnce();
    expect(mocks.openPaywall).not.toHaveBeenCalled();
  });
});

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resetError: vi.fn(),
  scanLabel: vi.fn(),
  stopCamera: vi.fn(),
}));

vi.mock('@/hooks/meals/entry/use-nutrition-ocr', () => ({
  useNutritionOcr: () => ({
    scanLabel: mocks.scanLabel,
    isCompressing: false,
    isScanning: false,
    error: null,
    resetError: mocks.resetError,
  }),
}));

vi.mock('@/hooks/meals/entry/use-ocr-camera', () => ({
  useOcrCamera: () => ({
    videoRef: { current: null },
    isCameraActive: false,
    cameraError: null,
    cameras: [],
    selectedCameraId: null,
    setSelectedCameraId: vi.fn(),
    capabilities: { torch: false, focusModes: [], resolutions: [] },
    torchEnabled: false,
    setTorch: vi.fn(),
    focusMode: null,
    setFocusMode: vi.fn(),
    resolution: null,
    setResolution: vi.fn(),
    capturePhoto: vi.fn(),
    stopCamera: mocks.stopCamera,
  }),
}));

vi.mock('../ocr-camera-view', () => ({
  OcrCameraView: () => <div>camera-view</div>,
}));

vi.mock('../ocr-upload-panel', () => ({
  OcrUploadPanel: () => <div>upload-panel</div>,
}));

import { OcrScannerTab } from '../ocr-scanner-tab';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function selectFile(container: HTMLElement, name: string) {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('missing input');
  const file = new File(['image'], name, { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi
      .fn()
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:second')
      .mockReturnValueOnce('blob:third'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('OcrScannerTab lifecycle', () => {
  it('revokes previews when replaced, cleared, and unmounted', () => {
    const { container, unmount } = render(
      <OcrScannerTab onSuccess={vi.fn()} onManualEntry={vi.fn()} />
    );

    selectFile(container, 'first.png');
    selectFile(container, 'second.png');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:second');

    selectFile(container, 'third.png');
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:third');
  });

  it('ignores a scan result after the component closes', async () => {
    const scan = deferred<never>();
    mocks.scanLabel.mockReturnValueOnce(scan.promise);
    const onSuccess = vi.fn();
    const { container, unmount } = render(
      <OcrScannerTab onSuccess={onSuccess} onManualEntry={vi.fn()} />
    );
    selectFile(container, 'label.png');

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));
    expect(mocks.scanLabel).toHaveBeenCalledOnce();
    unmount();
    await act(async () => {
      scan.resolve({} as never);
      await scan.promise;
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });
});

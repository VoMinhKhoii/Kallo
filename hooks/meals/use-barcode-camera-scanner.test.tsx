import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const scanner = vi.hoisted(() => ({
  isScanning: false,
  start: vi.fn(),
  stop: vi.fn(),
  getCameras: vi.fn(),
}));

vi.mock('html5-qrcode', () => {
  class Html5Qrcode {
    static getCameras = scanner.getCameras;
    start = scanner.start;
    stop = scanner.stop;
    get isScanning() {
      return scanner.isScanning;
    }
  }
  return {
    Html5Qrcode,
    Html5QrcodeSupportedFormats: {
      EAN_13: 1,
      EAN_8: 2,
      UPC_A: 3,
      UPC_E: 4,
      CODE_128: 5,
    },
  };
});

import { useBarcodeCameraScanner } from './use-barcode-camera-scanner';

beforeEach(() => {
  vi.clearAllMocks();
  scanner.isScanning = false;
  scanner.stop.mockResolvedValue(undefined);
  scanner.getCameras.mockResolvedValue([
    { id: 'front-camera', label: 'Front Camera' },
    { id: 'rear-camera', label: 'Back Camera' },
  ]);
});

describe('useBarcodeCameraScanner', () => {
  it('prefers a labeled rear camera over devices[0]', async () => {
    scanner.start.mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      useBarcodeCameraScanner({
        isActive: true,
        onDecode: vi.fn(),
      })
    );

    await waitFor(() => expect(scanner.start).toHaveBeenCalledOnce());
    expect(scanner.start.mock.calls[0][0]).toBe('rear-camera');
    unmount();
  });

  it('stops a scanner whose pending start resolves after unmount', async () => {
    let resolveStart: (() => void) | undefined;
    scanner.start.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStart = resolve;
        })
    );
    const { unmount } = renderHook(() =>
      useBarcodeCameraScanner({
        isActive: true,
        onDecode: vi.fn(),
      })
    );
    await waitFor(() => expect(scanner.start).toHaveBeenCalledOnce());

    unmount();
    scanner.isScanning = true;
    await act(async () => resolveStart?.());
    await waitFor(() => expect(scanner.stop).toHaveBeenCalledOnce());
  });
});

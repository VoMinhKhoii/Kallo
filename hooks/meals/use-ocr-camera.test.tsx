import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOcrCamera } from './use-ocr-camera';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useOcrCamera', () => {
  it('stops tracks that arrive after the camera becomes inactive', async () => {
    let resolveStream: ((stream: MediaStream) => void) | undefined;
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveStream = resolve;
        })
    );
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;

    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => useOcrCamera(active),
      { initialProps: { active: true } }
    );
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    rerender({ active: false });
    await act(async () => resolveStream?.(stream));

    expect(stop).toHaveBeenCalledOnce();
  });

  it('stops a permission result that arrives after unmount', async () => {
    let resolveStream: ((stream: MediaStream) => void) | undefined;
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveStream = resolve;
        })
    );
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;

    const { unmount } = renderHook(() => useOcrCamera(true));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    unmount();
    await act(async () => resolveStream?.(stream));

    expect(stop).toHaveBeenCalledOnce();
  });
});

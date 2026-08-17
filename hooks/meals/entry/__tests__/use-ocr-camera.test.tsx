import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOcrCamera } from '../use-ocr-camera';

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

  it('stays inactive when stopped while camera enumeration is pending', async () => {
    let resolveStream: ((stream: MediaStream) => void) | undefined;
    let resolveDevices: ((devices: MediaDeviceInfo[]) => void) | undefined;
    const stop = vi.fn();
    const track = {
      stop,
      getCapabilities: () => ({}),
      getSettings: () => ({}),
    };
    const stream = {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream;
    const enumerateDevices = vi.fn(
      () =>
        new Promise<MediaDeviceInfo[]>((resolve) => {
          resolveDevices = resolve;
        })
    );
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(
          () =>
            new Promise<MediaStream>((resolve) => {
              resolveStream = resolve;
            })
        ),
        enumerateDevices,
      },
    });

    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useOcrCamera(active),
      { initialProps: { active: true } }
    );
    result.current.videoRef.current = {
      srcObject: null,
    } as HTMLVideoElement;
    await act(async () => resolveStream?.(stream));
    await waitFor(() => expect(enumerateDevices).toHaveBeenCalledOnce());

    rerender({ active: false });
    await act(async () => resolveDevices?.([]));

    expect(stop).toHaveBeenCalledOnce();
    expect(result.current.isCameraActive).toBe(false);
  });
});

'use client';

import type { Html5Qrcode } from 'html5-qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus =
  | 'initializing'
  | 'scanning'
  | 'permission-denied'
  | 'error';

export interface CameraDevice {
  id: string;
  label: string;
}

interface UseBarcodeCameraScannerOptions {
  /** Only run the camera lifecycle while both are true. */
  isActive: boolean;
  /** Called with the raw decoded text once a barcode is read. The scanner is
   *  stopped before this fires, so the caller may safely start network work. */
  onDecode: (decodedText: string) => void;
}

function playBeep() {
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    osc.start();
    setTimeout(() => {
      try {
        osc.stop();
        ctx.close();
      } catch {}
    }, 120);
  } catch (e) {
    console.warn('Audio beep failed', e);
  }
}

function vibrate() {
  if (navigator.vibrate) {
    try {
      navigator.vibrate(80);
    } catch {}
  }
}

/**
 * Owns the html5-qrcode camera lifecycle: starting/stopping the scanner,
 * enumerating cameras, and surfacing status for the UI. Kept separate from
 * BarcodeScannerDialog so the dialog only orchestrates steps/state and this
 * hook owns the one non-trivial effect (imperative library setup/teardown).
 */
export function useBarcodeCameraScanner({
  isActive,
  onDecode,
}: UseBarcodeCameraScannerOptions) {
  const [cameraStatus, setCameraStatus] =
    useState<CameraStatus>('initializing');
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [effectiveCameraId, setEffectiveCameraId] = useState<string | null>(
    null
  );
  const qrCodeScannerRef = useRef<Html5Qrcode | null>(null);
  // Guards a concurrent stop() — two callers (decode success + effect cleanup)
  // can both observe isScanning === true before either stop() resolves.
  const isStoppingRef = useRef(false);
  // Single-flight guard: html5-qrcode can fire the success callback multiple
  // times (per decoded frame) before stop() actually halts scanning. Ensures
  // only the first decode kicks off the scan→lookup pipeline. Reset when the
  // scanner (re)starts for a fresh scan attempt.
  const hasDecodedRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (!qrCodeScannerRef.current || isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      if (qrCodeScannerRef.current.isScanning) {
        await qrCodeScannerRef.current.stop();
      }
    } catch (err) {
      console.error('Error stopping scanner:', err);
    } finally {
      qrCodeScannerRef.current = null;
      isStoppingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    let isMounted = true;
    hasDecodedRef.current = false;
    let scannerInstance: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        // Kept inside the async start path (not the effect body) to avoid the
        // react-hooks/set-state-in-effect lint on a synchronous effect setState.
        setCameraStatus('initializing');
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
          'html5-qrcode'
        );
        if (!isMounted) return;

        // Query available cameras
        let devices: CameraDevice[] = [];
        try {
          devices = await Html5Qrcode.getCameras();
          if (isMounted) {
            setCameras(devices);
          }
        } catch (e) {
          console.warn('Failed to get cameras:', e);
        }

        // Wait slightly for DOM element to render
        await new Promise((resolve) => setTimeout(resolve, 150));
        if (!isMounted) return;

        const scanner = new Html5Qrcode('kallo-barcode-scanner', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
          verbose: false,
        });
        qrCodeScannerRef.current = scanner;
        scannerInstance = scanner;

        const environmentCamera = devices.find((device) =>
          /back|rear|environment|traseira|rück|arrière|sau/i.test(device.label)
        );
        // Prefer the user's explicit choice, then a labeled rear camera. When
        // labels are unavailable, let facingMode choose instead of assuming
        // devices[0] is the rear lens (it is commonly the selfie camera).
        const cameraConfig =
          selectedCameraId ||
          environmentCamera?.id ||
          ({ facingMode: { ideal: 'environment' } } as const);

        await scanner.start(
          cameraConfig,
          {
            fps: 25,
            qrbox: (width: number, height: number) => {
              // Expand decodable bounds (90% width, 70% height) for reliable scan hits
              const w = Math.max(50, Math.round(width * 0.9));
              const h = Math.max(50, Math.round(height * 0.7));
              return { width: w, height: h };
            },
            aspectRatio: 1.333333,
          },
          (decodedText: string) => {
            // Suppress repeat firings while the first decode is in flight.
            if (hasDecodedRef.current) return;
            hasDecodedRef.current = true;

            playBeep();
            vibrate();

            stopScanner().then(() => {
              if (!isMounted) return;
              onDecode(decodedText);
            });
          },
          () => {
            // Ignore verbose scanning errors
          }
        );

        if (!isMounted) {
          if (scanner.isScanning) await scanner.stop();
          if (qrCodeScannerRef.current === scanner) {
            qrCodeScannerRef.current = null;
          }
          return;
        }
        const runningCameraId = scanner.getRunningTrackSettings().deviceId;
        setEffectiveCameraId(
          runningCameraId ??
            (typeof cameraConfig === 'string' ? cameraConfig : null)
        );
        setCameraStatus('scanning');
      } catch (err) {
        console.error('Failed to start scanner:', err);
        if (isMounted) {
          const errStr = String(err).toLowerCase();
          if (errStr.includes('permission') || errStr.includes('notallowed')) {
            setCameraStatus('permission-denied');
          } else {
            setCameraStatus('error');
          }
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (scannerInstance) {
        try {
          if (scannerInstance.isScanning) {
            scannerInstance.stop().catch(console.error);
          }
        } catch {}
      }
    };
  }, [isActive, onDecode, selectedCameraId, stopScanner]);

  return {
    cameraStatus,
    cameras,
    selectedCameraId,
    effectiveCameraId,
    setSelectedCameraId,
    stopScanner,
  };
}

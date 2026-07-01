'use client';

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
  /** Called ~3s after the camera fails to start (permission denied or
   *  error), so the caller can fall back to manual entry. */
  onCameraFailure: () => void;
}

function playBeep() {
  try {
    const AudioContextCtor =
      window.AudioContext || (window as any).webkitAudioContext;
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
  onCameraFailure,
}: UseBarcodeCameraScannerOptions) {
  const [cameraStatus, setCameraStatus] =
    useState<CameraStatus>('initializing');
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const qrCodeScannerRef = useRef<any>(null);

  const stopScanner = useCallback(async () => {
    if (qrCodeScannerRef.current) {
      try {
        if (qrCodeScannerRef.current.isScanning) {
          await qrCodeScannerRef.current.stop();
        }
      } catch (err) {
        console.error('Error stopping scanner:', err);
      } finally {
        qrCodeScannerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    let isMounted = true;
    setCameraStatus('initializing');
    let scannerInstance: any = null;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
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

        const scanner = new Html5Qrcode('nham-barcode-scanner');
        qrCodeScannerRef.current = scanner;
        scannerInstance = scanner;

        // Select camera config:
        // 1. User selected camera ID
        // 2. First camera from queried list
        // 3. Fallback standard facingMode environment configuration
        const cameraConfig =
          selectedCameraId ||
          (devices.length > 0 ? devices[0].id : { facingMode: 'environment' });

        await scanner.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: (width: number, height: number) => {
              // Ensure qrbox dimensions are always at least 50px to prevent library errors
              const w = Math.max(50, Math.round(width * 0.75));
              const h = Math.max(50, Math.round(height * 0.4));
              return { width: w, height: h };
            },
            aspectRatio: 1.777778,
          },
          (decodedText: string) => {
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

        if (isMounted) {
          setCameraStatus('scanning');
        }
      } catch (err: any) {
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

  // Auto switch away from camera mode a few seconds after a failure — gives
  // the "starting camera" message a moment to display before bailing out.
  useEffect(() => {
    if (cameraStatus !== 'permission-denied' && cameraStatus !== 'error') {
      return;
    }
    const timeout = setTimeout(() => {
      onCameraFailure();
    }, 3000);
    return () => clearTimeout(timeout);
  }, [cameraStatus, onCameraFailure]);

  return {
    cameraStatus,
    cameras,
    selectedCameraId,
    setSelectedCameraId,
    stopScanner,
  };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  OcrCameraCapabilities,
  OcrCameraDevice,
  OcrCameraError,
  OcrCameraResolution,
} from './ocr-camera-types';

type ExtendedCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  focusMode?: string[];
};
type ExtendedSettings = MediaTrackSettings & { focusMode?: string };
type ExtendedConstraint = MediaTrackConstraintSet & {
  torch?: boolean;
  focusMode?: string;
};

const EMPTY_CAPABILITIES: OcrCameraCapabilities = {
  torch: false,
  focusModes: [],
  resolutions: [],
};

function supportedResolutions(
  capabilities: MediaTrackCapabilities
): OcrCameraResolution[] {
  const width = capabilities.width;
  const height = capabilities.height;
  if (
    !width ||
    width.min === undefined ||
    width.max === undefined ||
    !height ||
    height.min === undefined ||
    height.max === undefined
  ) {
    return [];
  }
  const minWidth = width.min;
  const maxWidth = width.max;
  const minHeight = height.min;
  const maxHeight = height.max;
  return [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 3840, height: 2160 },
  ].filter(
    (item) =>
      item.width >= minWidth &&
      item.width <= maxWidth &&
      item.height >= minHeight &&
      item.height <= maxHeight
  );
}

export function useOcrCamera(isActive: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestGenerationRef = useRef(0);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<OcrCameraError | null>(null);
  const [cameras, setCameras] = useState<OcrCameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [capabilities, setCapabilities] =
    useState<OcrCameraCapabilities>(EMPTY_CAPABILITIES);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [focusMode, setFocusModeState] = useState<string | null>(null);
  const [resolution, setResolutionState] = useState<OcrCameraResolution | null>(
    null
  );

  const stopCamera = useCallback(() => {
    requestGenerationRef.current += 1;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    setIsCameraActive(false);
    setTorchEnabled(false);
    setCapabilities(EMPTY_CAPABILITIES);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    const requestGeneration = ++requestGenerationRef.current;
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
      });
      if (
        requestGeneration !== requestGenerationRef.current ||
        !videoRef.current
      ) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      const track = stream.getVideoTracks()[0];
      if (track) {
        const rawCapabilities = track.getCapabilities() as ExtendedCapabilities;
        const resolutions = supportedResolutions(rawCapabilities);
        const settings = track.getSettings() as ExtendedSettings;
        setCapabilities({
          torch: rawCapabilities.torch === true,
          focusModes: rawCapabilities.focusMode ?? [],
          resolutions,
        });
        setFocusModeState(settings.focusMode ?? null);
        const currentResolution =
          settings.width && settings.height
            ? { width: settings.width, height: settings.height }
            : (resolutions.at(-1) ?? null);
        setResolutionState(currentResolution);
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (requestGeneration === requestGenerationRef.current) {
        setCameras(
          devices
            .filter((device) => device.kind === 'videoinput')
            .map((device) => ({ id: device.deviceId, label: device.label }))
        );
      }
      setIsCameraActive(true);
    } catch (error) {
      if (requestGeneration !== requestGenerationRef.current) return;
      console.warn('Failed to access OCR camera:', error);
      const name = (error as { name?: string } | null)?.name;
      setCameraError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'permission_denied'
          : 'unavailable'
      );
      setIsCameraActive(false);
    }
  }, [selectedCameraId, stopCamera]);

  useEffect(() => {
    if (isActive) startCamera();
    else stopCamera();
    return stopCamera;
  }, [isActive, startCamera, stopCamera]);

  const applyAdvancedConstraint = useCallback(
    async (constraint: ExtendedConstraint) => {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return false;
      try {
        await track.applyConstraints({
          advanced: [constraint as MediaTrackConstraintSet],
        });
        return true;
      } catch (error) {
        console.warn('Could not apply OCR camera control:', error);
        return false;
      }
    },
    []
  );

  const setTorch = useCallback(
    async (enabled: boolean) => {
      if (await applyAdvancedConstraint({ torch: enabled })) {
        setTorchEnabled(enabled);
      }
    },
    [applyAdvancedConstraint]
  );
  const setFocusMode = useCallback(
    async (mode: string) => {
      if (await applyAdvancedConstraint({ focusMode: mode })) {
        setFocusModeState(mode);
      }
    },
    [applyAdvancedConstraint]
  );
  const setResolution = useCallback(async (next: OcrCameraResolution) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        width: { ideal: next.width },
        height: { ideal: next.height },
      });
      setResolutionState(next);
    } catch (error) {
      console.warn('Could not apply OCR camera resolution:', error);
    }
  }, []);

  const capturePhoto = useCallback((): Promise<File | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video) return resolve(null);
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const context = canvas.getContext('2d');
      if (!context) return resolve(null);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(null);
          stopCamera();
          resolve(
            new File([blob], 'nutrition-label.jpg', { type: 'image/jpeg' })
          );
        },
        'image/jpeg',
        0.9
      );
    });
  }, [stopCamera]);

  return {
    videoRef,
    isCameraActive,
    cameraError,
    cameras,
    selectedCameraId,
    setSelectedCameraId,
    capabilities,
    torchEnabled,
    setTorch,
    focusMode,
    setFocusMode,
    resolution,
    setResolution,
    capturePhoto,
    stopCamera,
  };
}

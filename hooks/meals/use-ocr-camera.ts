'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useOcrCamera(isActive: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      console.warn('Failed to access camera:', err);
      setCameraError('Camera access unavailable or denied.');
      setIsCameraActive(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isActive, startCamera, stopCamera]);

  const capturePhoto = useCallback((): Promise<File | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current) return resolve(null);
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(null);
          const file = new File([blob], 'nutrition-label.jpg', {
            type: 'image/jpeg',
          });
          stopCamera();
          resolve(file);
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
    capturePhoto,
    stopCamera,
  };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  OcrScanError,
  useNutritionOcr,
} from '@/hooks/meals/entry/use-nutrition-ocr';
import type {
  OcrErrorCode,
  ParsedNutritionLabel,
} from '@/lib/domain/nutrition/ocr/schema';
import type { AiConsentGate } from '@/lib/domain/privacy/consent-gate';

/**
 * Reading one label photo: it is read the moment it is taken or picked (no
 * second "scan this photo" step), held on the camera stage while it is read
 * and under its result, and dropped on "Not now" to AI processing.
 *
 * The latest photo always wins: a read that lands after a newer photo, a
 * retake or a close is dropped by the token, never shown. Object URLs are
 * revoked whenever a photo is replaced or the dialog goes away.
 */
export function useScanLabel(aiConsent: AiConsentGate) {
  const { scanLabel } = useNutritionOcr(aiConsent);
  const [photo, setPhoto] = useState<string | null>(null);
  const [label, setLabel] = useState<ParsedNutritionLabel | null>(null);
  // Held here, per photo, rather than read from the OCR hook: its pending
  // and error state are shared by every request, so a read the user already
  // left would otherwise spin, fail or rename the current failure.
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<OcrErrorCode | null>(null);
  const tokenRef = useRef(0);
  const fileRef = useRef<File | null>(null);
  const photoRef = useRef<string | null>(null);

  const showPhoto = useCallback((next: string | null) => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current);
    photoRef.current = next;
    setPhoto(next);
  }, []);

  useEffect(
    () => () => {
      tokenRef.current += 1;
      if (photoRef.current) URL.revokeObjectURL(photoRef.current);
    },
    []
  );

  const reset = useCallback(() => {
    tokenRef.current += 1;
    fileRef.current = null;
    showPhoto(null);
    setLabel(null);
    setReading(false);
    setError(null);
  }, [showPhoto]);

  const read = useCallback(
    async (file: File) => {
      const token = ++tokenRef.current;
      fileRef.current = file;
      showPhoto(URL.createObjectURL(file));
      setLabel(null);
      setError(null);
      setReading(true);
      try {
        const result = await scanLabel(file);
        if (token !== tokenRef.current) return;
        setReading(false);
        // Null: "Not now" to AI processing — nothing was sent; the photo goes
        // and the camera comes back rather than leaving it frozen there.
        if (result) setLabel(result);
        else reset();
      } catch (failure) {
        if (token !== tokenRef.current) return;
        setReading(false);
        setError(
          failure instanceof OcrScanError ? failure.code : 'server_error'
        );
      }
    },
    [reset, scanLabel, showPhoto]
  );

  /** "Try again": the same photo, for a service that was busy. */
  const retry = useCallback(() => {
    if (fileRef.current) read(fileRef.current);
  }, [read]);

  return {
    photo,
    label,
    reading,
    /** This photo's failure — never one from a photo the user moved past. */
    error,
    read,
    retry,
    reset,
    /** The photo session now, for a capture that resolves later. */
    session: () => tokenRef.current,
    isCurrent: (session: number) => session === tokenRef.current,
  };
}

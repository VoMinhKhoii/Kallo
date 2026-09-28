'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { usePremiumGuard } from '@/components/billing/premium-guard-provider';
import { useAiConsent } from '@/components/privacy/ai-consent-provider';
import { useOcrCamera } from '@/hooks/meals/entry/use-ocr-camera';
import { useBarcodeCameraScanner } from '@/hooks/ui/use-barcode-camera-scanner';
import { blankScanFood, type ScanFood } from '@/lib/domain/scan/food';
import { type ScanMode, scanViewFor } from './scan-view';
import { useScanLabel } from './use-scan-label';
import { useScanLookup } from './use-scan-lookup';
import { useScanResult } from './use-scan-result';

export interface ScanDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  onSuccess: () => void;
}

/**
 * The scan dialog's state, anchored on the Flutter scan screen: one camera
 * in barcode or nutrition-label mode, and whatever stands over it — a result,
 * a miss, the barcode keypad, the editor ([scanViewFor]). The cameras run only
 * while nothing covers them.
 */
export function useScanDialog({
  isOpen,
  onOpenChange,
  selectedDate,
  onSuccess,
}: ScanDialogProps) {
  const t = useTranslations('logging');
  const { locked, openPaywall } = usePremiumGuard();
  const { gate: aiConsent } = useAiConsent();
  const [mode, setMode] = useState<ScanMode>('barcode');
  const { lookup, search, reset: resetLookup } = useScanLookup();
  const label = useScanLabel(aiConsent);
  const { reset: resetLabel } = label;

  const close = useCallback((): boolean => {
    resetLookup();
    resetLabel();
    setMode('barcode');
    onOpenChange(false);
    return true;
  }, [onOpenChange, resetLabel, resetLookup]);

  const result = useScanResult({
    loggedDate: selectedDate,
    onSaved: () => {
      toast.success(t('scan.saved'));
      onSuccess();
      close();
    },
    // The sheet owns the viewport on phones, so the paywall replaces it.
    onLocked: () => {
      close();
      openPaywall();
    },
  });

  /** Close unless a save is in flight; says whether it closed. */
  const { saving, clear } = result;
  const tryClose = useCallback((): boolean => {
    if (saving) return false;
    clear();
    return close();
  }, [clear, close, saving]);

  const view = scanViewFor({
    mode,
    lookup,
    label,
    typing: result.typing,
    editing: result.editing,
    editedFood: result.editedFood,
    fallbackName: t('scan.scannedFood'),
  });
  const live = isOpen && view.kind === 'camera';

  // Stable, or the camera hook would restart the camera on every render
  // (the callback is one of its effect's dependencies).
  const onDecode = useCallback(
    (code: string, frame: string | null) => search(code, frame),
    [search]
  );
  const barcodeCamera = useBarcodeCameraScanner({
    isActive: live && mode === 'barcode',
    onDecode,
  });
  const labelCamera = useOcrCamera(live && mode === 'label' && !label.photo);

  // A server that says "Premium" to a scan the UI thought was open (a plan
  // that lapsed mid-session) sends the user where the gate would have.
  const featureLocked = label.error === 'feature_locked';
  useEffect(() => {
    if (featureLocked && tryClose()) openPaywall();
  }, [featureLocked, openPaywall, tryClose]);

  /** Premium actions (label scan, edit, typing a food) share one gate. The
   *  sheet owns the viewport on phones, so the paywall replaces it. */
  const gated = (action: () => void) => () => {
    if (!locked('label_scan')) return action();
    if (tryClose()) openPaywall();
  };

  /** Back to a live camera from any result or miss. */
  const resume = () => {
    clear();
    resetLookup();
    resetLabel();
  };

  const switchMode = (next: ScanMode) => {
    if (next === mode) return;
    resume();
    setMode(next);
  };

  return {
    t,
    mode,
    view,
    labelLocked: locked('label_scan'),
    lookup,
    label,
    result,
    barcodeCamera,
    labelCamera,
    close: tryClose,
    resume,
    switchMode: (next: ScanMode) =>
      next === 'label' ? gated(() => switchMode(next))() : switchMode(next),
    searchTyped: (digits: string) => {
      result.setTyping(false);
      search(digits);
    },
    // A shot still being taken when the user closed, retook or switched
    // mode belongs to a session they left: it is never read.
    shoot: async () => {
      const session = label.session();
      const file = await labelCamera.capturePhoto();
      if (file && label.isCurrent(session)) label.read(file);
    },
    enterManually: gated(() => result.openEditor(blankScanFood(), true)),
    edit: (food: ScanFood) => gated(() => result.openEditor(food, false)),
    scanLabelInstead: gated(() => switchMode('label')),
  };
}

export type ScanDialogState = ReturnType<typeof useScanDialog>;

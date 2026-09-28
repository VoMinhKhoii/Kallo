'use client';

import { AnimatePresence } from 'motion/react';
import { ResponsiveSheet } from '@/components/shared/responsive-sheet';
import { ScanBusyOverlay } from './camera/scan-busy-overlay';
import { ScanCameraControls } from './camera/scan-camera-controls';
import { ScanCameraStage } from './camera/scan-camera-stage';
import { renderScanPanel } from './scan-panels';
import { type ScanDialogProps, useScanDialog } from './use-scan-dialog';

/**
 * Scan a packaged food — its barcode, or the nutrition table printed on it —
 * and log it in one go. Anchored on the Flutter scan screen: the camera fills
 * the sheet, and results, misses, the barcode keypad and the editor rise over
 * the frozen frame, so what was scanned stays in view.
 */
export function ScanDialog(props: ScanDialogProps) {
  const s = useScanDialog(props);
  const { t, mode, view, lookup, label, labelCamera, barcodeCamera } = s;

  const cameraProblem =
    mode === 'barcode'
      ? barcodeCamera.cameraStatus === 'permission-denied'
        ? t('scan.cameraDenied')
        : barcodeCamera.cameraStatus === 'error'
          ? t('scan.cameraError')
          : null
      : labelCamera.cameraError === 'permission_denied'
        ? t('scan.cameraDenied')
        : labelCamera.cameraError
          ? t('scan.cameraError')
          : null;

  return (
    <ResponsiveSheet
      open={props.isOpen}
      onOpenChange={(open) => !open && s.close()}
      // A save in flight must not be dismissable: it would still complete
      // server-side, logging a meal the user never saw confirmed.
      dismissible={!s.result.saving}
      title={t('scan.dialogTitle')}
      className="h-[90dvh] sm:h-[min(820px,90dvh)]"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ScanCameraStage
          mode={mode}
          held={mode === 'barcode' ? lookup.frame : label.photo}
          labelVideoRef={labelCamera.videoRef}
          problem={view.kind === 'camera' ? cameraProblem : null}
          dimmed={view.kind === 'busy'}
        />
        {view.kind === 'busy' && (
          <ScanBusyOverlay
            text={
              view.text === 'lookingUp'
                ? t('scan.lookingUp')
                : t('scan.reading')
            }
          />
        )}
        {view.kind === 'camera' && (
          <ScanCameraControls
            mode={mode}
            labelLocked={s.labelLocked}
            lightOn={labelCamera.torchEnabled}
            onLight={
              mode === 'label' && labelCamera.capabilities.torch
                ? () => labelCamera.setTorch(!labelCamera.torchEnabled)
                : undefined
            }
            onMode={s.switchMode}
            onClose={s.close}
            onTypeBarcode={() => s.result.setTyping(true)}
            onPickFile={label.read}
            onShutter={s.shoot}
            onEnterManually={s.enterManually}
          />
        )}
        <AnimatePresence>{renderScanPanel(s)}</AnimatePresence>
      </div>
    </ResponsiveSheet>
  );
}

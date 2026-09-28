'use client';

import { Camera, RotateCcw, ScanBarcode, ScanText } from 'lucide-react';
import { ScanFoodEditor } from './editor/scan-food-editor';
import { type ScanStateAction, ScanStatePanel } from './panel/scan-state-panel';
import { TypeBarcodePanel } from './panel/type-barcode-panel';
import { ScanResultPanel } from './result/scan-result-panel';
import type { ScanDialogState } from './use-scan-dialog';

/**
 * The panel standing over the camera for the dialog's current view — the
 * Flutter app's `buildScanPanel`. Null for the live camera and while busy.
 * A render function, not a component: each panel comes back KEYED, as a direct
 * child of the dialog's `AnimatePresence`, so one sliding out and the next
 * sliding in animate as two.
 */
export function renderScanPanel(s: ScanDialogState) {
  const { t, view, result } = s;
  const miss = (
    kind: 'empty' | 'error',
    title: string,
    message: string,
    actions: ScanStateAction[]
  ) => (
    <ScanStatePanel
      key={`miss-${view.kind}`}
      kind={kind}
      title={title}
      message={message}
      actions={actions}
      onClose={s.resume}
      onEnterManually={s.enterManually}
    />
  );

  switch (view.kind) {
    case 'editor':
      return (
        <ScanFoodEditor
          key="editor"
          food={view.food}
          isNew={view.isNew}
          onDone={result.finishEditing}
          onCancel={result.cancelEditing}
        />
      );
    case 'result':
      return (
        <ScanResultPanel
          key={view.key}
          food={view.food}
          amount={result.amount}
          saving={result.saving}
          errorKey={result.saveError}
          onAmount={result.setAmount}
          onClose={s.resume}
          onEdit={s.edit(view.food)}
          onAdd={(amount) => result.add(view.food, amount)}
        />
      );
    case 'typing':
      return (
        <TypeBarcodePanel
          key="typing"
          onBack={() => result.setTyping(false)}
          onLookUp={s.searchTyped}
        />
      );
    case 'notFound':
      return miss(
        'empty',
        t('scan.notFoundTitle'),
        t('scan.notFoundBody', { code: view.code }),
        [
          {
            label: t('scan.scanLabel'),
            icon: ScanText,
            onClick: s.scanLabelInstead,
          },
        ]
      );
    case 'lookupFailed':
      return miss(
        'error',
        t('scan.lookupFailedTitle'),
        t(`barcodeError.${view.error}`),
        [{ label: t('scan.scanAgain'), icon: ScanBarcode, onClick: s.resume }]
      );
    case 'labelFailed':
      return miss(
        'error',
        t('scan.labelFailedTitle'),
        view.error === 'no_label_detected'
          ? t('scan.labelFailedBody')
          : t(`ocrError.${view.error}`),
        [
          ...(view.temporary
            ? [
                {
                  label: t('scan.tryAgain'),
                  icon: RotateCcw,
                  onClick: s.label.retry,
                },
              ]
            : []),
          { label: t('scan.retake'), icon: Camera, onClick: s.resume },
          ...(view.temporary
            ? []
            : [
                {
                  label: t('scan.scanBarcode'),
                  icon: ScanBarcode,
                  onClick: () => s.switchMode('barcode'),
                },
              ]),
        ]
      );
    default:
      return null;
  }
}

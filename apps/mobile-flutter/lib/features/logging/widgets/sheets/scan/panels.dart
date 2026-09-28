import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../shared/data/surface_cast.dart';
import '../../../data/barcode_providers.dart';
import '../../../data/label_scan_providers.dart';
import '../../../logic/scan/amount.dart';
import '../../../logic/scan/food.dart';
import 'camera/mode_chip.dart';
import 'editor/editor.dart';
import 'panel/state_panel.dart';
import 'panel/type_barcode.dart';
import 'result/panel.dart';
import 'screen.dart';

/// Which panel stands over the camera right now, from the two flows' states
/// plus the screen's own (typing, editing, an edited food). Null = the live
/// camera. Every panel is keyed so a change of panel animates as one.
Widget? buildScanPanel(
  ScanScreenState s,
  BarcodeFlowState barcode,
  LabelScanState label,
) {
  final editing = s.editing;
  if (editing != null) {
    return ScanFoodEditor(
      key: const ValueKey('editor'),
      food: editing.food,
      isNew: editing.isNew,
      onDone: s.finishEditing,
      onCancel: s.cancelEditing,
    );
  }
  final edited = s.editedFood;
  if (edited != null) return _result(s, edited, key: 'edited');
  return s.mode == ScanType.barcode
      ? _barcodePanel(s, barcode)
      : _labelPanel(s, label);
}

Widget? _barcodePanel(ScanScreenState s, BarcodeFlowState barcode) {
  if (s.typing) {
    return TypeBarcodePanel(
      key: const ValueKey('typing'),
      onBack: s.stopTyping,
      onLookUp: s.lookUpTyped,
      searching: false,
    );
  }
  final product = barcode.product;
  if (product != null &&
      (barcode.phase == BarcodeFlowPhase.product ||
          barcode.phase == BarcodeFlowPhase.saving)) {
    return _result(
      s,
      ScanFood.fromBarcode(product),
      key: 'barcode-${product.barcode}',
    );
  }
  if (barcode.phase != BarcodeFlowPhase.scanning || barcode.errorKey == null) {
    return null;
  }
  if (barcode.isNotFound) {
    return _miss(
      s,
      key: 'not-found',
      kind: SurfaceKind.empty,
      title: 'logging.scan.notFoundTitle'.tr(),
      message: 'logging.scan.notFoundBody'.tr(
        namedArgs: {'code': barcode.lastBarcode ?? ''},
      ),
      actions: [
        ScanStateAction(
          label: 'logging.scan.scanLabel'.tr(),
          icon: LucideIcons.scanText300,
          onTap: s.gated(() => s.switchMode(ScanType.label)),
        ),
      ],
    );
  }
  // Anything else (busy, offline, an unreadable code) is worth another try.
  return _miss(
    s,
    key: 'barcode-error',
    kind: SurfaceKind.error,
    title: 'logging.scan.lookupFailedTitle'.tr(),
    message: barcode.errorKey!.tr(),
    actions: [
      ScanStateAction(
        label: 'logging.scan.scanAgain'.tr(),
        icon: LucideIcons.scanBarcode300,
        onTap: s.resumeScanning,
      ),
    ],
  );
}

Widget? _labelPanel(ScanScreenState s, LabelScanState label) {
  final read = label.label;
  if (label.phase == LabelScanPhase.review && read != null) {
    return _result(
      s,
      ScanFood.fromLabel(read, fallbackName: 'logging.scan.scannedFood'.tr()),
      key: 'label',
    );
  }
  final error = label.errorKey;
  // A camera problem is the camera layer's to say, with the tools still live
  // (Library, Enter manually); the paywall and the consent ask are the
  // screen's to open.
  if (error == null ||
      label.cameraProblemKey != null ||
      label.isFeatureLocked ||
      label.isAiConsentRequired) {
    return null;
  }
  // A busy or failed SERVICE can read the same photo next time; a photo with
  // no readable table cannot, so it is never offered again (owner review).
  final temporary =
      label.image != null &&
      (error.endsWith('.rateLimited') || error.endsWith('.serverError'));
  final notice = label.isNoLabelDetected;
  return _miss(
    s,
    key: 'label-failed',
    kind: SurfaceKind.error,
    title: 'logging.scan.labelFailedTitle'.tr(),
    message: notice ? 'logging.scan.labelFailedBody'.tr() : error.tr(),
    actions: [
      if (temporary)
        ScanStateAction(
          label: 'logging.scan.tryAgain'.tr(),
          icon: LucideIcons.rotateCcw300,
          onTap: s.scanLabel,
        ),
      ScanStateAction(
        label: 'logging.scan.retake'.tr(),
        icon: LucideIcons.camera300,
        onTap: s.resumeScanning,
      ),
      if (!temporary)
        ScanStateAction(
          label: 'logging.scan.scanBarcode'.tr(),
          icon: LucideIcons.scanBarcode300,
          onTap: () => s.switchMode(ScanType.barcode),
        ),
    ],
  );
}

/// A miss over the camera: what happened, the ways on, and — as on every
/// miss — back to scanning (the close) or "Enter manually".
Widget _miss(
  ScanScreenState s, {
  required String key,
  required SurfaceKind kind,
  required String title,
  required String message,
  required List<ScanStateAction> actions,
}) => ScanStatePanel(
  key: ValueKey(key),
  kind: kind,
  title: title,
  message: message,
  actions: actions,
  onClose: s.resumeScanning,
  onEnterManually: s.gated(s.enterManually),
);

Widget _result(ScanScreenState s, ScanFood food, {required String key}) {
  return ScanResultPanel(
    key: ValueKey(key),
    food: food,
    // A photographed or typed food is not a product the composer can hand
    // back by reference, so only an unedited barcode product takes the
    // purpose's "Add to meal"; everything else logs.
    ctaLabel:
        (food.logsByBarcode
                ? s.widget.purpose.ctaKey
                : 'logging.barcode.addMeal')
            .tr(),
    amount: s.amount ?? ScanAmount.initial(food),
    onAmount: s.setAmount,
    saving: s.saving,
    errorText: s.saveError,
    onClose: s.resumeScanning,
    onEdit: s.gated(() => s.openEditor(food, isNew: false)),
    onAdd: (amount) => s.add(food, amount),
  );
}

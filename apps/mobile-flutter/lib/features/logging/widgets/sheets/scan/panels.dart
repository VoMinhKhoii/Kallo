import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../shared/data/surface_cast.dart';
import '../../../data/barcode_providers.dart';
import '../../../data/label_scan_providers.dart';
import '../../../logic/scan/food.dart';
import 'camera/mode_chip.dart';
import 'editor/editor.dart';
import 'panel/state_panel.dart';
import 'panel/type_barcode.dart';
import 'panel/page_stack.dart';
import 'result_page.dart';
import 'screen.dart';

/// Which page of the scan sheet shows right now, from the two flows' states
/// plus the screen's own (typing, editing, an edited food, the other
/// nutrients). Null = no sheet: the live camera. Each page is keyed — a new
/// key is a new page — and levelled: the result, a miss and typing a code are
/// level 0, the editor and the other nutrients level 1, so going in pushes
/// and coming out pops, inside the one sheet.
ScanSheetPage? buildScanPanel(
  ScanScreenState s,
  BarcodeFlowState barcode,
  LabelScanState label,
) {
  final editing = s.editing;
  if (editing != null) {
    return ScanSheetPage(
      key: const ValueKey('editor'),
      level: 1,
      child: ScanFoodEditor(
        food: editing.food,
        isNew: editing.isNew,
        onDone: s.finishEditing,
        onCancel: s.cancelEditing,
      ),
    );
  }
  final edited = s.editedFood;
  if (edited != null) return scanResultPage(s, edited, key: 'edited');
  return s.mode == ScanType.barcode
      ? _barcodePanel(s, barcode)
      : _labelPanel(s, label);
}

ScanSheetPage _page(String key, Widget child) =>
    ScanSheetPage(key: ValueKey(key), level: 0, child: child);

ScanSheetPage? _barcodePanel(ScanScreenState s, BarcodeFlowState barcode) {
  if (s.typing) {
    return _page(
      'typing',
      TypeBarcodePanel(
        onBack: s.stopTyping,
        onLookUp: s.lookUpTyped,
        searching: false,
      ),
    );
  }
  final product = barcode.product;
  if (product != null &&
      (barcode.phase == BarcodeFlowPhase.product ||
          barcode.phase == BarcodeFlowPhase.saving)) {
    return scanResultPage(
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

ScanSheetPage? _labelPanel(ScanScreenState s, LabelScanState label) {
  final read = label.label;
  if (label.phase == LabelScanPhase.review && read != null) {
    return scanResultPage(
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
ScanSheetPage _miss(
  ScanScreenState s, {
  required String key,
  required SurfaceKind kind,
  required String title,
  required String message,
  required List<ScanStateAction> actions,
}) => _page(
  key,
  ScanStatePanel(
    kind: kind,
    title: title,
    message: message,
    actions: actions,
    onClose: s.resumeScanning,
    onEnterManually: s.gated(s.enterManually),
  ),
);

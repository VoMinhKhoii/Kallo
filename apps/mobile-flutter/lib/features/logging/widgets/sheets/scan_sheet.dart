import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../data/barcode_providers.dart';
import '../../data/label_scan_providers.dart';
import 'barcode/barcode_scanner_sheet.dart';
import 'label/label_scan_branch.dart';
import 'scan_type_toggle.dart';

/// Open the scan sheet: read a packaged product either by its barcode or by
/// the nutrition table printed on the box, then log it in one shot — no
/// pending-confirmation card either way.
///
/// The two scanners are deliberately one sheet. When a barcode isn't in Open
/// Food Facts, the nutrition table is right there on the package; when a photo
/// has no readable table, the barcode usually still scans. So each failure
/// offers the other as its recovery action, and the toggle up top lets the
/// user switch before failing at all.
///
/// Resolves to `true` when a meal was logged (the caller toasts).
/// [onFallbackToText] hands the user the AI composer instead.
Future<bool?> showScanSheet(
  BuildContext context, {
  required String userId,
  required String date,
  VoidCallback? onFallbackToText,
}) {
  return showNhamSheet<bool>(
    context,
    isScrollControlled: true,
    builder: (context) => ScanSheet(
      userId: userId,
      date: date,
      onFallbackToText: onFallbackToText,
    ),
  );
}

class ScanSheet extends ConsumerStatefulWidget {
  const ScanSheet({
    super.key,
    required this.userId,
    required this.date,
    this.onFallbackToText,
  });

  final String userId;
  final String date;
  final VoidCallback? onFallbackToText;

  @override
  ConsumerState<ScanSheet> createState() => _ScanSheetState();
}

class _ScanSheetState extends ConsumerState<ScanSheet> {
  ScanType _scanType = ScanType.barcode;

  void _switchTo(ScanType type) {
    if (type == _scanType || !mounted) return;
    setState(() => _scanType = type);
  }

  @override
  Widget build(BuildContext context) {
    final barcode = ref.watch(barcodeFlowProvider);
    final label = ref.watch(labelScanProvider);
    final saving =
        barcode.phase == BarcodeFlowPhase.saving ||
        label.phase == LabelScanPhase.saving;
    final maxHeight = MediaQuery.of(context).size.height * 0.9;
    final keyboardInset = MediaQuery.of(context).viewInsets.bottom;
    final reviewing =
        _scanType == ScanType.label &&
        (label.phase == LabelScanPhase.review ||
            label.phase == LabelScanPhase.saving);

    // While a log request is in flight the sheet must not be dismissable: the
    // POST would still complete server-side, silently logging a meal the user
    // never saw confirmed (and a re-scan would then duplicate it). PopScope
    // covers the scrim tap and system back (both go through maybePop);
    // IgnorePointer covers drag-to-dismiss, whose route-level gesture detector
    // defers its hit test to this child.
    return PopScope(
      canPop: !saving,
      child: IgnorePointer(
        ignoring: saving,
        child: Padding(
          padding: EdgeInsets.only(bottom: keyboardInset),
          child: KalloSheetSurface(
            constraints: BoxConstraints(maxHeight: maxHeight),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                KalloSheetHeader(
                  title: _title(reviewing),
                  closeEnabled: !saving,
                ),
                // Switching scan type once a product or a scanned label is on
                // screen would throw that work away, so the toggle only shows
                // while the active branch is still at its entry step.
                if (_showsToggle(barcode, label))
                  ScanTypeToggle(value: _scanType, onChange: _switchTo),
                Flexible(child: _buildBranch()),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBranch() => _scanType == ScanType.barcode
      ? BarcodeScannerSheet(
          userId: widget.userId,
          date: widget.date,
          onFallbackToText: widget.onFallbackToText,
          onScanLabelInstead: () => _switchTo(ScanType.label),
        )
      : LabelScanBranch(
          userId: widget.userId,
          date: widget.date,
          onScanBarcodeInstead: () => _switchTo(ScanType.barcode),
        );

  bool _showsToggle(BarcodeFlowState barcode, LabelScanState label) =>
      _scanType == ScanType.barcode
      ? barcode.phase != BarcodeFlowPhase.product &&
            barcode.phase != BarcodeFlowPhase.saving
      : label.phase != LabelScanPhase.review &&
            label.phase != LabelScanPhase.saving;

  String _title(bool reviewing) => switch ((_scanType, reviewing)) {
    (ScanType.barcode, _) => 'logging.barcode.title'.tr(),
    (ScanType.label, true) => 'logging.labelScan.reviewTitle'.tr(),
    (ScanType.label, false) => 'logging.labelScan.title'.tr(),
  };
}

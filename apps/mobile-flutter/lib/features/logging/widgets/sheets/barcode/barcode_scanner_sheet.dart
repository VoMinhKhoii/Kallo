import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../data/barcode_providers.dart';
import '../scan_error_card.dart';
import 'barcode_camera_view.dart';
import 'barcode_manual_input.dart';
import 'barcode_product_step.dart';
import 'barcode_status_views.dart';

/// The barcode branch of the scan sheet: scan (or type) a product barcode,
/// pick an amount, and log it as a meal in one shot — no pending-confirmation
/// card.
///
/// The surrounding chrome (surface, header, saving lock) belongs to
/// `scan_sheet.dart`, which hosts this alongside the nutrition-label branch;
/// this widget is only the body. It pops the sheet with `true` once a meal is
/// saved.
///
/// [onFallbackToText] is invoked when the user picks "describe it instead" on
/// a product we couldn't find — the sheet pops itself first.
/// [onScanLabelInstead] switches the host to the label branch, which is the
/// better exit for a product Open Food Facts has never heard of.
class BarcodeScannerSheet extends ConsumerStatefulWidget {
  const BarcodeScannerSheet({
    super.key,
    required this.userId,
    required this.date,
    required this.onScanLabelInstead,
    this.onFallbackToText,
  });

  final String userId;
  final String date;
  final VoidCallback onScanLabelInstead;
  final VoidCallback? onFallbackToText;

  @override
  ConsumerState<BarcodeScannerSheet> createState() =>
      _BarcodeScannerSheetState();
}

class _BarcodeScannerSheetState extends ConsumerState<BarcodeScannerSheet> {
  final BarcodeCameraSession _camera = BarcodeCameraSession();
  final TextEditingController _manualController = TextEditingController();

  @override
  void dispose() {
    _manualController.dispose();
    _camera.release();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    final raw = _camera.claimDetection(capture);
    if (raw == null) return;
    HapticFeedback.mediumImpact();
    ref.read(barcodeFlowProvider.notifier).search(raw);
  }

  Future<void> _submitManual() async {
    final text = _manualController.text.trim();
    if (text.isEmpty) return;
    HapticFeedback.lightImpact();
    await ref.read(barcodeFlowProvider.notifier).search(text);
  }

  Future<void> _confirm(int grams) async {
    final saved = await ref
        .read(barcodeFlowProvider.notifier)
        .logMeal(userId: widget.userId, date: widget.date, grams: grams);
    if (saved && mounted) {
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Re-arm on entering the scanning phase, tear down on leaving it. This
    // listener fires synchronously with the state change — which can originate
    // inside the scanner's own detection callback — so disposal is deferred a
    // frame rather than run from within that stream's callstack.
    ref.listen(barcodeFlowProvider, (previous, next) {
      if (_showsCamera(next)) {
        _camera.arm();
      } else if (_camera.isRunning) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return; // dispose() already released it
          if (!_showsCamera(ref.read(barcodeFlowProvider))) _camera.release();
        });
      }
    });

    return _buildBody(ref.watch(barcodeFlowProvider));
  }

  /// The live viewport is on screen only while scanning and unblocked.
  static bool _showsCamera(BarcodeFlowState state) =>
      state.phase == BarcodeFlowPhase.scanning && state.errorKey == null;

  Widget _buildBody(BarcodeFlowState state) {
    if (state.errorKey != null &&
        state.phase != BarcodeFlowPhase.product &&
        state.phase != BarcodeFlowPhase.saving) {
      return ScanErrorCard(
        icon: LucideIcons.scanBarcode300,
        message: state.errorKey!.tr(),
        detail: state.lastBarcode,
        primary: ScanErrorAction(
          label: 'logging.barcode.scanAgain'.tr(),
          onTap: () => ref.read(barcodeFlowProvider.notifier).scanAgain(),
        ),
        secondary: [
          // A product Open Food Facts doesn't know still has its nutrition
          // table printed on the box — offer to read that instead.
          if (state.isNotFound)
            ScanErrorAction(
              icon: LucideIcons.scanText300,
              label: 'logging.scan.tryLabelInstead'.tr(),
              onTap: widget.onScanLabelInstead,
            ),
          if (state.isNotFound && widget.onFallbackToText != null)
            ScanErrorAction(
              icon: LucideIcons.pencilLine300,
              label: 'logging.barcode.logByText'.tr(),
              onTap: () {
                Navigator.of(context).pop(false);
                widget.onFallbackToText?.call();
              },
            ),
        ],
        quiet: ScanErrorAction(
          icon: LucideIcons.keyboard300,
          label: 'logging.barcode.manualEntry'.tr(),
          onTap: () => ref.read(barcodeFlowProvider.notifier).enterManualMode(),
        ),
      );
    }

    switch (state.phase) {
      case BarcodeFlowPhase.scanning:
        return BarcodeCameraView(
          controller: _camera.ensure(),
          onDetect: _onDetect,
          onEnterManually:
              () => ref.read(barcodeFlowProvider.notifier).enterManualMode(),
        );
      case BarcodeFlowPhase.manualEntry:
        return BarcodeManualInput(
          controller: _manualController,
          onSubmit: _submitManual,
          onBackToCamera:
              () => ref.read(barcodeFlowProvider.notifier).scanAgain(),
        );
      case BarcodeFlowPhase.searching:
        return const BarcodeSearchingView();
      case BarcodeFlowPhase.product:
      case BarcodeFlowPhase.saving:
        final product = state.product;
        if (product == null) return const SizedBox.shrink();
        return BarcodeProductStep(
          // Keyed per product so amount state re-initializes on each scan.
          key: ValueKey(product.barcode),
          product: product,
          saving: state.phase == BarcodeFlowPhase.saving,
          errorText: state.errorKey?.tr(),
          onBack: () => ref.read(barcodeFlowProvider.notifier).scanAgain(),
          onConfirm: _confirm,
        );
    }
  }
}

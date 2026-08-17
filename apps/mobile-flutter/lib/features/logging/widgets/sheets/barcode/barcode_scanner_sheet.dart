import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../data/barcode_providers.dart';
import 'barcode_camera_view.dart';
import 'barcode_manual_input.dart';
import 'barcode_product_step.dart';
import 'barcode_status_views.dart';

/// Open the barcode sheet: scan (or type) a product barcode, pick an amount,
/// and log it as a meal in one shot — no pending-confirmation card.
///
/// Resolves to `true` when a meal was logged (the caller toasts), `false`/null
/// otherwise. [onFallbackToText] is invoked when the user picks "describe it
/// instead" on a product we couldn't find — the sheet pops itself first.
Future<bool?> showBarcodeScannerSheet(
  BuildContext context, {
  required String userId,
  required String date,
  VoidCallback? onFallbackToText,
}) {
  return showNhamSheet<bool>(
    context,
    isScrollControlled: true,
    builder:
        (context) => BarcodeScannerSheet(
          userId: userId,
          date: date,
          onFallbackToText: onFallbackToText,
        ),
  );
}

class BarcodeScannerSheet extends ConsumerStatefulWidget {
  const BarcodeScannerSheet({
    super.key,
    required this.userId,
    required this.date,
    this.onFallbackToText,
  });

  final String userId;
  final String date;
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

    final state = ref.watch(barcodeFlowProvider);
    final saving = state.phase == BarcodeFlowPhase.saving;
    final maxHeight = MediaQuery.of(context).size.height * 0.9;
    final keyboardInset = MediaQuery.of(context).viewInsets.bottom;

    // While the log request is in flight the sheet must not be dismissable:
    // the POST would still complete server-side, silently logging a meal the
    // user never saw confirmed (and a re-scan would then duplicate it).
    // PopScope covers the scrim tap and system back (both go through
    // maybePop); IgnorePointer covers drag-to-dismiss, whose route-level
    // gesture detector defers its hit test to this child.
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
                  title: 'logging.barcode.title'.tr(),
                  subtitle: 'logging.barcode.subtitle'.tr(),
                  closeEnabled: !saving,
                ),
                Flexible(child: _buildBody(state)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// The live viewport is on screen only while scanning and unblocked.
  static bool _showsCamera(BarcodeFlowState state) =>
      state.phase == BarcodeFlowPhase.scanning && state.errorKey == null;

  Widget _buildBody(BarcodeFlowState state) {
    if (state.errorKey != null &&
        state.phase != BarcodeFlowPhase.product &&
        state.phase != BarcodeFlowPhase.saving) {
      return BarcodeErrorCard(
        message: state.errorKey!.tr(),
        barcode: state.lastBarcode,
        showDescribeFallback:
            state.isNotFound && widget.onFallbackToText != null,
        onScanAgain: () => ref.read(barcodeFlowProvider.notifier).scanAgain(),
        onEnterManually:
            () => ref.read(barcodeFlowProvider.notifier).enterManualMode(),
        onDescribeInstead: () {
          Navigator.of(context).pop(false);
          widget.onFallbackToText?.call();
        },
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

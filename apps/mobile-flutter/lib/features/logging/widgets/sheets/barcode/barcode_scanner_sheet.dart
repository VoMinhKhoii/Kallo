import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../data/barcode_providers.dart';
import 'frame/barcode_camera_session.dart';
import 'frame/barcode_camera_view.dart';
import 'frame/barcode_frame_status.dart';
import 'barcode_manual_input.dart';
import 'barcode_product_step.dart';

/// The barcode branch of the scan sheet: scan (or type) a product barcode,
/// pick an amount, and log it as a meal in one shot — no pending-confirmation
/// card.
///
/// The surrounding chrome (surface, header, saving lock) belongs to
/// `scan_sheet.dart`, which hosts this alongside the nutrition-label branch;
/// this widget is only the body. It pops the sheet with `true` once a meal is
/// saved.
///
/// A lookup that finds nothing does NOT replace this body: the camera keeps
/// the screen and the miss is reported inside the frame, so the sheet holds
/// its height and the scanner is still live to try the next package.
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

  /// Whether the lookup in flight (or the one that just failed) was TYPED.
  /// The controller lands both on the scanning phase, but a typed code has to
  /// come back to its keyboard: the user reaching for it has usually already
  /// told us the camera is no use to them.
  bool _manualLookup = false;

  void _onDetect(BarcodeCapture capture) {
    final raw = _camera.claimDetection(capture);
    if (raw == null) return;
    HapticFeedback.mediumImpact();
    _manualLookup = false;
    ref.read(barcodeFlowProvider.notifier).search(raw);
  }

  Future<void> _submitManual() async {
    final text = _manualController.text.trim();
    if (text.isEmpty) return;
    HapticFeedback.lightImpact();
    _manualLookup = true;
    // Forced: typing a code and pressing look up is a deliberate retry, so it
    // must get through even when that same code's miss is what is on screen.
    await ref.read(barcodeFlowProvider.notifier).search(text, force: true);
  }

  void _backToCamera() {
    _manualLookup = false;
    ref.read(barcodeFlowProvider.notifier).scanAgain();
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
    // Re-arm whenever we are back to accepting a scan, tear down once the
    // viewport leaves the screen. This listener fires synchronously with the
    // state change — which can originate inside the scanner's own detection
    // callback — so disposal is deferred a frame rather than run from within
    // that stream's callstack.
    ref.listen(barcodeFlowProvider, (previous, next) {
      if (next.phase == BarcodeFlowPhase.scanning) {
        // Including after a miss: the frame keeps scanning, which is what
        // makes the explicit "Scan again" button unnecessary.
        _camera.arm();
      }
      if (!_showsCamera(next) && _camera.isRunning) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return; // dispose() already released it
          if (!_showsCamera(ref.read(barcodeFlowProvider))) _camera.release();
        });
      }
    });

    return _buildBody(ref.watch(barcodeFlowProvider));
  }

  /// The live viewport holds the screen from the first frame through the
  /// lookup — the search runs over the picture, not in place of it. A typed
  /// lookup is the exception: it never leaves the keyboard, so the camera has
  /// no reason to be running behind it.
  bool _showsCamera(BarcodeFlowState state) =>
      !_manualLookup &&
      (state.phase == BarcodeFlowPhase.scanning ||
          state.phase == BarcodeFlowPhase.searching);

  /// The typing surface, whether the user is still on it or is waiting on the
  /// code they typed.
  Widget _manualInput(BarcodeFlowState state) => BarcodeManualInput(
    controller: _manualController,
    onSubmit: _submitManual,
    errorText: state.errorKey?.tr(),
    searching: state.phase == BarcodeFlowPhase.searching,
    onBackToCamera: _backToCamera,
  );

  Widget _buildBody(BarcodeFlowState state) {
    switch (state.phase) {
      case BarcodeFlowPhase.scanning:
      case BarcodeFlowPhase.searching:
        if (_manualLookup) return _manualInput(state);
        return BarcodeCameraView(
          controller: _camera.ensure(),
          onDetect: _onDetect,
          onEnterManually:
              () => ref.read(barcodeFlowProvider.notifier).enterManualMode(),
          notice: barcodeFrameNoticeFor(
            state,
            onScanLabelInstead: widget.onScanLabelInstead,
            onLogByText:
                widget.onFallbackToText == null
                    ? null
                    : () {
                      Navigator.of(context).pop(false);
                      widget.onFallbackToText?.call();
                    },
          ),
        );
      case BarcodeFlowPhase.manualEntry:
        return _manualInput(state);
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
          onBack: _backToCamera,
          onConfirm: _confirm,
        );
    }
  }
}

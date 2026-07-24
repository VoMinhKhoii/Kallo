import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/barcode_providers.dart';
import 'barcode_product_step.dart';

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
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
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
  /// Restrict decoding to retail formats: faster, and QR codes printed next to
  /// the nutrition panel never hijack a scan.
  static final _formats = [
    BarcodeFormat.ean13,
    BarcodeFormat.ean8,
    BarcodeFormat.upcA,
    BarcodeFormat.upcE,
    BarcodeFormat.code128,
  ];

  MobileScannerController? _controller;

  /// Single-flight guard: mobile_scanner keeps emitting detections for frames
  /// already in the pipeline after the first hit; only the first may search.
  bool _handledDetection = false;

  final TextEditingController _manualController = TextEditingController();

  @override
  void dispose() {
    _manualController.dispose();
    _controller?.dispose();
    super.dispose();
  }

  /// The controller is created lazily when the scanning phase mounts and torn
  /// down when it leaves, so the camera never runs behind the quantity step.
  MobileScannerController _ensureController() {
    return _controller ??= MobileScannerController(
      formats: _formats,
      detectionSpeed: DetectionSpeed.noDuplicates,
    );
  }

  void _releaseController() {
    _controller?.dispose();
    _controller = null;
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handledDetection) return;
    final raw = capture.barcodes
        .map((barcode) => barcode.rawValue ?? '')
        .firstWhere((value) => value.isNotEmpty, orElse: () => '');
    if (raw.isEmpty) return;

    _handledDetection = true;
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
    // Tear the camera down whenever the flow leaves the live-scanning phase
    // (it must not keep running behind the quantity step), and re-arm the
    // decode guard whenever scanning resumes. The listener fires synchronously
    // with the state change — which can originate inside the scanner's own
    // detection callback — so disposal is deferred a frame rather than tearing
    // the controller down from within its own stream's callstack.
    ref.listen(barcodeFlowProvider, (previous, next) {
      final showsCamera =
          next.phase == BarcodeFlowPhase.scanning && next.errorKey == null;
      if (showsCamera) {
        _handledDetection = false;
      } else if (_controller != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return; // dispose() already released it
          final current = ref.read(barcodeFlowProvider);
          final backToScanning =
              current.phase == BarcodeFlowPhase.scanning &&
              current.errorKey == null;
          if (!backToScanning) _releaseController();
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
          child: Container(
            constraints: BoxConstraints(maxHeight: maxHeight),
            decoration: const BoxDecoration(
              color: NhamColors.surface,
              borderRadius: BorderRadius.vertical(
                top: Radius.circular(NhamRadii.xxl),
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: NhamSpacing.sp2),
                // Drag handle.
                Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: NhamColors.borderSoft,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                // Header: title/subtitle left, X right.
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    NhamSpacing.sp4,
                    NhamSpacing.sp3,
                    NhamSpacing.sp2,
                    NhamSpacing.sp2,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            NhamText(
                              'logging.barcode.title'.tr(),
                              variant: NhamTextVariant.h3,
                            ),
                            const SizedBox(height: 2),
                            NhamText(
                              'logging.barcode.subtitle'.tr(),
                              variant: NhamTextVariant.small,
                              style: const TextStyle(
                                color: NhamColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed:
                            saving ? null : () => Navigator.of(context).pop(),
                        icon: const Icon(LucideIcons.x, size: 20),
                        color: NhamColors.textMuted,
                        tooltip: 'common.cancel'.tr(),
                      ),
                    ],
                  ),
                ),

                Flexible(child: _buildBody(state)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBody(BarcodeFlowState state) {
    if (state.errorKey != null &&
        state.phase != BarcodeFlowPhase.product &&
        state.phase != BarcodeFlowPhase.saving) {
      return _ErrorCard(
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
        return _ScannerView(
          controller: _ensureController(),
          onDetect: _onDetect,
          onEnterManually:
              () => ref.read(barcodeFlowProvider.notifier).enterManualMode(),
        );
      case BarcodeFlowPhase.manualEntry:
        return _ManualEntryView(
          controller: _manualController,
          onSubmit: _submitManual,
          onBackToCamera:
              () => ref.read(barcodeFlowProvider.notifier).scanAgain(),
        );
      case BarcodeFlowPhase.searching:
        return const _SearchingView();
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

/// Live camera viewport with a scan-frame overlay, torch toggle, and a manual
/// entry escape hatch. The camera-error and permission-denied states render
/// via [MobileScanner.errorBuilder] — that is also the path the iOS simulator
/// takes (it has no camera).
class _ScannerView extends StatelessWidget {
  const _ScannerView({
    required this.controller,
    required this.onDetect,
    required this.onEnterManually,
  });

  final MobileScannerController controller;
  final ValueChanged<BarcodeCapture> onDetect;
  final VoidCallback onEnterManually;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        NhamSpacing.sp4,
        NhamSpacing.sp2,
        NhamSpacing.sp4,
        bottomInset + NhamSpacing.sp3,
      ),
      child: Column(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(NhamRadii.containerLg),
            child: AspectRatio(
              aspectRatio: 3 / 4,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final size = constraints.biggest;
                  // Decode only inside the visual frame — fewer false hits
                  // from neighboring packages on a shelf.
                  final frameWidth = size.width * 0.78;
                  final frameHeight = frameWidth * 0.6;
                  final scanWindow = Rect.fromCenter(
                    center: size.center(Offset.zero),
                    width: frameWidth,
                    height: frameHeight,
                  );
                  return Stack(
                    fit: StackFit.expand,
                    children: [
                      MobileScanner(
                        controller: controller,
                        fit: BoxFit.cover,
                        scanWindow: scanWindow,
                        onDetect: onDetect,
                        errorBuilder:
                            (context, error) => _CameraErrorState(
                              error: error,
                              onEnterManually: onEnterManually,
                            ),
                      ),
                      IgnorePointer(
                        child: CustomPaint(
                          painter: _ScanFramePainter(scanWindow: scanWindow),
                        ),
                      ),
                      // Torch toggle, bottom-right of the viewport.
                      Positioned(
                        right: NhamSpacing.sp3,
                        bottom: NhamSpacing.sp3,
                        child: _TorchButton(controller: controller),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: NhamSpacing.sp3),
          NhamText(
            'logging.barcode.scanning'.tr(),
            variant: NhamTextVariant.small,
            style: const TextStyle(color: NhamColors.textMuted),
          ),
          const SizedBox(height: NhamSpacing.sp2),
          _QuietButton(
            icon: LucideIcons.keyboard,
            label: 'logging.barcode.manualEntry'.tr(),
            onTap: onEnterManually,
          ),
        ],
      ),
    );
  }
}

/// Dimmed surround + tan corner brackets around the scan window.
class _ScanFramePainter extends CustomPainter {
  const _ScanFramePainter({required this.scanWindow});

  final Rect scanWindow;

  @override
  void paint(Canvas canvas, Size size) {
    // Dim everything outside the window.
    final dim =
        Paint()..color = const Color(0xFF141413).withValues(alpha: 0.35);
    final frame = RRect.fromRectAndRadius(
      scanWindow,
      const Radius.circular(12),
    );
    canvas.drawPath(
      Path.combine(
        PathOperation.difference,
        Path()..addRect(Offset.zero & size),
        Path()..addRRect(frame),
      ),
      dim,
    );

    // Corner brackets in the signature tan.
    final bracket =
        Paint()
          ..color = NhamColors.accent
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3
          ..strokeCap = StrokeCap.round;
    const len = 22.0;
    const r = 12.0;
    final w = scanWindow;

    // Simple L-brackets: two straight strokes + a rounded elbow per corner,
    // hugging the rounded frame.
    void lBracket(Offset cornerPoint, double dxSign, double dySign) {
      canvas.drawLine(
        cornerPoint + Offset(dxSign * r, 0),
        cornerPoint + Offset(dxSign * len, 0),
        bracket,
      );
      canvas.drawLine(
        cornerPoint + Offset(0, dySign * r),
        cornerPoint + Offset(0, dySign * len),
        bracket,
      );
      // The rounded elbow.
      canvas.drawArc(
        Rect.fromCircle(
          center: cornerPoint + Offset(dxSign * r, dySign * r),
          radius: r,
        ),
        _arcStart(dxSign, dySign),
        1.5707963, // 90°
        false,
        bracket,
      );
    }

    lBracket(w.topLeft, 1, 1);
    lBracket(w.topRight, -1, 1);
    lBracket(w.bottomLeft, 1, -1);
    lBracket(w.bottomRight, -1, -1);
  }

  double _arcStart(double dxSign, double dySign) {
    if (dxSign > 0 && dySign > 0) return 3.1415926; // top-left: 180°
    if (dxSign < 0 && dySign > 0) return -1.5707963; // top-right: 270°
    if (dxSign > 0 && dySign < 0) return 1.5707963; // bottom-left: 90°
    return 0; // bottom-right: 0°
  }

  @override
  bool shouldRepaint(_ScanFramePainter oldDelegate) =>
      oldDelegate.scanWindow != scanWindow;
}

/// Torch toggle — filled tan while on; hidden when the device has no torch.
class _TorchButton extends StatelessWidget {
  const _TorchButton({required this.controller});

  final MobileScannerController controller;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<MobileScannerState>(
      valueListenable: controller,
      builder: (context, state, _) {
        if (state.torchState == TorchState.unavailable) {
          return const SizedBox.shrink();
        }
        final on = state.torchState == TorchState.on;
        return Semantics(
          button: true,
          toggled: on,
          label: 'logging.barcode.torch'.tr(),
          child: GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              controller.toggleTorch();
            },
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color:
                    on
                        ? NhamColors.accent
                        : Colors.black.withValues(alpha: 0.35),
                shape: BoxShape.circle,
              ),
              child: Icon(
                on ? LucideIcons.flashlight : LucideIcons.flashlightOff,
                size: 18,
                color: Colors.white,
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Camera failure inside the viewport: permission denied gets settings
/// guidance; anything else (including the simulator's missing camera) gets a
/// generic error. Both offer manual entry.
class _CameraErrorState extends StatelessWidget {
  const _CameraErrorState({required this.error, required this.onEnterManually});

  final MobileScannerException error;
  final VoidCallback onEnterManually;

  @override
  Widget build(BuildContext context) {
    final denied = error.errorCode == MobileScannerErrorCode.permissionDenied;
    return Container(
      color: NhamColors.elev,
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            denied ? LucideIcons.cameraOff : LucideIcons.camera,
            size: 28,
            color: NhamColors.danger,
          ),
          const SizedBox(height: NhamSpacing.sp2),
          NhamText(
            (denied
                    ? 'logging.barcode.cameraDenied'
                    : 'logging.barcode.cameraError')
                .tr(),
            variant: NhamTextVariant.small,
            textAlign: TextAlign.center,
            style: const TextStyle(color: NhamColors.textMuted),
          ),
          const SizedBox(height: NhamSpacing.sp3),
          _QuietButton(
            icon: LucideIcons.keyboard,
            label: 'logging.barcode.manualEntry'.tr(),
            onTap: onEnterManually,
          ),
        ],
      ),
    );
  }
}

class _ManualEntryView extends StatelessWidget {
  const _ManualEntryView({
    required this.controller,
    required this.onSubmit,
    required this.onBackToCamera,
  });

  final TextEditingController controller;
  final VoidCallback onSubmit;
  final VoidCallback onBackToCamera;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        NhamSpacing.sp4,
        NhamSpacing.sp2,
        NhamSpacing.sp4,
        bottomInset + NhamSpacing.sp3,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: controller,
            autofocus: true,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onSubmitted: (_) => onSubmit(),
            style: NhamTextStyles.sansRegular(
              fontSize: NhamFontSize.sm,
            ).copyWith(color: NhamColors.text),
            cursorColor: NhamColors.accent,
            decoration: InputDecoration(
              isDense: true,
              prefixIcon: const Icon(
                LucideIcons.scanBarcode,
                size: 18,
                color: NhamColors.textMuted,
              ),
              hintText: 'logging.barcode.placeholder'.tr(),
              hintStyle: NhamTextStyles.sansRegular(
                fontSize: NhamFontSize.sm,
              ).copyWith(color: NhamColors.placeholderMuted40),
              filled: true,
              fillColor: NhamColors.elev,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: NhamSpacing.sp3,
                vertical: NhamSpacing.sp2,
              ),
              border: _border(NhamColors.inputBorder),
              enabledBorder: _border(NhamColors.inputBorder),
              focusedBorder: _border(NhamColors.borderAccent40),
            ),
          ),
          const SizedBox(height: NhamSpacing.sp3),
          _PrimaryButton(label: 'logging.barcode.search'.tr(), onTap: onSubmit),
          const SizedBox(height: NhamSpacing.sp2),
          Center(
            child: _QuietButton(
              icon: LucideIcons.camera,
              label: 'logging.barcode.backToCamera'.tr(),
              onTap: onBackToCamera,
            ),
          ),
        ],
      ),
    );
  }

  OutlineInputBorder _border(Color color) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(NhamRadii.lg),
    borderSide: BorderSide(color: color),
  );
}

class _SearchingView extends StatelessWidget {
  const _SearchingView();

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        NhamSpacing.sp4,
        NhamSpacing.sp6,
        NhamSpacing.sp4,
        bottomInset + NhamSpacing.sp6,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: NhamColors.accent,
            ),
          ),
          const SizedBox(height: NhamSpacing.sp3),
          NhamText(
            'logging.barcode.searching'.tr(),
            variant: NhamTextVariant.small,
            style: const TextStyle(color: NhamColors.textMuted),
          ),
        ],
      ),
    );
  }
}

/// Warm terracotta error card with recovery actions — never a bare red toast.
class _ErrorCard extends StatelessWidget {
  const _ErrorCard({
    required this.message,
    required this.barcode,
    required this.showDescribeFallback,
    required this.onScanAgain,
    required this.onEnterManually,
    required this.onDescribeInstead,
  });

  final String message;
  final String? barcode;
  final bool showDescribeFallback;
  final VoidCallback onScanAgain;
  final VoidCallback onEnterManually;
  final VoidCallback onDescribeInstead;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        NhamSpacing.sp4,
        NhamSpacing.sp2,
        NhamSpacing.sp4,
        bottomInset + NhamSpacing.sp3,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(NhamSpacing.sp3),
            decoration: BoxDecoration(
              color: NhamColors.danger.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(NhamRadii.containerLg),
              border: Border.all(
                color: NhamColors.danger.withValues(alpha: 0.35),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      LucideIcons.scanBarcode,
                      size: 18,
                      color: NhamColors.danger,
                    ),
                    const SizedBox(width: NhamSpacing.sp2),
                    Expanded(
                      child: NhamText(
                        message,
                        variant: NhamTextVariant.body,
                        style: const TextStyle(color: NhamColors.text),
                      ),
                    ),
                  ],
                ),
                if (barcode != null && barcode!.isNotEmpty) ...[
                  const SizedBox(height: NhamSpacing.sp1),
                  NhamText(
                    barcode!,
                    variant: NhamTextVariant.numCaption,
                    style: const TextStyle(color: NhamColors.textMuted),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: NhamSpacing.sp3),
          _PrimaryButton(
            label: 'logging.barcode.scanAgain'.tr(),
            onTap: onScanAgain,
          ),
          const SizedBox(height: NhamSpacing.sp2),
          if (showDescribeFallback) ...[
            _OutlineButton(
              icon: LucideIcons.pencilLine,
              label: 'logging.barcode.logByText'.tr(),
              onTap: onDescribeInstead,
            ),
            const SizedBox(height: NhamSpacing.sp2),
          ],
          Center(
            child: _QuietButton(
              icon: LucideIcons.keyboard,
              label: 'logging.barcode.manualEntry'.tr(),
              onTap: onEnterManually,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Small shared buttons (sheet-local).
// ---------------------------------------------------------------------------

class _PrimaryButton extends StatefulWidget {
  const _PrimaryButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  State<_PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<_PrimaryButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.label,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: () {
          HapticFeedback.lightImpact();
          widget.onTap();
        },
        child: AnimatedScale(
          scale: _pressed ? 0.97 : 1,
          duration: const Duration(milliseconds: 150),
          child: Container(
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp3),
            decoration: BoxDecoration(
              color: _pressed ? NhamColors.btnHover : NhamColors.btn,
              borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
            ),
            child: Text(
              widget.label,
              style: NhamTextStyles.sansSemiBold(
                fontSize: NhamFontSize.sm,
              ).copyWith(color: Colors.white),
            ),
          ),
        ),
      ),
    );
  }
}

class _OutlineButton extends StatelessWidget {
  const _OutlineButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: Container(
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp3),
          decoration: BoxDecoration(
            color: NhamColors.elev,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
            border: Border.all(color: NhamColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: NhamColors.text),
              const SizedBox(width: 6),
              Text(
                label,
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.sm,
                ).copyWith(color: NhamColors.text),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuietButton extends StatelessWidget {
  const _QuietButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: SizedBox(
          height: 44,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: NhamColors.textMuted),
              const SizedBox(width: 6),
              Text(
                label,
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.sm,
                ).copyWith(color: NhamColors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

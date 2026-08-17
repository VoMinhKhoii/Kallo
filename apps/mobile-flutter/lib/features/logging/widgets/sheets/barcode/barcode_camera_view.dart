import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../../shared/widgets/form/sheet_action_buttons.dart';
import '../../../../../shared/widgets/typography/kallo_text.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import 'barcode_scan_frame_painter.dart';
import 'barcode_status_views.dart';

/// Owns the scanner's controller so the camera runs during the scanning phase
/// and nowhere else — it must not keep streaming behind the quantity step.
class BarcodeCameraSession {
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

  /// True between [ensure] and [release].
  bool get isRunning => _controller != null;

  /// Built lazily, when the scanning phase mounts.
  MobileScannerController ensure() =>
      _controller ??= MobileScannerController(
        formats: _formats,
        detectionSpeed: DetectionSpeed.noDuplicates,
      );

  /// Re-arm the decode guard — scanning has (re)started.
  void arm() => _handledDetection = false;

  void release() {
    _controller?.dispose();
    _controller = null;
  }

  /// The first unclaimed payload of [capture], or null when there is none.
  String? claimDetection(BarcodeCapture capture) {
    if (_handledDetection) return null;
    final raw = capture.barcodes
        .map((barcode) => barcode.rawValue ?? '')
        .firstWhere((value) => value.isNotEmpty, orElse: () => '');
    if (raw.isEmpty) return null;
    _handledDetection = true;
    return raw;
  }
}

/// Live camera viewport with a scan-frame overlay, torch toggle, and a manual
/// entry escape hatch. Camera and permission failures render via
/// [MobileScanner.errorBuilder] — the path the iOS simulator takes too.
class BarcodeCameraView extends StatelessWidget {
  const BarcodeCameraView({
    super.key,
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
        KalloSpacing.sp4,
        KalloSpacing.sp2,
        KalloSpacing.sp4,
        bottomInset + KalloSpacing.sp3,
      ),
      child: Column(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(KalloRadii.containerLg),
            child: AspectRatio(
              aspectRatio: 3 / 4,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final size = constraints.biggest;
                  // Use one rectangle for both decoding and the visible target
                  // so neighboring shelf packages cannot win the scan.
                  final frameWidth = size.width * 0.88;
                  final frameHeight = frameWidth * 0.65;
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
                            (context, error) => BarcodeCameraErrorState(
                              error: error,
                              onEnterManually: onEnterManually,
                            ),
                      ),
                      IgnorePointer(
                        child: CustomPaint(
                          painter: ScanFramePainter(scanWindow: scanWindow),
                        ),
                      ),
                      // Torch toggle, bottom-right of the viewport.
                      Positioned(
                        right: KalloSpacing.sp3,
                        bottom: KalloSpacing.sp3,
                        child: _TorchButton(controller: controller),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: KalloSpacing.sp3),
          KalloText(
            'logging.barcode.scanning'.tr(),
            variant: KalloTextVariant.small,
            style: const TextStyle(color: KalloColors.textMuted),
          ),
          const SizedBox(height: KalloSpacing.sp2),
          QuietIconButton(
            icon: LucideIcons.keyboard300,
            label: 'logging.barcode.manualEntry'.tr(),
            onTap: onEnterManually,
          ),
        ],
      ),
    );
  }
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
                        ? KalloColors.accent
                        : Colors.black.withValues(alpha: 0.35),
                shape: BoxShape.circle,
              ),
              child: Icon(
                on ? LucideIcons.flashlight300 : LucideIcons.flashlightOff300,
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

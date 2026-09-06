import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../../../shared/widgets/form/sheet_action_buttons.dart';
import '../../../../../../theme/kallo_theme.dart';
import '../../scan/scan_camera_stage.dart';
import 'barcode_frame_notice.dart';
import 'barcode_scan_error_view.dart';
import 'barcode_scan_frame_painter.dart';
import 'barcode_torch_button.dart';

/// Live camera viewport on the shared dark [ScanCameraStage], with the torch
/// in the stage's bottom-left control slot and a quiet manual-entry escape
/// hatch below.
///
/// There is no shutter here: a barcode decodes continuously, so a capture
/// button would be an inert control on a live target.
///
/// The lookup's status ([notice]) rides INSIDE the frame, so this view is what
/// the user sees from the first frame through a miss and into the next scan —
/// the sheet's height never moves.
///
/// A camera that cannot run is the one exception: it swaps the whole stage for
/// [BarcodeScanErrorView], the same card the label branch shows.
class BarcodeCameraView extends StatefulWidget {
  const BarcodeCameraView({
    super.key,
    required this.controller,
    required this.onDetect,
    required this.onEnterManually,
    this.notice,
  });

  final MobileScannerController controller;
  final ValueChanged<BarcodeCapture> onDetect;
  final VoidCallback onEnterManually;

  /// The searching/miss capsule, when there is one. It takes the frame hint's
  /// place — the hint has nothing to add once the frame is talking back.
  final BarcodeFrameNotice? notice;

  @override
  State<BarcodeCameraView> createState() => _BarcodeCameraViewState();
}

class _BarcodeCameraViewState extends State<BarcodeCameraView> {
  MobileScannerException? _error;

  @override
  void initState() {
    super.initState();
    _error = widget.controller.value.error;
    widget.controller.addListener(_onScannerChanged);
  }

  @override
  void didUpdateWidget(covariant BarcodeCameraView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_onScannerChanged);
      widget.controller.addListener(_onScannerChanged);
      _error = widget.controller.value.error;
    }
  }

  @override
  void dispose() {
    // Allowed on a disposed notifier — the sheet releases the controller
    // independently of this widget's own teardown.
    widget.controller.removeListener(_onScannerChanged);
    super.dispose();
  }

  /// The scanner publishes its start failure from inside `MobileScanner`'s own
  /// `initState` — that is, while this subtree is being built — so a straight
  /// `setState` here would be a markNeedsBuild during build. Swapping the body
  /// for the error card is deferred to the end of the frame instead.
  void _onScannerChanged() {
    if (widget.controller.value.error == _error) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final error = widget.controller.value.error;
      if (error == _error) return;
      setState(() => _error = error);
    });
  }

  @override
  Widget build(BuildContext context) {
    final error = _error;
    if (error != null) {
      return BarcodeScanErrorView(
        error: error,
        onEnterManually: widget.onEnterManually,
      );
    }
    return _viewport(context);
  }

  Widget _viewport(BuildContext context) {
    final bottomInset = MediaQuery.viewPaddingOf(context).bottom;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        KalloSpacing.sp4,
        KalloSpacing.sp2,
        KalloSpacing.sp4,
        bottomInset + KalloSpacing.sp2,
      ),
      child: Column(
        children: [
          ScanCameraStage(
            // The hint has nothing to add once the frame is talking back.
            hint: widget.notice == null ? 'logging.barcode.frameHint'.tr() : null,
            notice: widget.notice,
            leading: BarcodeTorchButton(controller: widget.controller),
            builder: (context, size) {
              // Use one rectangle for both decoding and the visible target so
              // neighboring shelf packages cannot win the scan.
              final frameWidth = size.width * 0.88;
              final scanWindow = Rect.fromCenter(
                center: size.center(Offset.zero),
                width: frameWidth,
                height: frameWidth * 0.65,
              );
              return Stack(
                fit: StackFit.expand,
                children: [
                  MobileScanner(
                    controller: widget.controller,
                    fit: BoxFit.cover,
                    scanWindow: scanWindow,
                    onDetect: widget.onDetect,
                    // The error owns the whole body, one level up — leaving a
                    // panel here too would paint it a second time, under the
                    // reticle, inside a stage that is already being replaced.
                    errorBuilder: (context, error) => const SizedBox.shrink(),
                  ),
                  IgnorePointer(
                    child: CustomPaint(
                      painter: ScanFramePainter(scanWindow: scanWindow),
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: KalloSpacing.sp1),
          QuietIconButton(
            icon: LucideIcons.keyboard300,
            label: 'logging.barcode.manualEntry'.tr(),
            onTap: widget.onEnterManually,
          ),
        ],
      ),
    );
  }
}

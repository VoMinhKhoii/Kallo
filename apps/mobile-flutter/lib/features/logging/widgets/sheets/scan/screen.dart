import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../models/logging/scan_outcome.dart';
import '../../../../../services/billing/feature_lock.dart';
import '../../../../privacy/logic/ai_consent_gate.dart';
import '../../../data/barcode_providers.dart';
import '../../../data/label_scan_providers.dart';
import '../../../logic/relog/scan_purpose.dart';
import 'camera/layer/barcode.dart';
import 'camera/layer/label.dart';
import 'camera/controls.dart';
import 'camera/loading_overlay.dart';
import 'camera/mode_chip.dart';
import 'camera/switch_veil.dart';
import 'panel/sheet.dart';
import 'result_actions.dart';
import 'screen_actions.dart';
import 'panels.dart';

/// Open the scanner: read a packaged product by its barcode or by the
/// nutrition table printed on it, adjust the amount, and log it in one shot.
///
/// Full screen — the whole camera, so the user sees what they are pointing at
/// and its surroundings (owner review). Results rise as a sheet INSIDE this
/// screen over the frozen frame (`ScanSheet` explains why not a sheet route).
/// A `MaterialPageRoute` in fullscreen-dialog form: the platform's modal
/// slide-up, through the theme like every route in the app.
///
/// Resolves to [ScanSaved] when a meal was written, [ScanPicked] when
/// [purpose] asked for the product back, or null on close.
Future<ScanOutcome?> showScanScreen(
  BuildContext context, {
  required String userId,
  required String date,
  required ScanPurpose purpose,
}) => Navigator.of(context, rootNavigator: true).push<ScanOutcome>(
  MaterialPageRoute(
    fullscreenDialog: true,
    builder: (_) => ScanScreen(userId: userId, date: date, purpose: purpose),
  ),
);

class ScanScreen extends ConsumerStatefulWidget {
  const ScanScreen({
    super.key,
    required this.userId,
    required this.date,
    required this.purpose,
  });

  final String userId;
  final String date;
  final ScanPurpose purpose;

  @override
  ConsumerState<ScanScreen> createState() => ScanScreenState();
}

class ScanScreenState extends ConsumerState<ScanScreen>
    with WidgetsBindingObserver, ScanResultActions, ScanScreenActions {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    barcodeCamera.ensure();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) =>
      labelCamera.handleLifecycle(state);

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    barcodeCamera.release();
    labelCamera.dispose();
    super.dispose();
  }

  /// The label controller reports a 402 and a withdrawn AI consent as error
  /// keys; the first place with a context turns them into the paywall and the
  /// consent prompt (then re-sends the held photo if the answer is yes).
  void _listenForGates() {
    ref.listen<LabelScanState>(labelScanProvider, (prev, next) {
      if (next.isFeatureLocked && !(prev?.isFeatureLocked ?? false)) {
        openPaywall(context);
      }
      if (next.isAiConsentRequired && !(prev?.isAiConsentRequired ?? false)) {
        reaskAiConsent(context, ref).then((ok) {
          if (!mounted) return;
          ok ? scanLabel() : labelNotifier.retake();
        });
      }
    });
  }

  // ---------------------------------------------------------------- build

  @override
  Widget build(BuildContext context) {
    _listenForGates();
    final barcode = ref.watch(barcodeFlowProvider);
    final label = ref.watch(labelScanProvider);
    final panel = buildScanPanel(this, barcode, label);
    final busy =
        (mode == ScanType.barcode &&
            barcode.phase == BarcodeFlowPhase.searching) ||
        (mode == ScanType.label && label.phase == LabelScanPhase.scanning);
    final live = panel == null && !busy;
    return PopScope(
      canPop: !saving,
      child: Scaffold(
        backgroundColor: Colors.black,
        resizeToAvoidBottomInset: false,
        body: Stack(
          fit: StackFit.expand,
          children: [
            if (cameraMode == ScanType.barcode)
              BarcodeCameraLayer(
                controller:
                    barcodeCamera.isRunning ? barcodeCamera.ensure() : null,
                frozen: frozen,
                onDetect: onDetect,
              )
            else
              LabelCameraLayer(
                controller: labelCamera.controller,
                photoPath: label.image?.path,
                problem: label.cameraProblemKey?.tr(),
              ),
            ScanCameraVeil(shown: veiled, onCovered: swapCamera),
            if (busy)
              ScanLoadingOverlay(
                mode: mode,
                text:
                    (mode == ScanType.barcode
                            ? 'logging.scan.lookingUp'
                            : 'logging.scan.reading')
                        .tr(),
              ),
            if (live)
              ScanCameraControls(
                mode: mode,
                onMode: switchMode,
                onClose: () => Navigator.of(context).maybePop(),
                onLight: toggleTorch,
                lightOn: torch,
                onTypeBarcode: startTyping,
                onLibrary: pickFromLibrary,
                onShutter: shoot,
                onEnterManually: gated(enterManually),
              ),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 280),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              transitionBuilder:
                  (child, animation) => SlideTransition(
                    position: Tween(
                      begin: const Offset(0, 1),
                      end: Offset.zero,
                    ).animate(animation),
                    child: child,
                  ),
              // One sheet for every page: a change of page travels inside it
              // (`ScanPageStack`); only no sheet ↔ a sheet slides it up/down.
              child:
                  panel == null
                      ? const SizedBox.shrink(key: ValueKey('none'))
                      : ScanSheet(key: const ValueKey('sheet'), page: panel),
            ),
          ],
        ),
      ),
    );
  }
}

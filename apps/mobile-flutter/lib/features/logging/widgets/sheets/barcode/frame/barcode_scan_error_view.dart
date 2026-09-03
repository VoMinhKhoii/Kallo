import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../scan/scan_error_card.dart';

/// What the barcode branch shows when the camera itself cannot run: permission
/// denied, no camera on the device (the iOS simulator's path), or any other
/// start failure the plugin reports.
///
/// It is the SAME shape the label branch uses for its failures — [ScanErrorCard]
/// — and it REPLACES the stage rather than painting inside it. The previous
/// panel rendered through `MobileScanner.errorBuilder`, so it sat centred in
/// the 3:4 frame with the reticle and the hint band still drawn over the top of
/// it: two competing layouts on the one screen where the user is already stuck.
///
/// The error takes the manual-entry action with it. The quiet link below the
/// frame belongs to the live viewport, and the card's primary is the same
/// escape hatch — offering both would print it twice.
class BarcodeScanErrorView extends StatelessWidget {
  const BarcodeScanErrorView({
    super.key,
    required this.error,
    required this.onEnterManually,
  });

  final MobileScannerException error;

  /// Switch to typing the barcode — the only way forward without a camera.
  final VoidCallback onEnterManually;

  @override
  Widget build(BuildContext context) {
    final denied = error.errorCode == MobileScannerErrorCode.permissionDenied;
    return ScanErrorCard(
      icon: denied ? LucideIcons.cameraOff300 : LucideIcons.camera300,
      message:
          (denied
                  ? 'logging.barcode.cameraDenied'
                  : 'logging.barcode.cameraError')
              .tr(),
      primary: ScanErrorAction(
        label: 'logging.barcode.manualEntry'.tr(),
        onTap: onEnterManually,
      ),
    );
  }
}

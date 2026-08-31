/// The two non-camera faces of the barcode flow: the lookup spinner, and the
/// panel the camera itself falls back to. A failed lookup renders through the
/// shared `ScanErrorCard`, which both scan branches use.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../../shared/widgets/form/sheet_action_buttons.dart';
import '../../../../../shared/widgets/typography/kallo_text.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';

/// The lookup is in flight — a spinner and one line, nothing to act on yet.
class BarcodeSearchingView extends StatelessWidget {
  const BarcodeSearchingView({super.key});

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        KalloSpacing.sp4,
        KalloSpacing.sp6,
        KalloSpacing.sp4,
        bottomInset + KalloSpacing.sp6,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: KalloColors.accent,
            ),
          ),
          const SizedBox(height: KalloSpacing.sp3),
          KalloText(
            'logging.barcode.searching'.tr(),
            variant: KalloTextVariant.small,
            style: const TextStyle(color: KalloColors.textMuted),
          ),
        ],
      ),
    );
  }
}

/// Camera failure inside the viewport: permission denied gets settings
/// guidance; anything else (including the simulator's missing camera) gets a
/// generic error. Both offer manual entry.
class BarcodeCameraErrorState extends StatelessWidget {
  const BarcodeCameraErrorState({
    super.key,
    required this.error,
    required this.onEnterManually,
  });

  final MobileScannerException error;
  final VoidCallback onEnterManually;

  @override
  Widget build(BuildContext context) {
    final denied = error.errorCode == MobileScannerErrorCode.permissionDenied;
    return Container(
      color: KalloColors.elev,
      padding: const EdgeInsets.all(KalloSpacing.sp4),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // The one error shape: icon badge, then the reason, then ONE action.
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: KalloColors.danger10,
              shape: BoxShape.circle,
            ),
            child: Icon(
              denied ? LucideIcons.cameraOff300 : LucideIcons.camera300,
              size: KalloIcons.size,
              color: KalloColors.danger,
            ),
          ),
          const SizedBox(height: KalloSpacing.sp3),
          Text(
            (denied
                    ? 'logging.barcode.cameraDenied'
                    : 'logging.barcode.cameraError')
                .tr(),
            textAlign: TextAlign.center,
            style: dashMeta(),
          ),
          const SizedBox(height: KalloSpacing.sp3),
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

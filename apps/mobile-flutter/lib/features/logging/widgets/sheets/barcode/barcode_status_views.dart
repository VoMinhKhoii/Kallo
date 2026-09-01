/// The panel the camera itself falls back to when it cannot run.
///
/// The lookup's own status lives on the frame — see
/// `frame/barcode_frame_notice.dart`. What is left here is the one state that
/// genuinely has no picture to draw on.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';

/// Camera failure inside the viewport: permission denied gets settings
/// guidance; anything else (including the simulator's missing camera) gets a
/// generic error.
///
/// It states the reason and nothing else. The manual-entry escape hatch is the
/// quiet action BELOW the frame ([BarcodeCameraView]), which stays put through
/// every camera state — offering it in here as well printed "Enter barcode
/// manually" twice on the one screen where it matters most.
class BarcodeCameraErrorState extends StatelessWidget {
  const BarcodeCameraErrorState({super.key, required this.error});

  final MobileScannerException error;

  @override
  Widget build(BuildContext context) {
    final denied = error.errorCode == MobileScannerErrorCode.permissionDenied;
    return Padding(
      // No fill: the stage's own dark shows through, so the frame corners and
      // the hint underneath stay readable. Filling it white turned the one
      // panel that is INSIDE a dark viewport into a light box with white copy
      // printed over its edge.
      padding: const EdgeInsets.all(KalloSpacing.sp4),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // The one error shape: icon badge, then the reason. The action sits
          // below the frame.
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
            style: dashMeta(color: KalloColors.bandForeground),
          ),
        ],
      ),
    );
  }
}

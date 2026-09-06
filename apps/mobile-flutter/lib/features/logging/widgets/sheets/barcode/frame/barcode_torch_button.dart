import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../../../theme/kallo_theme.dart';

/// Torch toggle for the barcode stage's bottom-left control slot — filled
/// white while on, translucent while off; hidden when the device has no torch.
class BarcodeTorchButton extends StatelessWidget {
  const BarcodeTorchButton({super.key, required this.controller});

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
            behavior: HitTestBehavior.opaque,
            onTap: () {
              HapticFeedback.selectionClick();
              controller.toggleTorch();
            },
            child: Center(
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color:
                      on ? Colors.white : Colors.black.withValues(alpha: 0.35),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  on ? LucideIcons.flashlight300 : LucideIcons.flashlightOff300,
                  size: KalloIcons.action,
                  color: on ? const Color(0xFF141413) : Colors.white,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

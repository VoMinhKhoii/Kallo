/// The bare icon+label link a bottom sheet's body offers ("enter barcode
/// manually", "back to camera"). Its umber-era siblings SheetPrimaryButton /
/// SheetOutlineButton were retired in the native pass (2026-08-31) — sheets
/// use [KalloButton] variants now. The footer's confirm is
/// [SheetConfirmButton], next door.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_typography.dart';

/// The quietest of the three: no fill, no border — a muted icon and label in a
/// 44pt-tall row. A null [onTap] renders it disabled to the semantics tree.
class QuietIconButton extends StatelessWidget {
  const QuietIconButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.haptic = true,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  /// Whether a tap clicks. The barcode step's Back link opts out — stepping
  /// back is not a confirmation, so it stays silent.
  final bool haptic;

  @override
  Widget build(BuildContext context) {
    final tap = onTap;
    return Semantics(
      button: true,
      enabled: tap != null,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap:
            tap == null
                ? null
                : () {
                  if (haptic) HapticFeedback.selectionClick();
                  tap();
                },
        child: SizedBox(
          height: 44,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: KalloColors.textMuted),
              const SizedBox(width: 6),
              Text(
                label,
                style: KalloTextStyles.sansMedium(
                  fontSize: KalloFontSize.sm,
                ).copyWith(color: KalloColors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

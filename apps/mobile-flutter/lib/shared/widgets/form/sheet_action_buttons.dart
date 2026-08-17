/// The action buttons a bottom sheet's body offers: one filled CTA, one
/// hairline-outlined alternative, and one bare icon+label link. They were three
/// private copies inside the barcode sheet, which is why they live here now —
/// nothing about them is barcode-specific.
///
/// The footer's confirm is [SheetConfirmButton], next door.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';

/// Full-width umber CTA that dips to [KalloColors.btnHover] and scales down
/// while held.
class SheetPrimaryButton extends StatefulWidget {
  const SheetPrimaryButton({
    super.key,
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  State<SheetPrimaryButton> createState() => _SheetPrimaryButtonState();
}

class _SheetPrimaryButtonState extends State<SheetPrimaryButton> {
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
            padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp3),
            decoration: BoxDecoration(
              color: _pressed ? KalloColors.btnHover : KalloColors.btn,
              borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
            ),
            child: Text(
              widget.label,
              style: KalloTextStyles.sansSemiBold(
                fontSize: KalloFontSize.sm,
              ).copyWith(color: Colors.white),
            ),
          ),
        ),
      ),
    );
  }
}

/// Full-width white button with a hairline border — the secondary route out of
/// a sheet, carrying an icon beside its label.
class SheetOutlineButton extends StatelessWidget {
  const SheetOutlineButton({
    super.key,
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
          padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp3),
          decoration: BoxDecoration(
            color: KalloColors.elev,
            borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
            border: Border.all(color: KalloColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: KalloColors.text),
              const SizedBox(width: 6),
              Text(
                label,
                style: KalloTextStyles.sansMedium(
                  fontSize: KalloFontSize.sm,
                ).copyWith(color: KalloColors.text),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

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

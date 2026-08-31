import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// The weight logger's full-width Save/Update — the in-app primary: beige
/// wash, ink label, fully rounded. (Its first native-pass ship kept the
/// retired umber fill — the user caught it on device, 2026-08-31.)
class WeightSubmitButton extends StatelessWidget {
  const WeightSubmitButton({
    super.key,
    required this.label,
    required this.pending,
    required this.pressed,
    required this.onTapDown,
    required this.onTapUp,
    required this.onTapCancel,
    required this.onTap,
  });

  final String label;
  final bool pending;
  final bool pressed;
  final VoidCallback onTapDown;
  final VoidCallback onTapUp;
  final VoidCallback onTapCancel;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: pending ? null : (_) => onTapDown(),
      onTapUp: pending ? null : (_) => onTapUp(),
      onTapCancel: pending ? null : onTapCancel,
      onTap: onTap,
      child: Opacity(
        opacity: pending ? 0.55 : 1,
        child: Container(
          // The in-app primary: beige wash, ink label, fully rounded — the
          // umber/white fill this shipped with predated the button retirement
          // (user report, 2026-08-31).
          constraints: const BoxConstraints(minHeight: 50),
          padding: const EdgeInsets.symmetric(
            horizontal: KalloSpacing.sp5,
            vertical: KalloSpacing.sp3,
          ),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: pressed && !pending
                ? Color.alphaBlend(
                    KalloColors.pressWash,
                    KalloColors.btnPrimarySoft,
                  )
                : KalloColors.btnPrimarySoft,
            borderRadius: BorderRadius.circular(KalloRadii.button),
          ),
          child: pending
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: KalloColors.text),
                )
              : Text(
                  label,
                  // Sentence-case, body-sized label — a native button reads as
                  // a word, not a techy 11px all-caps eyebrow.
                  style: dashBody(
                    color: KalloColors.text,
                    weight: FontWeight.w600,
                  ),
                ),
        ),
      ),
    );
  }
}

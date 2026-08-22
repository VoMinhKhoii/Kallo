import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// The app's quiet confirm: a warm [KalloColors.hover] pill with an ink label,
/// sized to its text and parked at the end of its row.
///
/// This is the shape the logging card's Save uses, and the one every
/// "commit what I just typed" action should take. It deliberately is NOT the
/// umber [KalloButton] — the design system spends that on one primary CTA per
/// surface, and a form's own submit is not that one.
///
/// While [busy] it swaps in an inline spinner and the [busyLabel], keeping the
/// pill in place rather than replacing it with a blocking overlay.
class QuietActionButton extends StatelessWidget {
  const QuietActionButton({
    super.key,
    required this.label,
    required this.onTap,
    this.busyLabel,
    this.busy = false,
    this.enabled = true,
  });

  final String label;

  /// Shown beside the spinner while [busy]; falls back to [label].
  final String? busyLabel;

  final bool busy;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(KalloRadii.xl);
    return Opacity(
      opacity: enabled ? 1 : 0.6,
      child: Material(
        color: KalloColors.hover,
        borderRadius: radius,
        child: InkWell(
          // Gate here, not just on Opacity. `enabled: false` used to dim the
          // pill and leave it fully tappable, so both call sites restated the
          // same predicate in `onTap` — two ways to say disabled, one of them
          // decorative.
          onTap: (enabled && !busy) ? onTap : null,
          borderRadius: radius,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (busy) ...[
                  const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: kInk,
                    ),
                  ),
                  const SizedBox(width: 6),
                ],
                Text(
                  busy ? (busyLabel ?? label) : label,
                  style: dashBody(color: kInk, weight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/logging_spacing.dart';

class MealActionIconButton extends StatelessWidget {
  const MealActionIconButton({
    super.key,
    required this.icon,
    required this.label,
    this.onTap,
    this.active = false,
    this.danger = false,
    this.pending = false,
    this.toggled,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool active;
  final bool danger;
  final bool pending;

  /// Screen-reader toggle state for on/off actions (the circle-share toggle);
  /// null for plain one-shot actions.
  final bool? toggled;

  @override
  Widget build(BuildContext context) {
    // Active is carried by the warm hover wash behind the icon, not the icon
    // colour — the glyph stays ink (never tan) in every non-danger state.
    final foreground = danger ? KalloColors.danger : KalloColors.text;
    final enabled = onTap != null && !pending;

    return Tooltip(
      message: label,
      // The inner Semantics already names the button — without this, iOS
      // appends the tooltip text to the accessibility label a second time.
      excludeFromSemantics: true,
      child: Semantics(
        button: true,
        enabled: enabled,
        toggled: toggled,
        label: label,
        child: Material(
          color: Colors.transparent,
          child: InkResponse(
            onTap:
                enabled
                    ? () {
                      HapticFeedback.selectionClick();
                      onTap!();
                    }
                    : null,
            // Both washes — the selected fill and the pressed splash — hug the
            // glyph rather than filling the hit box. The tap target stays
            // [LoggingIcons.hit] for accessibility; a selected action reads as
            // a small chip around its icon, not a 36pt block under the card.
            radius: LoggingIcons.wash / 2,
            containedInkWell: true,
            highlightShape: BoxShape.rectangle,
            borderRadius: BorderRadius.circular(KalloRadii.md),
            child: SizedBox.square(
              dimension: LoggingIcons.hit,
              child: Center(
                // [Ink], not a Container: ink reactions paint onto the ancestor
                // Material, so an opaque Container here would sit ON TOP of the
                // splash and swallow the press feedback on a selected action.
                // Ink paints its decoration into that same Material, below the
                // splash.
                child: Ink(
                  width: LoggingIcons.wash,
                  height: LoggingIcons.wash,
                  decoration: BoxDecoration(
                    color: active ? KalloColors.hover : Colors.transparent,
                    borderRadius: BorderRadius.circular(KalloRadii.md),
                  ),
                  child: Center(
                    child:
                        pending
                            ? SizedBox.square(
                              dimension: 13,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: foreground,
                              ),
                            )
                            : Icon(
                              icon,
                              size: LoggingIcons.size,
                              color: foreground,
                            ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
